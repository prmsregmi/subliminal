import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Resolve a unique action-link token to whatever it points at (a comment
// opportunity or an original post), with everything the operator action page
// needs. Subscribed live, so status flips appear instantly on the dashboard.
export const getByToken = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const opp = await ctx.db
      .query("opportunities")
      .withIndex("by_token", (q) => q.eq("actionToken", token))
      .first();
    if (opp) {
      const product = await ctx.db.get(opp.productId);
      const draft = await ctx.db
        .query("drafts")
        .withIndex("by_opportunity", (q) => q.eq("opportunityId", opp._id))
        .first();
      return { type: "opportunity" as const, opportunity: opp, product, draft };
    }

    const post = await ctx.db
      .query("campaignPosts")
      .withIndex("by_token", (q) => q.eq("actionToken", token))
      .first();
    if (post) {
      const product = await ctx.db.get(post.productId);
      return { type: "post" as const, post, product };
    }

    return null;
  },
});

export const markOpened = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const opp = await ctx.db
      .query("opportunities")
      .withIndex("by_token", (q) => q.eq("actionToken", token))
      .first();
    if (opp) {
      if (opp.status !== "completed") {
        await ctx.db.patch(opp._id, { status: "opened", openedAt: opp.openedAt ?? Date.now() });
      }
      return;
    }
    const post = await ctx.db
      .query("campaignPosts")
      .withIndex("by_token", (q) => q.eq("actionToken", token))
      .first();
    if (post && post.status !== "completed") {
      await ctx.db.patch(post._id, { status: "opened", openedAt: post.openedAt ?? Date.now() });
    }
  },
});

export const markCompleted = mutation({
  args: { token: v.string(), note: v.optional(v.string()) },
  handler: async (ctx, { token, note }) => {
    const opp = await ctx.db
      .query("opportunities")
      .withIndex("by_token", (q) => q.eq("actionToken", token))
      .first();
    if (opp) {
      await ctx.db.patch(opp._id, {
        status: "completed",
        completedAt: Date.now(),
        completedNote: note,
      });
      return;
    }
    const post = await ctx.db
      .query("campaignPosts")
      .withIndex("by_token", (q) => q.eq("actionToken", token))
      .first();
    if (post) {
      await ctx.db.patch(post._id, { status: "completed", completedAt: Date.now() });
    }
  },
});
