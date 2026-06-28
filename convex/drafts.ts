import { internalAction, internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { callStructured, resolveModel } from "./lib/llm";
import { CONTENT_SKILL } from "./lib/draft_skill";
import { CRITIC_SALESINESS_THRESHOLD, DEFAULT_DISCLOSURE } from "./constants";
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

// Craft system prompt: the comment must be genuinely persuasive on the merits
// while staying honest. A disclosure line is appended automatically, so the
// model writes as an affiliated-but-helpful peer — never as a disinterested
// stranger and never inventing popularity. Few-shot examples calibrate the voice.
const DRAFT_SYSTEM = [
  "You write Reddit comments for a brand operator who engages HONESTLY. A short disclosure line stating the affiliation is appended to every comment automatically — so never pretend to be an uninvolved stranger and never invent fake popularity (\"everyone's using it\"). Within that honesty, write the sharpest possible comment: native to the subreddit, specific, and genuinely persuasive on the merits.",
  "",
  "Craft rules:",
  "- Answer the actual question or pain in the first sentence. Earn the mention before you make it.",
  "- Sound like a real member of the subreddit: plain, concise, lowercase-casual where it fits. No marketing voice, no hype words (game-changer, elevate, unlock, supercharge), no exclamation spam.",
  "- Mention the product once, as your own honest experience or a concrete data point — not a pitch. Concede real flaws and name competitors honestly when that's the truthful answer; that restraint is what makes it land.",
  "- The disclosure (\"I work on the product\") is appended, so it's fine — often better — to briefly own the bias up front (\"biased, I work on it, but…\"). Never write as a neutral stranger who just happened to discover it; that's what the appended disclosure would expose.",
  "- 2–4 sentences. A skeptical-Redditor critic will score salesiness 0–10; aim for 0–2.",
  "",
  "Examples (comment body only — the disclosure line is appended after):",
  "",
  "THREAD r/energydrinks — \"Red Bull just stopped working for me, anyone else?\"",
  'GOOD: "Tolerance is real, same thing happened to me. Red Bull\'s only ~80mg in a tiny can — I switched to a White Monster Ultra (200mg, way bigger) and the \'nothing happens\' went away. Biased, I work on Monster, but the caffeine gap alone is night and day."',
  "WHY: leads with the real cause; the product is one honest data point, not the headline.",
  "",
  "THREAD r/college — \"How do I actually pull an all-nighter?\"",
  'GOOD: "Stage your caffeine instead of slamming it, eat protein not candy, and take a 20-min nap around 3am — that resets you more than another drink. I keep a White Monster Ultra for the actual 2am wall, but honestly the nap is the real cheat code."',
  "WHY: most of the value isn't the product; the mention is incidental to genuinely useful advice.",
  "",
  "THREAD r/energydrinks — \"White Monster is overhyped, I don't get it\" (skeptic)",
  'GOOD: "Honestly fair, the hype is a lot. I work on it so grain of salt — it mostly caught on because it\'s zero-sugar and tastes lighter than the green can, not because it\'s magic. If it\'s not your thing, Celsius or just black coffee are reasonable too."',
  "WHY: agrees first, owns the bias, refuses to oversell, even points elsewhere — exactly what disarms a skeptic.",
  "",
  "THREAD r/energydrinks — \"Celsius or Red Bull, which do you actually reach for?\"",
  'GOOD: "Biased, I work on Monster, so grain of salt — but I\'d take a White Monster Ultra over both. Zero sugar like Celsius but tastes better to me, and a bigger can than Red Bull. Red Bull\'s still the move if you want that exact classic taste though."',
  "WHY: owns the affiliation up front, concedes the competitors' real strengths, lands the pick on the criteria asked.",
  "",
  'BAD (never): "You HAVE to try White Monster, it\'s a total game-changer, everyone at my gym drinks it!!" — hype, fake social proof, zero value.',
].join("\n");

// The target tier this thread came from (parsed from discoveredVia "<kind>:<sub>")
// sets how aggressively the product may appear — direct communities tolerate a
// real mention, far-stretch ones only an aside. The per-subreddit bridge angle is
// folded in so the draft leans on the same correlation the targeting step chose.
function intentHint(opp: Doc<"opportunities">, productName: string): string {
  const kind = opp.discoveredVia.split(":")[0];
  const angle = opp.angle ? ` Bridge angle to lean on: ${opp.angle}.` : "";
  switch (kind) {
    case "direct":
      return `This is ${productName}'s OWN category community — high promo-sensitivity. Lead with genuine value or a real question; never read as an ad.${angle}`;
    case "competitor":
      return `This is a COMPETITOR/alternative community. If you mention ${productName}, position it honestly as an alternative — concede the competitor's real strengths, don't trash it.${angle}`;
    case "complement":
      return `This community is for a product ${productName} COMPLEMENTS (used alongside, not instead of). Frame ${productName} as something that pairs with what they already use — never a replacement.${angle}`;
    case "indirect":
      return `This is an INDIRECT/subliminal-fit community: its native topic is one or two hops from ${productName}. The community's real topic MUST lead; ${productName} may appear only as a natural, incidental detail — never the subject.${angle}`;
    case "lateral":
      return `This is a FAR-STRETCH community: the tie to ${productName} is loose. ${productName} can surface at most as a passing aside, if at all. Lead entirely with the community's own topic.${angle}`;
    default:
      return angle.trim();
  }
}

function draftPrompt(
  product: Doc<"products">,
  opp: Doc<"opportunities">,
  productName: string,
  critique?: string,
): string {
  const hint = intentHint(opp, productName);
  return [
    `OUR PRODUCT: ${productName} — ${product.summary || product.category || ""} (${product.domain})`,
    `Recommended approach for this thread: ${opp.responseType ?? "share-experience"}`,
    hint ? hint : "",
    "",
    `THREAD: r/${opp.subreddit} — "${opp.title}"`,
    opp.body ? opp.body.slice(0, 1500) : "(no body)",
    "",
    `Write the comment body. Lead with real help, earn the ${productName} mention, keep it native to r/${opp.subreddit}. Do NOT add a disclosure line — it's appended automatically.`,
    critique
      ? `\nA skeptical reviewer flagged the previous draft as too salesy: ${critique}\nRewrite it to be more genuine and less promotional.`
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
        role: "draft",
        system: `${CONTENT_SKILL}\n\n---\n\n${DRAFT_SYSTEM}`,
        prompt: draftPrompt(product, opp, productName),
        toolName: "write_comment",
        toolDescription: "Write a helpful, disclosed Reddit comment.",
        schema: DRAFT_SCHEMA,
        maxTokens: 600,
      });

      let critic = await callStructured<CriticResult>({
        role: "critic",
        prompt: criticPrompt(opp, draft.comment, disclosure),
        toolName: "judge_comment",
        toolDescription: "Judge how salesy a Reddit comment reads.",
        schema: CRITIC_SCHEMA,
        maxTokens: 300,
      });

      let regenerated = false;
      if (salesScore(critic) > CRITIC_SALESINESS_THRESHOLD) {
        draft = await callStructured<DraftResult>({
          role: "draft",
          system: `${CONTENT_SKILL}\n\n---\n\n${DRAFT_SYSTEM}`,
          prompt: draftPrompt(product, opp, productName, String(critic.fixes || critic.verdict)),
          toolName: "write_comment",
          toolDescription: "Rewrite a helpful, disclosed Reddit comment to be less salesy.",
          schema: DRAFT_SCHEMA,
          maxTokens: 600,
        });
        critic = await callStructured<CriticResult>({
          role: "critic",
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
        model: resolveModel("draft"),
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
