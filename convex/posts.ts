import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { callStructured } from "./lib/anthropic";
import { newToken } from "./lib/token";
import { MODEL_DRAFT, MODEL_CRITIC, DEFAULT_DISCLOSURE } from "./constants";

const POST_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "Reddit post title — natural, specific, not clickbait." },
    body: {
      type: "string",
      description:
        "Post body. Genuine, story/question driven. Do NOT include the disclosure line.",
    },
    rationale: {
      type: "string",
      description: "Why this post fits the subreddit and invites real discussion.",
    },
  },
  required: ["title", "body", "rationale"],
};

interface PostResult {
  title: string;
  body: string;
  rationale: string;
}

// Post-creation mode: operator picks a subreddit + optional angle.
export const generate = mutation({
  args: {
    productId: v.id("products"),
    subreddit: v.string(),
    angle: v.optional(v.string()),
  },
  handler: async (ctx, { productId, subreddit, angle }) => {
    const id = await ctx.db.insert("campaignPosts", {
      productId,
      subreddit: subreddit.replace(/^\/?r\//i, "").trim(),
      angle,
      title: "",
      body: "",
      disclosureLine: "",
      pipelineStage: "generating",
      status: "queued",
      actionToken: newToken(),
      createdAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.posts.run, { campaignPostId: id });
    return id;
  },
});

export const run = internalAction({
  args: { campaignPostId: v.id("campaignPosts") },
  handler: async (ctx, { campaignPostId }) => {
    const post = await ctx.runQuery(internal.posts.getInternal, { campaignPostId });
    if (!post) return;
    const product = await ctx.runQuery(internal.products.getInternal, {
      productId: post.productId,
    });
    if (!product) return;

    try {
      const productName = product.name || product.domain.split(".")[0];
      let disclosure = product.disclosureTemplate.replace(/\{\{product\}\}/g, productName);
      if (!disclosure.trim()) {
        disclosure = DEFAULT_DISCLOSURE.replace(/\{\{product\}\}/g, productName);
      }

      const prompt = [
        `Write an original Reddit post for r/${post.subreddit} that would spark genuine discussion in a community where ${productName} is relevant.`,
        `PRODUCT: ${productName} — ${product.summary || product.category || ""} (${product.domain})`,
        post.angle ? `ANGLE the operator wants: ${post.angle}` : "",
        "",
        `Rules: be a real community member sharing a genuine experience or question. Do NOT write an ad. You may mention ${productName} only if it fits naturally and honestly; a disclosure line is appended automatically. Match r/${post.subreddit}'s tone.`,
      ].join("\n");

      const r = await callStructured<PostResult>({
        model: MODEL_DRAFT,
        prompt,
        toolName: "write_post",
        toolDescription: "Write an original Reddit post.",
        schema: POST_SCHEMA,
        maxTokens: 700,
      });

      const critic = await callStructured<{ salesiness: number; verdict?: string }>({
        model: MODEL_CRITIC,
        prompt: `Skeptical Redditor: rate 0..10 how much this post reads like covert marketing for r/${post.subreddit}.\n\nTITLE: ${r.title}\n\nBODY:\n${r.body}\n\n(0 = genuine member, 10 = obvious ad)`,
        toolName: "judge_post",
        toolDescription: "Judge how salesy a Reddit post reads, 0..10.",
        schema: {
          type: "object",
          properties: { salesiness: { type: "number" }, verdict: { type: "string" } },
          required: ["salesiness"],
        },
        maxTokens: 200,
      });

      await ctx.runMutation(internal.posts.save, {
        campaignPostId,
        title: String(r.title || ""),
        body: String(r.body || ""),
        disclosureLine: disclosure,
        rationale: String(r.rationale || ""),
        criticScore: Math.max(0, Math.min(10, Number(critic.salesiness) || 0)),
      });
    } catch (e) {
      console.error("[posts] generation failed:", e);
      await ctx.runMutation(internal.posts.setError, {
        campaignPostId,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  },
});

export const getInternal = internalQuery({
  args: { campaignPostId: v.id("campaignPosts") },
  handler: (ctx, { campaignPostId }) => ctx.db.get(campaignPostId),
});

export const save = internalMutation({
  args: {
    campaignPostId: v.id("campaignPosts"),
    title: v.string(),
    body: v.string(),
    disclosureLine: v.string(),
    rationale: v.optional(v.string()),
    criticScore: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { campaignPostId, ...rest } = args;
    await ctx.db.patch(campaignPostId, { ...rest, pipelineStage: "ready" });
  },
});

export const setError = internalMutation({
  args: { campaignPostId: v.id("campaignPosts"), message: v.string() },
  handler: async (ctx, { campaignPostId, message }) => {
    await ctx.db.patch(campaignPostId, { pipelineStage: "error", errorMessage: message });
  },
});

export const listByProduct = query({
  args: { productId: v.id("products") },
  handler: async (ctx, { productId }) => {
    const rows = await ctx.db
      .query("campaignPosts")
      .withIndex("by_product", (q) => q.eq("productId", productId))
      .collect();
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});
