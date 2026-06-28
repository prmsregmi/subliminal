// Tunable pipeline limits and shared defaults. Kept bounded so a live demo
// stays fast and cheap (each external call costs credits / latency).

// Default disclosure template. {{product}} is substituted at draft time.
// This is the configurable default the operator "keeps" — honesty by default.
export const DEFAULT_DISCLOSURE =
  "(Full disclosure: I work on {{product}} — mentioning it because it's genuinely relevant here, not to spam.)";

// Discovery breadth.
export const MAX_OWN_KEYWORD_QUERIES = 3;
export const MAX_COMPETITOR_QUERIES = 2;
export const MAX_COMPLEMENT_QUERIES = 2;
export const MAX_TOPIC_QUERIES = 2;
export const POSTS_PER_QUERY = 6; // top-N by deterministic base score per search
export const MAX_OPPORTUNITIES_PER_PRODUCT = 30;

// Subreddit targeting (skill-driven RAG match).
export const RAG_PER_ANGLE = 8; // candidates retrieved per search angle
export const MAX_CANDIDATE_POOL = 150; // cap on the pool handed to Phase-2 tiering
export const MAX_TARGETS = 50; // tiered target subreddits per product

// Engagement gate thresholds (the anti-"BS meter" core of the algorithm).
export const SKIP_RISK_THRESHOLD = 0.7; // authenticityRisk above this => skip
export const MIN_ENGAGE_SCORE = 20; // finalScore below this => skip
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

// LLM model ids per provider + role. The active provider is chosen at runtime by
// the LLM_PROVIDER env var (see convex/lib/llm.ts); OpenAI ids are overridable
// per role via OPENAI_MODEL_CLASSIFY / OPENAI_MODEL_DRAFT / OPENAI_MODEL_CRITIC.
export const LLM_MODELS = {
  anthropic: {
    classify: "claude-haiku-4-5",
    draft: "claude-sonnet-4-6",
    critic: "claude-haiku-4-5",
  },
  // gpt-5.5 is a reasoning model: reasoning tokens count toward
  // max_completion_tokens, so openai_llm.ts adds headroom over each call's output
  // budget and sets reasoning_effort (default "low", env OPENAI_REASONING_EFFORT).
  // Override a role's model without a deploy via OPENAI_MODEL_<ROLE>.
  openai: {
    classify: "gpt-5.5",
    draft: "gpt-5.5",
    critic: "gpt-5.5",
  },
} as const;

export type LlmRole = "classify" | "draft" | "critic";

// Label tag for mock-seeded drafts (offline demo path).
export const MODEL_DRAFT = LLM_MODELS.anthropic.draft;
