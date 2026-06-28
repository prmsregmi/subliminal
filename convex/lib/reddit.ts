// Reddit API client — authenticated (application-only OAuth2) reads for rate
// stability during a live demo. Runs in the default Convex runtime (plain
// fetch + a tiny base64 encoder, no Node Buffer/btoa dependency).

const TOKEN_URL = "https://www.reddit.com/api/v1/access_token";
const OAUTH_BASE = "https://oauth.reddit.com";

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function base64(input: string): string {
  let out = "";
  for (let i = 0; i < input.length; i += 3) {
    const a = input.charCodeAt(i);
    const b = i + 1 < input.length ? input.charCodeAt(i + 1) : NaN;
    const c = i + 2 < input.length ? input.charCodeAt(i + 2) : NaN;
    const e1 = a >> 2;
    const e2 = ((a & 3) << 4) | (isNaN(b) ? 0 : b >> 4);
    const e3 = isNaN(b) ? 64 : ((b & 15) << 2) | (isNaN(c) ? 0 : c >> 6);
    const e4 = isNaN(c) ? 64 : c & 63;
    out += B64[e1] + B64[e2] + (e3 === 64 ? "=" : B64[e3]) + (e4 === 64 ? "=" : B64[e4]);
  }
  return out;
}

function userAgent(): string {
  return process.env.REDDIT_USER_AGENT || "web:vibeseed:v0.1.0 (by /u/vibeseed_app)";
}

export async function getRedditToken(): Promise<string> {
  const id = process.env.REDDIT_CLIENT_ID;
  const secret = process.env.REDDIT_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error(
      "REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET not set in Convex env. Run `pnpm run secrets`.",
    );
  }
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${base64(`${id}:${secret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": userAgent(),
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    throw new Error(`[reddit] token request failed ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("[reddit] token response missing access_token");
  return data.access_token;
}

export interface RedditPost {
  id: string;
  name: string; // fullname, e.g. t3_abc123
  title: string;
  selftext: string;
  subreddit: string;
  score: number;
  num_comments: number;
  created_utc: number;
  permalink: string;
  author: string;
  over_18: boolean;
}

export async function searchReddit(
  token: string,
  params: { query: string; subreddit?: string; sort?: string; t?: string; limit?: number },
): Promise<RedditPost[]> {
  const { query, subreddit, sort = "relevance", t = "month", limit = 25 } = params;
  const path = subreddit ? `/r/${encodeURIComponent(subreddit)}/search` : `/search`;
  const url = new URL(OAUTH_BASE + path);
  url.searchParams.set("q", query);
  url.searchParams.set("sort", sort);
  url.searchParams.set("t", t);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("type", "link");
  if (subreddit) url.searchParams.set("restrict_sr", "1");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, "User-Agent": userAgent() },
  });
  if (!res.ok) {
    throw new Error(`[reddit] search failed ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    data?: { children?: Array<{ kind: string; data: RedditPost }> };
  };
  const children = data?.data?.children ?? [];
  return children.filter((c) => c.kind === "t3").map((c) => c.data);
}
