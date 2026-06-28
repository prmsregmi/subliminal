import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { vSignals, vClassification, vResponseType } from "./schema";
import { newToken } from "./lib/token";
import { DEFAULT_DISCLOSURE, MAX_OPPORTUNITIES_PER_PRODUCT } from "./constants";
import { computeSchedule } from "./lib/timing";
import type { Doc } from "./_generated/dataModel";

function isRedditThreadUrl(url: string): boolean {
  return /reddit\.com\/r\/[^/]+\/comments\/[^/?#]+/i.test(url);
}

// ---- Internal: discovery writes opportunities here ----

export const upsert = internalMutation({
  args: {
    productId: v.id("products"),
    redditId: v.string(),
    subreddit: v.string(),
    title: v.string(),
    body: v.string(),
    permalink: v.string(),
    url: v.string(),
    author: v.optional(v.string()),
    score: v.number(),
    numComments: v.number(),
    createdUtc: v.number(),
    discoveredVia: v.string(),
    targetTier: v.optional(v.number()),
    angle: v.optional(v.string()),
    signals: vSignals,
    baseScore: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("opportunities")
      .withIndex("by_product_and_reddit", (q) =>
        q.eq("productId", args.productId).eq("redditId", args.redditId),
      )
      .first();
    if (existing) return { id: existing._id, isNew: false };

    const count = (
      await ctx.db
        .query("opportunities")
        .withIndex("by_product", (q) => q.eq("productId", args.productId))
        .collect()
    ).length;
    if (count >= MAX_OPPORTUNITIES_PER_PRODUCT) return { id: null, isNew: false };

    const id = await ctx.db.insert("opportunities", {
      ...args,
      relevanceScore: args.baseScore,
      pipelineStage: "discovered",
      status: "queued",
      actionToken: newToken(),
      createdAt: Date.now(),
    });
    // Score + classify this new opportunity.
    await ctx.scheduler.runAfter(0, internal.classify.run, { opportunityId: id });
    return { id, isNew: true };
  },
});

export const getInternal = internalQuery({
  args: { opportunityId: v.id("opportunities") },
  handler: (ctx, { opportunityId }) => ctx.db.get(opportunityId),
});

export const applyClassification = internalMutation({
  args: {
    opportunityId: v.id("opportunities"),
    classification: vClassification,
    responseType: vResponseType,
    authenticityRisk: v.number(),
    relevanceScore: v.number(),
    recommendation: v.union(v.literal("engage"), v.literal("skip")),
    reasoning: v.string(),
  },
  handler: async (ctx, args) => {
    const { opportunityId, ...rest } = args;
    await ctx.db.patch(opportunityId, {
      ...rest,
      pipelineStage: "scored",
      scoredAt: Date.now(),
    });
    // Only draft for opportunities the algorithm recommends engaging.
    if (rest.recommendation === "engage") {
      await ctx.scheduler.runAfter(0, internal.drafts.generate, { opportunityId });
    }
  },
});

export const setStageError = internalMutation({
  args: { opportunityId: v.id("opportunities") },
  handler: async (ctx, { opportunityId }) => {
    await ctx.db.patch(opportunityId, { pipelineStage: "error" });
  },
});

// ---- Public: dashboard reads + operator actions ----

export const list = query({
  args: { productId: v.id("products") },
  handler: async (ctx, { productId }) => {
    const rows = await ctx.db
      .query("opportunities")
      .withIndex("by_product", (q) => q.eq("productId", productId))
      .collect();
    return rows.sort((a, b) => b.relevanceScore - a.relevanceScore);
  },
});

export const assign = mutation({
  args: {
    opportunityId: v.id("opportunities"),
    operatorId: v.optional(v.id("operators")),
  },
  handler: async (ctx, { opportunityId, operatorId }) => {
    if (!operatorId) {
      await ctx.db.patch(opportunityId, {
        assignedTo: undefined,
        assignedToName: undefined,
        status: "queued",
      });
      return;
    }
    const op = await ctx.db.get(operatorId);
    await ctx.db.patch(opportunityId, {
      assignedTo: operatorId,
      assignedToName: op?.name,
      status: "assigned",
    });
  },
});

export const dismiss = mutation({
  args: { opportunityId: v.id("opportunities") },
  handler: async (ctx, { opportunityId }) => {
    await ctx.db.patch(opportunityId, { status: "dismissed" });
  },
});

export const requeue = mutation({
  args: { opportunityId: v.id("opportunities") },
  handler: async (ctx, { opportunityId }) => {
    await ctx.db.patch(opportunityId, { status: "queued" });
  },
});

// Employee marks an opportunity as posted to Reddit — drops it off the queue.
export const markPosted = mutation({
  args: { opportunityId: v.id("opportunities") },
  handler: async (ctx, { opportunityId }) => {
    await ctx.db.patch(opportunityId, { status: "completed", completedAt: Date.now() });
  },
});

// ---- Employee posting queue: WHAT to post + WHEN ----
// Drafted, engage-recommended opportunities across all products, each laid out
// on a mod-safe schedule by the timing algorithm. Powers /post-by-employees.
export const employeeQueue = query({
  args: {},
  handler: async (ctx) => {
    const opps = await ctx.db.query("opportunities").collect();
    const candidates = opps.filter(
      (o) =>
        o.recommendation === "engage" &&
        isRedditThreadUrl(o.url) &&
        o.status !== "dismissed" &&
        o.status !== "completed",
    );

    const withDrafts = (
      await Promise.all(
        candidates.map(async (o) => {
          const draft = await ctx.db
            .query("drafts")
            .withIndex("by_opportunity", (q) => q.eq("opportunityId", o._id))
            .order("desc")
            .first();
          return draft ? { o, draft } : null;
        }),
      )
    ).filter((r): r is { o: Doc<"opportunities">; draft: Doc<"drafts"> } => r !== null);

    const posts = (await ctx.db.query("campaignPosts").collect()).filter(
      (post) =>
        post.pipelineStage === "ready" &&
        post.status !== "dismissed" &&
        post.status !== "completed",
    );

    const schedule = computeSchedule(
      [
        ...withDrafts.map(({ o }) => ({
          id: o._id,
          subreddit: o.subreddit,
          score: o.relevanceScore,
        })),
        ...posts.map((post) => ({
          id: post._id,
          subreddit: post.subreddit,
          score: Math.max(0, 100 - (post.criticScore ?? 5) * 10),
        })),
      ],
      Date.now(),
    );

    const commentRows = await Promise.all(
      withDrafts.map(async ({ o, draft }) => {
        const product = await ctx.db.get(o.productId);
        const slot = schedule.get(o._id);
        return {
          kind: "comment" as const,
          opportunity: o,
          draft,
          productName: product?.name || product?.domain || "",
          scheduledFor: slot?.scheduledFor ?? null,
          scheduleReason: slot?.reason ?? null,
        };
      }),
    );

    const postRows = await Promise.all(
      posts.map(async (post) => {
        const product = await ctx.db.get(post.productId);
        const productName = product?.name || product?.domain || "";
        const disclosureLine =
          post.disclosureLine ||
          DEFAULT_DISCLOSURE.replace(/\{\{product\}\}/g, productName || "this product");
        const slot = schedule.get(post._id);
        return {
          kind: "post" as const,
          post,
          disclosureLine,
          productName,
          scheduledFor: slot?.scheduledFor ?? null,
          scheduleReason: slot?.reason ?? null,
        };
      }),
    );

    const rows = [...commentRows, ...postRows];
    return rows.sort(
      (a, b) => (a.scheduledFor ?? Infinity) - (b.scheduledFor ?? Infinity),
    );
  },
});
