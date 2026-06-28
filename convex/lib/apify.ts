// Apify Reddit client — PRIMARY discovery source. Searches the product's
// keywords WITHIN a target subreddit (via the harshmaur actor's scoped keyword
// search) so we surface posts that are actually ON-TOPIC for the product, not
// just whatever is newest. Maps onto the shared RedditPost shape; when this
// throws, discovery falls back to the official Reddit API.
import type { RedditPost } from "./reddit";

// actor id in tilde form; override with APIFY_REDDIT_ACTOR. harshmaur supports
// searchTerms + withinCommunity scoping and needs no proxy config.
const ACTOR = process.env.APIFY_REDDIT_ACTOR || "harshmaur~reddit-scraper";

export function hasApifyCreds(): boolean {
  return Boolean(process.env.APIFY_TOKEN);
}

interface HarshPost {
  id?: string; // t3_<id>
  parsedId?: string; // bare id
  title?: string;
  body?: string;
  authorName?: string;
  parsedCommunityName?: string; // bare subreddit
  score?: number;
  commentsCount?: number;
  createdAt?: string; // ISO 8601
  postUrl?: string; // full reddit URL
  over18?: boolean;
  dataType?: string; // "post" | "comment"
}

export async function fetchSubredditSearch(
  subreddit: string,
  searchTerms: string[],
  limit = 25,
): Promise<RedditPost[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN not set in Convex env.");
  const sub = subreddit.replace(/^\/?r\//i, "").trim();
  const terms = searchTerms.map((t) => t.trim()).filter(Boolean).slice(0, 4);
  if (!terms.length) return [];

  const res = await fetch(
    `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        searchTerms: terms,
        withinCommunity: `r/${sub}`,
        maxItems: limit,
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`[apify] r/${sub} ${res.status}: ${await res.text()}`);
  }
  const items = (await res.json()) as HarshPost[];
  if (!Array.isArray(items)) return [];

  const nowSec = Math.floor(Date.now() / 1000);
  return items
    .filter((p) => p && p.dataType !== "comment" && (p.title || p.body))
    .map((p) => {
      const id = p.parsedId || (p.id || "").replace(/^t3_/, "");
      const permalink = (p.postUrl || "").replace(/^https?:\/\/(www\.)?reddit\.com/i, "");
      return {
        id,
        name: `t3_${id}`,
        title: p.title || "",
        selftext: p.body || "",
        subreddit: (p.parsedCommunityName || sub).replace(/^\/?r\//i, ""),
        score: Number(p.score) || 0,
        num_comments: Number(p.commentsCount) || 0,
        created_utc: p.createdAt ? Math.floor(new Date(p.createdAt).getTime() / 1000) : nowSec,
        permalink: permalink || p.postUrl || "",
        author: p.authorName || "",
        over_18: Boolean(p.over18),
      } satisfies RedditPost;
    });
}
