import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import {
  scrapeWebsite,
  webSearch,
  generateObject,
  type WebSearchResult,
} from "./lib/orangeslice";

// Schema OrangeSlice's AI fills in from the scraped site + competitor SERP.
const ENRICH_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string", description: "Product or company name" },
    category: { type: "string", description: "Primary product category" },
    summary: { type: "string", description: "One sentence: what the product is" },
    ownKeywords: {
      type: "array",
      items: { type: "string" },
      description: "3-6 short search terms describing this product and what it does",
    },
    competitorDomains: {
      type: "array",
      items: { type: "string" },
      description:
        "3-6 competitor website domains people would choose INSTEAD of this product (substitutes), e.g. example.com",
    },
    complementaryDomains: {
      type: "array",
      items: { type: "string" },
      description:
        "3-6 website domains of products this one COMPLEMENTS — used alongside it, not instead of it (integrations, companion tools), e.g. example.com",
    },
    topicTerms: {
      type: "array",
      items: { type: "string" },
      description:
        "4-8 phrases real people use on Reddit when discussing this product space or the problems it solves",
    },
  },
  required: [
    "category",
    "ownKeywords",
    "competitorDomains",
    "complementaryDomains",
    "topicTerms",
  ],
};

interface EnrichmentObject {
  name?: unknown;
  category?: unknown;
  summary?: unknown;
  ownKeywords?: unknown;
  competitorDomains?: unknown;
  complementaryDomains?: unknown;
  topicTerms?: unknown;
}

function cleanList(arr: unknown): string[] {
  return Array.isArray(arr)
    ? arr.map((x) => String(x).trim()).filter(Boolean).slice(0, 8)
    : [];
}

function bareDomain(d: string): string {
  return d
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0]
    .trim()
    .toLowerCase();
}

// OrangeSlice enrichment: scrape the site, run two searches (competitors +
// complementary products), then have OrangeSlice's AI distill
// { ownKeywords, competitorDomains, complementaryDomains, topicTerms }.
export const run = internalAction({
  args: { productId: v.id("products") },
  handler: async (ctx, { productId }) => {
    const product = await ctx.runQuery(internal.products.getInternal, { productId });
    if (!product) return;
    try {
      const scrape = await scrapeWebsite(product.url);
      const markdown = (scrape.markdown || scrape.data?.[0]?.markdown || "").slice(0, 6000);
      const brand = product.domain.split(".")[0];

      // Two distinct searches: substitutes (compete with us) and complements
      // (used alongside us). Run concurrently — independent calls.
      const fmtSerp = (s: { results?: WebSearchResult[] }) =>
        (s.results ?? [])
          .slice(0, 8)
          .map((r) => `- ${r.title} — ${r.link}${r.snippet ? ` — ${r.snippet}` : ""}`)
          .join("\n");
      const [competitorSerp, complementSerp] = await Promise.all([
        webSearch(`${brand} alternatives vs competitors review`),
        webSearch(`tools and products that work with ${brand} integrations`),
      ]);
      const competitorText = fmtSerp(competitorSerp);
      const complementText = fmtSerp(complementSerp);

      const prompt = [
        "Analyze this product so we can find relevant Reddit discussions to engage with honestly.",
        `Product domain: ${product.domain}`,
        "",
        "--- Website content (markdown) ---",
        markdown || "(scrape returned no content)",
        "",
        "--- Web search: competitors / alternatives (substitutes — chosen INSTEAD of this product) ---",
        competitorText || "(no results)",
        "",
        "--- Web search: complementary / related products (used ALONGSIDE this product) ---",
        complementText || "(no results)",
        "",
        "Extract: the product's own keywords; competitor domains (substitutes); complementary domains (products this one is used alongside / integrates with); and the topic terms/phrases people actually use on Reddit when discussing this space.",
      ].join("\n");

      const obj = await generateObject<EnrichmentObject>(prompt, ENRICH_SCHEMA, {
        intelligence: "low",
      });

      await ctx.runMutation(internal.products.saveEnrichment, {
        productId,
        name: typeof obj.name === "string" ? obj.name : undefined,
        category: typeof obj.category === "string" ? obj.category : undefined,
        summary: typeof obj.summary === "string" ? obj.summary : undefined,
        ownKeywords: cleanList(obj.ownKeywords),
        competitorDomains: cleanList(obj.competitorDomains).map(bareDomain),
        complementaryDomains: cleanList(obj.complementaryDomains).map(bareDomain),
        topicTerms: cleanList(obj.topicTerms),
        enrichmentRaw: {
          competitorSerp: competitorText.slice(0, 2000),
          complementSerp: complementText.slice(0, 2000),
        },
      });
    } catch (e) {
      await ctx.runMutation(internal.products.setError, {
        productId,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  },
});
