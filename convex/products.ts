import { mutation, query, internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { DEFAULT_DISCLOSURE } from "./constants";
import { isMonsterDomain, MONSTER_OPP_COUNT } from "./mock";

function toDomain(rawUrl: string): string {
  let s = rawUrl.trim();
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    return new URL(s).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return rawUrl.trim().toLowerCase();
  }
}

function normalizeUrl(rawUrl: string): string {
  let s = rawUrl.trim();
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  return s;
}

// ---- Public API ----

// Entry point: user submits a product website URL.
export const submitProduct = mutation({
  args: { url: v.string() },
  handler: async (ctx, { url }) => {
    const domain = toDomain(url);
    if (!domain.includes(".") || domain.length < 3) {
      throw new Error("Enter a valid product website URL (e.g. your-product.com).");
    }
    const productId = await ctx.db.insert("products", {
      url: normalizeUrl(url),
      domain,
      status: "enriching",
      ownKeywords: [],
      competitorDomains: [],
      complementaryDomains: [],
      topicTerms: [],
      disclosureTemplate: DEFAULT_DISCLOSURE,
      searchesTotal: 0,
      searchesDone: 0,
      createdAt: Date.now(),
    });
    // Kick off OrangeSlice enrichment.
    await ctx.scheduler.runAfter(0, internal.enrich.run, { productId });
    return productId;
  },
});

export const get = query({
  args: { productId: v.id("products") },
  handler: async (ctx, { productId }) => ctx.db.get(productId),
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("products").collect();
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const updateDisclosure = mutation({
  args: { productId: v.id("products"), disclosureTemplate: v.string() },
  handler: async (ctx, { productId, disclosureTemplate }) => {
    // The disclosure line is the core honesty guarantee — never let it be emptied.
    if (!disclosureTemplate.trim()) {
      throw new Error("Disclosure template can't be empty.");
    }
    await ctx.db.patch(productId, { disclosureTemplate });
  },
});

// ---- Internal ----

export const getInternal = internalQuery({
  args: { productId: v.id("products") },
  handler: async (ctx, { productId }) => ctx.db.get(productId),
});

// Persist OrangeSlice enrichment, then fan out Reddit discovery searches.
export const saveEnrichment = internalMutation({
  args: {
    productId: v.id("products"),
    name: v.optional(v.string()),
    category: v.optional(v.string()),
    summary: v.optional(v.string()),
    ownKeywords: v.array(v.string()),
    competitorDomains: v.array(v.string()),
    complementaryDomains: v.array(v.string()),
    topicTerms: v.array(v.string()),
    enrichmentRaw: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { productId, ...enrichment } = args;
    const productDoc = await ctx.db.get(productId);

    // Monster demo: mock the Reddit discovery ONLY for monsterenergy.com — so the
    // curated White Monster queue looks legit without live Reddit access. Every
    // other product runs the real targeting + discovery pipeline below.
    if (isMonsterDomain(productDoc?.domain ?? "")) {
      await ctx.db.patch(productId, {
        ...enrichment,
        status: "discovering",
        searchesTotal: MONSTER_OPP_COUNT,
        searchesDone: 0,
        discoveryError: undefined,
      });
      // Pace discovery like real Reddit search: an initial search round-trip,
      // then results trickle in over ~15s with uneven gaps — not an instant dump
      // that gives the mock away. Gaps are deterministic (no Math.random in a
      // mutation) but irregular so it doesn't look metronomic.
      let delay = 1600;
      for (let i = 0; i < MONSTER_OPP_COUNT; i++) {
        await ctx.scheduler.runAfter(delay, internal.mock.seedOpportunity, {
          productId,
          index: i,
        });
        delay += 700 + ((i * 7 + 3) % 13) * 85; // ~0.7–1.7s, uneven
      }
      await ctx.scheduler.runAfter(delay + 600, internal.mock.seedPosts, {
        productId,
      });
      return;
    }

    // Real products: persist enrichment, then run the subreddit-targeting skill
    // (Phase 1 angles → RAG match → Phase 2 tiering). targeting.saveTargets sets
    // searchesTotal and fans out per-subreddit discovery once the list is known.
    await ctx.db.patch(productId, {
      ...enrichment,
      status: "discovering",
      searchesTotal: 0,
      searchesDone: 0,
      discoveryError: undefined,
    });
    await ctx.scheduler.runAfter(0, internal.targeting.run, { productId });
  },
});

export const setError = internalMutation({
  args: { productId: v.id("products"), message: v.string() },
  handler: async (ctx, { productId, message }) => {
    await ctx.db.patch(productId, { status: "error", errorMessage: message });
  },
});

// Records a discovery-time failure (e.g. Reddit auth) without failing the whole
// product, so the dashboard can warn instead of showing a silent empty queue.
export const noteDiscoveryError = internalMutation({
  args: { productId: v.id("products"), message: v.string() },
  handler: async (ctx, { productId, message }) => {
    await ctx.db.patch(productId, { discoveryError: message.slice(0, 200) });
  },
});

// Called as each discovery search finishes; flips product to "ready" when done.
export const incrementSearchDone = internalMutation({
  args: { productId: v.id("products") },
  handler: async (ctx, { productId }) => {
    const p = await ctx.db.get(productId);
    if (!p) return;
    const done = p.searchesDone + 1;
    await ctx.db.patch(productId, {
      searchesDone: done,
      status: done >= p.searchesTotal ? "ready" : p.status,
    });
  },
});

// Business-facing metrics ONLY — aggregate counts, never the drafts or schedule
// (those live in the separate employee console). Powers the main dashboard.
export const metrics = query({
  args: { productId: v.id("products") },
  handler: async (ctx, { productId }) => {
    const opps = await ctx.db
      .query("opportunities")
      .withIndex("by_product", (q) => q.eq("productId", productId))
      .collect();
    const targets = await ctx.db
      .query("targets")
      .withIndex("by_product", (q) => q.eq("productId", productId))
      .collect();
    const byTier = [0, 0, 0, 0]; // tiers 1..4
    if (targets.length) {
      for (const t of targets) {
        if (t.tier >= 1 && t.tier <= 4) byTier[t.tier - 1]++;
      }
    } else {
      const seenSubreddits = new Set<string>();
      for (const o of opps) {
        const key = `${o.subreddit.toLowerCase()}:${o.targetTier ?? o.discoveredVia}`;
        if (seenSubreddits.has(key)) continue;
        seenSubreddits.add(key);
        if (o.targetTier && o.targetTier >= 1 && o.targetTier <= 4) {
          byTier[o.targetTier - 1]++;
        } else if (o.discoveredVia.startsWith("own:")) {
          byTier[0]++;
        } else if (o.discoveredVia.startsWith("competitor:")) {
          byTier[1]++;
        } else if (o.discoveredVia.startsWith("topic:")) {
          byTier[2]++;
        } else {
          byTier[3]++;
        }
      }
    }
    const fallbackTargets = new Set(opps.map((o) => o.subreddit.toLowerCase())).size;
    return {
      targets: targets.length || fallbackTargets,
      byTier,
      discovered: opps.length,
      engage: opps.filter((o) => o.recommendation === "engage").length,
      skip: opps.filter((o) => o.recommendation === "skip").length,
      drafted: opps.filter((o) => o.pipelineStage === "drafted").length,
      posted: opps.filter((o) => o.status === "completed").length,
      avgScore: opps.length
        ? Math.round(opps.reduce((a, o) => a + o.relevanceScore, 0) / opps.length)
        : 0,
    };
  },
});
