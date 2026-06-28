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
import { MAX_OPPORTUNITIES_PER_PRODUCT } from "./constants";

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
