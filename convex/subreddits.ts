import { action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { PaginationResult } from "convex/server";
import type { Doc } from "./_generated/dataModel";
import { embed, hasEmbeddingCreds } from "./lib/embeddings";

// Hydrate subreddit docs from vector-search result ids (vectorSearch returns ids).
export const byIds = internalQuery({
  args: { ids: v.array(v.id("subreddits")) },
  handler: async (ctx, { ids }) => {
    const rows = await Promise.all(ids.map((id) => ctx.db.get(id)));
    return rows.filter((r): r is NonNullable<typeof r> => r !== null);
  },
});

// Lexical fallback retrieval when no embeddings exist: full-text over descriptions.
export const textSearch = internalQuery({
  args: { query: v.string(), limit: v.number() },
  handler: async (ctx, { query, limit }) => {
    if (!query.trim()) return [];
    return await ctx.db
      .query("subreddits")
      .withSearchIndex("search_description", (q) => q.search("description", query))
      .take(limit);
  },
});

// ---- Embedding backfill (one-time, gated on OPENAI_API_KEY) ----
//   npx convex run subreddits:backfillEmbeddings

export const page = internalQuery({
  args: { cursor: v.union(v.string(), v.null()), batch: v.number() },
  handler: async (ctx, { cursor, batch }) =>
    await ctx.db.query("subreddits").paginate({ cursor, numItems: batch }),
});

export const patchEmbedding = internalMutation({
  args: { id: v.id("subreddits"), embedding: v.array(v.float64()) },
  handler: async (ctx, { id, embedding }) => {
    await ctx.db.patch(id, { embedding });
  },
});

export const backfillEmbeddings = action({
  args: {},
  handler: async (ctx): Promise<{ embedded: number; skipped: number }> => {
    if (!hasEmbeddingCreds()) {
      throw new Error("OPENAI_API_KEY not set in Convex env — set it, then re-run to enable semantic RAG.");
    }
    let cursor: string | null = null;
    let embedded = 0;
    let skipped = 0;
    for (;;) {
      const res: PaginationResult<Doc<"subreddits">> = await ctx.runQuery(
        internal.subreddits.page,
        { cursor, batch: 100 },
      );
      const todo = res.page.filter((s) => !s.embedding);
      skipped += res.page.length - todo.length;
      if (todo.length) {
        const vectors = await embed(todo.map((s) => `${s.name}: ${s.description}`));
        await Promise.all(
          todo.map((s, i) =>
            ctx.runMutation(internal.subreddits.patchEmbedding, { id: s._id, embedding: vectors[i] }),
          ),
        );
        embedded += todo.length;
      }
      if (res.isDone) break;
      cursor = res.continueCursor;
    }
    return { embedded, skipped };
  },
});
