import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getRedditToken, searchReddit } from "./lib/reddit";
import { computeSignals, computeBaseScore } from "./lib/scoring";
import { POSTS_PER_QUERY } from "./constants";

// One authenticated Reddit search; scores results locally and writes the top
// few as opportunities. Runs once per discovery query (fanned out from enrich).
export const runSearch = internalAction({
  args: { productId: v.id("products"), query: v.string(), kind: v.string() },
  handler: async (ctx, { productId, query, kind }) => {
    const product = await ctx.runQuery(internal.products.getInternal, { productId });
    if (!product) return;

    let token: string;
    try {
      token = await getRedditToken();
    } catch (e) {
      // Systemic failure (bad/missing creds) — surface it instead of a silent empty queue.
      console.error("[discover] Reddit auth failed:", e);
      await ctx.runMutation(internal.products.noteDiscoveryError, {
        productId,
        message: e instanceof Error ? e.message : String(e),
      });
      await ctx.runMutation(internal.products.incrementSearchDone, { productId });
      return;
    }

    try {
      const posts = (
        await searchReddit(token, { query, sort: "relevance", t: "year", limit: 25 })
      ).filter((p) => !p.over_18);

      const now = Date.now();
      const terms = {
        ownKeywords: product.ownKeywords,
        competitorDomains: product.competitorDomains,
        topicTerms: product.topicTerms,
      };

      const scored = posts
        .map((p) => {
          const signals = computeSignals(
            {
              title: p.title,
              body: p.selftext || "",
              subreddit: p.subreddit,
              score: p.score,
              numComments: p.num_comments,
              createdUtc: p.created_utc,
            },
            terms,
            now,
          );
          return { p, signals, baseScore: computeBaseScore(signals) };
        })
        .sort((a, b) => b.baseScore - a.baseScore)
        .slice(0, POSTS_PER_QUERY);

      for (const { p, signals, baseScore } of scored) {
        await ctx.runMutation(internal.opportunities.upsert, {
          productId,
          redditId: p.id,
          subreddit: p.subreddit,
          title: p.title,
          body: (p.selftext || "").slice(0, 4000),
          permalink: p.permalink,
          url: `https://www.reddit.com${p.permalink}`,
          author: p.author,
          score: p.score,
          numComments: p.num_comments,
          createdUtc: p.created_utc,
          discoveredVia: `${kind}:${query}`,
          signals,
          baseScore,
        });
      }
    } catch (e) {
      // One failed search shouldn't abort the whole discovery run.
      console.error("[discover] search failed:", query, e);
      await ctx.runMutation(internal.products.noteDiscoveryError, {
        productId,
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      await ctx.runMutation(internal.products.incrementSearchDone, { productId });
    }
  },
});
