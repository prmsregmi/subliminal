import { mutation, query, internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { DEFAULT_DISCLOSURE } from "./constants";
import { competitorTerms } from "./lib/scoring";
import {
  MAX_OWN_KEYWORD_QUERIES,
  MAX_COMPETITOR_QUERIES,
  MAX_TOPIC_QUERIES,
} from "./constants";

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
    topicTerms: v.array(v.string()),
    enrichmentRaw: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { productId, ...enrichment } = args;

    // Build a bounded set of Reddit search queries.
    const queries: Array<{ q: string; kind: string }> = [];
    const seen = new Set<string>();
    const add = (q: string, kind: string) => {
      const key = q.trim().toLowerCase();
      if (key.length < 2 || seen.has(key)) return;
      seen.add(key);
      queries.push({ q: q.trim(), kind });
    };
    enrichment.ownKeywords.slice(0, MAX_OWN_KEYWORD_QUERIES).forEach((k) => add(k, "own"));
    competitorTerms(enrichment.competitorDomains)
      .slice(0, MAX_COMPETITOR_QUERIES)
      .forEach((t) => add(t, "competitor"));
    enrichment.topicTerms.slice(0, MAX_TOPIC_QUERIES).forEach((t) => add(t, "topic"));

    await ctx.db.patch(productId, {
      ...enrichment,
      status: queries.length ? "discovering" : "ready",
      searchesTotal: queries.length,
      searchesDone: 0,
      discoveryError: undefined,
    });

    for (const { q, kind } of queries) {
      await ctx.scheduler.runAfter(0, internal.discover.runSearch, {
        productId,
        query: q,
        kind,
      });
    }
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
