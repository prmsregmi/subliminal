import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("operators").collect();
    return rows.sort((a, b) => a.createdAt - b.createdAt);
  },
});

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) =>
    ctx.db.insert("operators", {
      name: name.trim() || "Operator",
      createdAt: Date.now(),
    }),
});
