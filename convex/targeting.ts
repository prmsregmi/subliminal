import { internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { generateObject } from "./lib/orangeslice";
import { embed, hasEmbeddingCreds } from "./lib/embeddings";
import { ANGLE_GENERATION_SKILL, TIERING_SKILL } from "./lib/skill";
import { RAG_PER_ANGLE, MAX_CANDIDATE_POOL, MAX_TARGETS } from "./constants";

const ANGLES_SCHEMA = {
  type: "object",
  properties: {
    angles: {
      type: "array",
      description: "20-40 diverse natural-language subreddit search queries",
      items: {
        type: "object",
        properties: {
          dimension: { type: "string", description: "which product dimension this query targets" },
          query: { type: "string", description: "natural-language community search query" },
        },
        required: ["query"],
      },
    },
  },
  required: ["angles"],
};

const TARGETS_SCHEMA = {
  type: "object",
  properties: {
    targets: {
      type: "array",
      items: {
        type: "object",
        properties: {
          subreddit: { type: "string", description: "exact name from the candidate pool, no r/ prefix" },
          tier: { type: "number", description: "1 direct, 2 competitor, 3 indirect, 4 lateral" },
          reason: { type: "string", description: "one line on why it fits" },
          angles: { type: "array", items: { type: "string" }, description: "1-3 angle directions" },
        },
        required: ["subreddit", "tier"],
      },
    },
  },
  required: ["targets"],
};

interface Angle {
  dimension?: string;
  query: string;
}
interface RawTarget {
  subreddit: string;
  tier: number;
  reason?: string;
  angles?: string[];
}

// The targeting skill, end to end: decompose the product into wide search angles
// (Phase 1), retrieve candidate subreddits from the catalog via RAG, then score
// and tier ~50 of them (Phase 2). Fans out subreddit discovery for the winners.
export const run = internalAction({
  args: { productId: v.id("products") },
  handler: async (ctx, { productId }) => {
    const product = await ctx.runQuery(internal.products.getInternal, { productId });
    if (!product) return;

    try {
      const brief = [
        `Product: ${product.name || product.domain} (${product.domain})`,
        product.summary ? `Summary: ${product.summary}` : "",
        product.category ? `Category: ${product.category}` : "",
        `Own keywords: ${product.ownKeywords.join(", ")}`,
        `Competitors: ${product.competitorDomains.join(", ")}`,
        `Complements: ${product.complementaryDomains.join(", ")}`,
        `Topic terms: ${product.topicTerms.join(", ")}`,
      ]
        .filter(Boolean)
        .join("\n");

      // --- Phase 1: wide net of search angles ---
      const a = await generateObject<{ angles?: Angle[] }>(
        `${brief}\n\nGenerate the wide net of subreddit search queries.`,
        ANGLES_SCHEMA,
        { system: ANGLE_GENERATION_SKILL, intelligence: "low" },
      );
      const angles = (a.angles ?? [])
        .map((x) => x.query)
        .filter((q) => typeof q === "string" && q.trim())
        .slice(0, 40);
      if (!angles.length) angles.push(product.category || product.domain);

      // --- Retrieval: RAG over the subreddit catalog ---
      const pool = new Map<string, string>(); // name -> description
      if (hasEmbeddingCreds()) {
        const vectors = await embed(angles);
        for (const vector of vectors) {
          const hits = await ctx.vectorSearch("subreddits", "by_embedding", {
            vector,
            limit: RAG_PER_ANGLE,
          });
          const docs = await ctx.runQuery(internal.subreddits.byIds, {
            ids: hits.map((h) => h._id),
          });
          for (const d of docs) pool.set(d.name, d.description);
        }
      } else {
        for (const query of angles) {
          const docs = await ctx.runQuery(internal.subreddits.textSearch, {
            query,
            limit: RAG_PER_ANGLE,
          });
          for (const d of docs) pool.set(d.name, d.description);
        }
      }
      const candidates = [...pool.entries()].slice(0, MAX_CANDIDATE_POOL);

      // --- Phase 2: score + tier the pool ---
      const poolText = candidates.map(([name, desc]) => `r/${name} — ${desc}`).join("\n");
      const t = await generateObject<{ targets?: RawTarget[] }>(
        `${brief}\n\nCANDIDATE POOL (pick only from these, names exactly as written):\n${poolText}\n\nSelect and tier up to ${MAX_TARGETS} subreddits.`,
        TARGETS_SCHEMA,
        { system: TIERING_SKILL, intelligence: "low" },
      );

      const valid = new Set([...pool.keys()].map((n) => n.toLowerCase()));
      const targets = (t.targets ?? [])
        .map((x) => ({
          subreddit: String(x.subreddit || "").replace(/^\/?r\//i, "").trim(),
          tier: Math.min(4, Math.max(1, Math.round(Number(x.tier) || 3))),
          reason: String(x.reason || ""),
          angles: Array.isArray(x.angles) ? x.angles.map(String).slice(0, 3) : [],
        }))
        .filter((x) => x.subreddit && valid.has(x.subreddit.toLowerCase()))
        .slice(0, MAX_TARGETS);

      await ctx.runMutation(internal.targeting.saveTargets, { productId, targets });
    } catch (e) {
      console.error("[targeting] failed:", e);
      await ctx.runMutation(internal.products.setError, {
        productId,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  },
});

export const saveTargets = internalMutation({
  args: {
    productId: v.id("products"),
    targets: v.array(
      v.object({
        subreddit: v.string(),
        tier: v.number(),
        reason: v.string(),
        angles: v.array(v.string()),
      }),
    ),
  },
  handler: async (ctx, { productId, targets }) => {
    // Idempotent: clear any prior target list for this product first.
    const prior = await ctx.db
      .query("targets")
      .withIndex("by_product", (q) => q.eq("productId", productId))
      .collect();
    for (const p of prior) await ctx.db.delete(p._id);
    for (const t of targets) {
      await ctx.db.insert("targets", { productId, ...t, createdAt: Date.now() });
    }

    await ctx.db.patch(productId, {
      status: targets.length ? "discovering" : "ready",
      searchesTotal: targets.length,
      searchesDone: 0,
      discoveryError: undefined,
    });
    for (const t of targets) {
      await ctx.scheduler.runAfter(0, internal.discover.runSubreddit, {
        productId,
        subreddit: t.subreddit,
        tier: t.tier,
        angle: t.angles[0],
      });
    }
  },
});
