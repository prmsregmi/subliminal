import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import {
  hasRedditCreds,
  getRedditToken,
  searchReddit,
  type RedditPost,
} from "./lib/reddit";
import { hasApifyCreds, fetchSubredditSearch } from "./lib/apify";
import { computeSignals, computeBaseScore } from "./lib/scoring";
import { POSTS_PER_QUERY } from "./constants";

const SUBREDDIT_FETCH_LIMIT = 25;

// Target tier → draft-positioning kind, encoded into discoveredVia so drafts.ts
// knows how aggressively the product may appear (direct vs lateral).
function kindForTier(tier: number): string {
  return tier === 1 ? "direct" : tier === 2 ? "competitor" : tier === 3 ? "indirect" : "lateral";
}

// A subreddit's latest posts through the fallback chain: Apify (primary) →
// official Reddit API. The Monster demo seeds curated mock posts upstream in
// products.saveEnrichment, so this path runs for real products.
async function fetchPosts(subreddit: string, searchTerms: string[]): Promise<RedditPost[]> {
  if (hasApifyCreds()) {
    try {
      return await fetchSubredditSearch(subreddit, searchTerms, SUBREDDIT_FETCH_LIMIT);
    } catch (e) {
      console.error("[discover] apify failed, falling back to reddit:", subreddit, e);
    }
  }
  if (hasRedditCreds()) {
    const token = await getRedditToken();
    return await searchReddit(token, {
      query: searchTerms.join(" "),
      subreddit,
      sort: "relevance",
      t: "year",
      limit: SUBREDDIT_FETCH_LIMIT,
    });
  }
  throw new Error("No discovery source: set APIFY_TOKEN or REDDIT_CLIENT_ID/SECRET.");
}

// Pull one targeted subreddit's latest posts, score them locally, and write the
// top few as opportunities. Fanned out one-per-target from targeting.saveTargets.
export const runSubreddit = internalAction({
  args: {
    productId: v.id("products"),
    subreddit: v.string(),
    tier: v.number(),
    angle: v.optional(v.string()),
  },
  handler: async (ctx, { productId, subreddit, tier, angle }) => {
    const product = await ctx.runQuery(internal.products.getInternal, { productId });
    if (!product) return;

    try {
      // Search the product's core terms WITHIN this subreddit so the threads we
      // pull are on-topic, not just recent.
      const searchTerms = (product.ownKeywords.length ? product.ownKeywords : product.topicTerms)
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 2);
      if (!searchTerms.length && product.category) searchTerms.push(product.category);
      const posts = (await fetchPosts(subreddit, searchTerms)).filter((p) => !p.over_18);
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
        const permalink = p.permalink || "";
        await ctx.runMutation(internal.opportunities.upsert, {
          productId,
          redditId: p.id,
          subreddit: p.subreddit,
          title: p.title,
          body: (p.selftext || "").slice(0, 4000),
          permalink,
          url: permalink.startsWith("http")
            ? permalink
            : `https://www.reddit.com${permalink}`,
          author: p.author,
          score: p.score,
          numComments: p.num_comments,
          createdUtc: p.created_utc,
          discoveredVia: `${kindForTier(tier)}:${subreddit}`,
          targetTier: tier,
          angle,
          signals,
          baseScore,
        });
      }
    } catch (e) {
      // One failed subreddit shouldn't abort the whole discovery run.
      console.error("[discover] subreddit failed:", subreddit, e);
      await ctx.runMutation(internal.products.noteDiscoveryError, {
        productId,
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      await ctx.runMutation(internal.products.incrementSearchDone, { productId });
    }
  },
});
