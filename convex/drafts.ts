import { internalAction, internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { callStructured } from "./lib/anthropic";
import {
  MODEL_DRAFT,
  MODEL_CRITIC,
  CRITIC_SALESINESS_THRESHOLD,
  DEFAULT_DISCLOSURE,
} from "./constants";
import type { Doc } from "./_generated/dataModel";

const DRAFT_SCHEMA = {
  type: "object",
  properties: {
    comment: {
      type: "string",
      description:
        "The Reddit comment. Genuinely helpful, conversational, matches the subreddit's tone. Do NOT include the disclosure line — it is appended separately.",
    },
    rationale: {
      type: "string",
      description: "One sentence: why this comment fits and adds value.",
    },
  },
  required: ["comment", "rationale"],
};

const CRITIC_SCHEMA = {
  type: "object",
  properties: {
    salesiness: {
      type: "number",
      description:
        "0..10 — how much this reads like marketing to a skeptical Redditor. 0 = genuine helpful peer, 10 = obvious ad.",
    },
    verdict: { type: "string", description: "What a skeptical Redditor would think." },
    fixes: { type: "string", description: "If salesy, what to change. Otherwise empty." },
  },
  required: ["salesiness", "verdict"],
};

interface DraftResult {
  comment: string;
  rationale: string;
}
interface CriticResult {
  salesiness: number;
  verdict: string;
  fixes?: string;
}

// Robust 0..10 score. A missing/garbage value is treated as worst-case (10) so
// an un-scored draft regenerates rather than silently passing as "clean".
function salesScore(c: CriticResult): number {
  const n = Number(c.salesiness);
  return Number.isFinite(n) ? Math.max(0, Math.min(10, n)) : 10;
}

function draftPrompt(
  product: Doc<"products">,
  opp: Doc<"opportunities">,
  productName: string,
  critique?: string,
): string {
  return [
    "Write a Reddit comment for this thread that is genuinely helpful FIRST and only mentions our product where it authentically fits.",
    "",
    `OUR PRODUCT: ${productName} — ${product.summary || product.category || ""} (${product.domain})`,
    `Recommended approach: ${opp.responseType ?? "share-experience"}`,
    "",
    `THREAD: r/${opp.subreddit} — "${opp.title}"`,
    opp.body ? opp.body.slice(0, 1500) : "(no body)",
    "",
    "Rules:",
    "- Lead with real help answering the actual question / pain.",
    `- Mention ${productName} only if it genuinely helps; you may also mention competitors honestly.`,
    '- Match the subreddit\'s casual tone. No marketing clichés, no hype, no "game-changer".',
    "- Keep it short (2-5 sentences). Do NOT add a disclosure line — it's appended automatically.",
    critique
      ? `\nA reviewer flagged the previous draft as too salesy: ${critique}\nRewrite it to be more genuine and less promotional.`
      : "",
  ].join("\n");
}

function criticPrompt(opp: Doc<"opportunities">, comment: string, disclosure: string): string {
  return [
    `You are a jaded, skeptical Reddit user with a strong BS meter. This comment would be posted to r/${opp.subreddit} on the thread "${opp.title}".`,
    "",
    `COMMENT (a disclosure line "${disclosure}" will be appended):`,
    comment,
    "",
    "Rate how much it reads like marketing/an ad (0 = a genuine helpful peer, 10 = obvious shill). Redditors downvote and call out anything that smells promotional even with disclosure. Be harsh.",
  ].join("\n");
}

export const generate = internalAction({
  args: { opportunityId: v.id("opportunities") },
  handler: async (ctx, { opportunityId }) => {
    const opp = await ctx.runQuery(internal.opportunities.getInternal, { opportunityId });
    if (!opp) return;
    const product = await ctx.runQuery(internal.products.getInternal, {
      productId: opp.productId,
    });
    if (!product) return;

    try {
      const productName = product.name || product.domain.split(".")[0];
      let disclosure = product.disclosureTemplate.replace(/\{\{product\}\}/g, productName);
      if (!disclosure.trim()) {
        disclosure = DEFAULT_DISCLOSURE.replace(/\{\{product\}\}/g, productName);
      }

      let draft = await callStructured<DraftResult>({
        model: MODEL_DRAFT,
        prompt: draftPrompt(product, opp, productName),
        toolName: "write_comment",
        toolDescription: "Write a helpful, disclosed Reddit comment.",
        schema: DRAFT_SCHEMA,
        maxTokens: 600,
      });

      let critic = await callStructured<CriticResult>({
        model: MODEL_CRITIC,
        prompt: criticPrompt(opp, draft.comment, disclosure),
        toolName: "judge_comment",
        toolDescription: "Judge how salesy a Reddit comment reads.",
        schema: CRITIC_SCHEMA,
        maxTokens: 300,
      });

      let regenerated = false;
      if (salesScore(critic) > CRITIC_SALESINESS_THRESHOLD) {
        draft = await callStructured<DraftResult>({
          model: MODEL_DRAFT,
          prompt: draftPrompt(product, opp, productName, String(critic.fixes || critic.verdict)),
          toolName: "write_comment",
          toolDescription: "Rewrite a helpful, disclosed Reddit comment to be less salesy.",
          schema: DRAFT_SCHEMA,
          maxTokens: 600,
        });
        critic = await callStructured<CriticResult>({
          model: MODEL_CRITIC,
          prompt: criticPrompt(opp, draft.comment, disclosure),
          toolName: "judge_comment",
          toolDescription: "Judge how salesy a Reddit comment reads.",
          schema: CRITIC_SCHEMA,
          maxTokens: 300,
        });
        regenerated = true;
      }

      await ctx.runMutation(internal.drafts.save, {
        opportunityId,
        productId: opp.productId,
        body: String(draft.comment || ""),
        disclosureLine: disclosure,
        rationale: String(draft.rationale || ""),
        criticScore: salesScore(critic),
        criticVerdict: String(critic.verdict || ""),
        regenerated,
        model: MODEL_DRAFT,
      });
    } catch (e) {
      console.error("[drafts] generation failed:", e);
      await ctx.runMutation(internal.opportunities.setStageError, { opportunityId });
    }
  },
});

export const save = internalMutation({
  args: {
    opportunityId: v.id("opportunities"),
    productId: v.id("products"),
    body: v.string(),
    disclosureLine: v.string(),
    rationale: v.optional(v.string()),
    criticScore: v.number(),
    criticVerdict: v.optional(v.string()),
    regenerated: v.boolean(),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    // Keep one (latest) draft per opportunity.
    const existing = await ctx.db
      .query("drafts")
      .withIndex("by_opportunity", (q) => q.eq("opportunityId", args.opportunityId))
      .collect();
    for (const d of existing) await ctx.db.delete(d._id);

    await ctx.db.insert("drafts", {
      ...args,
      version: existing.length + 1,
      createdAt: Date.now(),
    });
    await ctx.db.patch(args.opportunityId, {
      pipelineStage: "drafted",
      draftedAt: Date.now(),
    });
  },
});

export const listByProduct = query({
  args: { productId: v.id("products") },
  handler: async (ctx, { productId }) =>
    ctx.db
      .query("drafts")
      .withIndex("by_product", (q) => q.eq("productId", productId))
      .collect(),
});
