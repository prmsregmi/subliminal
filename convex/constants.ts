// Tunable pipeline limits and shared defaults. Kept bounded so a live demo
// stays fast and cheap (each external call costs credits / latency).

// Default disclosure template. {{product}} is substituted at draft time.
// This is the configurable default the operator "keeps" — honesty by default.
export const DEFAULT_DISCLOSURE =
  "(Full disclosure: I work on {{product}} — mentioning it because it's genuinely relevant here, not to spam.)";

// Discovery breadth.
export const MAX_OWN_KEYWORD_QUERIES = 3;
export const MAX_COMPETITOR_QUERIES = 2;
export const MAX_TOPIC_QUERIES = 2;
export const POSTS_PER_QUERY = 6; // top-N by deterministic base score per search
export const MAX_OPPORTUNITIES_PER_PRODUCT = 30;

// Engagement gate thresholds (the anti-"BS meter" core of the algorithm).
export const SKIP_RISK_THRESHOLD = 0.7; // authenticityRisk above this => skip
export const MIN_ENGAGE_SCORE = 35; // finalScore below this => skip
export const CRITIC_SALESINESS_THRESHOLD = 5; // critic > this => regenerate once

// Scoring weights (sum to 100). This is OUR logic, not any API's.
export const WEIGHTS = {
  keywordOverlap: 40,
  competitorMention: 20,
  recency: 15,
  engagement: 20,
  subredditFit: 5,
};

// Final score blends deterministic base with the LLM's semantic relevance.
export const BASE_WEIGHT = 0.45;
export const SEMANTIC_WEIGHT = 0.55;

// Anthropic model ids.
export const MODEL_CLASSIFY = "claude-haiku-4-5";
export const MODEL_DRAFT = "claude-sonnet-4-6";
export const MODEL_CRITIC = "claude-haiku-4-5";
