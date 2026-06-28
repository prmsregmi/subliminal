// Deterministic relevance scoring + classification helpers.
//
// This is the part the spec requires to be "ours, not the API's": transparent,
// cheap signals computed locally. The semantic judgment (classification,
// authenticity risk, response type) is delegated to the LLM in classify.ts and
// blended with these signals to produce the final score.

import { WEIGHTS, BASE_WEIGHT, SEMANTIC_WEIGHT } from "../constants";

export interface RedditPostLite {
  title: string;
  body: string;
  subreddit: string;
  score: number;
  numComments: number;
  createdUtc: number; // seconds
}

export interface ProductTerms {
  ownKeywords: string[];
  competitorDomains: string[];
  topicTerms: string[];
}

export interface Signals {
  matchedKeywords: string[];
  matchedCompetitors: string[];
  keywordOverlap: number; // 0..1
  competitorMention: boolean;
  recency: number; // 0..1
  engagement: number; // 0..1
  subredditFit: number; // 0..1
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

// Reduce a competitor domain ("coca-cola.com", "https://www.spindrift.com/")
// to brand terms we can match in free text: "coca-cola" and "coca cola".
export function competitorTerms(domains: string[]): string[] {
  const terms = new Set<string>();
  for (const raw of domains) {
    const host = raw
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split("/")[0]
      .trim()
      .toLowerCase();
    if (!host) continue;
    const brand = host.split(".")[0];
    if (brand.length >= 3) {
      terms.add(brand);
      if (brand.includes("-")) terms.add(brand.replace(/-/g, " "));
    }
  }
  return Array.from(terms);
}

// Word-boundary match (not bare substring) so "ai" doesn't match "rain" and
// "canva" doesn't match "canvas". Phrases are matched whole, bounded by non-
// alphanumerics on each side.
function present(haystack: string, term: string): boolean {
  const t = term.trim().toLowerCase();
  if (t.length < 3) return false;
  const esc = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![a-z0-9])${esc}(?![a-z0-9])`, "i").test(haystack);
}

export function computeSignals(
  post: RedditPostLite,
  product: ProductTerms,
  nowMs: number,
): Signals {
  const title = post.title.toLowerCase();
  const body = (post.body || "").toLowerCase();
  const sub = post.subreddit.toLowerCase();

  // Keyword overlap: title presence weighs more than body presence.
  const terms = Array.from(
    new Set(
      [...product.ownKeywords, ...product.topicTerms]
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length >= 2),
    ),
  );
  const matchedKeywords: string[] = [];
  let overlapSum = 0;
  for (const term of terms) {
    const inTitle = present(title, term);
    const inBody = present(body, term);
    if (inTitle || inBody) matchedKeywords.push(term);
    overlapSum += inTitle ? 1 : inBody ? 0.5 : 0;
  }
  const keywordOverlap = terms.length ? clamp01(overlapSum / terms.length) : 0;

  // Competitor mentions.
  const compTerms = competitorTerms(product.competitorDomains);
  const text = `${title} ${body}`;
  const matchedCompetitors = compTerms.filter((c) => present(text, c));
  const competitorMention = matchedCompetitors.length > 0;

  // Recency: exponential decay, ~72h characteristic time.
  const ageHours = Math.max(0, (nowMs / 1000 - post.createdUtc) / 3600);
  const recency = clamp01(Math.exp(-ageHours / 72));

  // Engagement: log-scaled discussion volume, lightly penalize giant threads
  // (a new comment gets buried in a 5k-upvote post). Clamp volume first —
  // Reddit scores can be negative, and log10 of a negative is NaN.
  const volume = Math.max(0, post.score) + Math.max(0, post.numComments);
  let engagement = clamp01(Math.log10(volume + 1) / 3.5);
  if (post.score > 5000) engagement *= 0.85;

  // Subreddit fit: does the subreddit name relate to our terms?
  const subredditFit = terms.some((t) => sub.includes(t) || t.includes(sub))
    ? 1
    : 0.3;

  return {
    matchedKeywords,
    matchedCompetitors,
    keywordOverlap,
    competitorMention,
    recency,
    engagement,
    subredditFit,
  };
}

export function computeBaseScore(s: Signals): number {
  const raw =
    s.keywordOverlap * WEIGHTS.keywordOverlap +
    (s.competitorMention ? 1 : 0) * WEIGHTS.competitorMention +
    s.recency * WEIGHTS.recency +
    s.engagement * WEIGHTS.engagement +
    s.subredditFit * WEIGHTS.subredditFit;
  return Math.round(Math.max(0, Math.min(100, raw)));
}

// Blend deterministic base with the LLM's 0..100 semantic relevance.
export function combineScores(base: number, semantic: number): number {
  return Math.round(base * BASE_WEIGHT + semantic * SEMANTIC_WEIGHT);
}
