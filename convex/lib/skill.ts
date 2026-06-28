// Subreddit-targeting methodology used as LLM context for both targeting phases.
// The full skill ships verbatim in skill_text.ts (generated from
// finding-matching-subreddit.md); each phase rides a short focus directive on top
// of it, mirroring how drafts.ts pairs CONTENT_SKILL with its per-call craft rules.
import { SUBREDDIT_TARGETING_SKILL } from "./skill_text";

const SEP = "\n\n---\n\n";

// Phase 1 focus: emit only the wide net of search angles for this product.
const ANGLE_PHASE = [
  "TASK NOW — PHASE 1 ONLY (cast wide).",
  "Apply the methodology above to THIS product. Decompose it across every applicable dimension and output the wide net of natural-language subreddit search queries (aim for 20-40, one or two per populated dimension).",
  "Output only the queries. Do NOT score, tier, or select subreddits — Phase 2 runs as a separate call.",
].join("\n");

// Phase 2 focus: score + tier the already-retrieved candidate pool.
const TIERING_PHASE = [
  "TASK NOW — PHASE 2 ONLY (narrow).",
  "Phase 1 has already run; a CANDIDATE POOL retrieved from the database is provided in the user message. Apply the Phase 2 scoring rubric, tiers, and backfill rules to select and tier up to ~50 subreddits FROM THE POOL ONLY, using subreddit names exactly as written. Never invent a subreddit that is not in the pool.",
  "For each pick give its tier (1 direct, 2 competitor, 3 indirect, 4 lateral), a one-line reason, and 1-3 reusable angle directions (correlations a human poster leans on, not finished posts).",
].join("\n");

export const ANGLE_GENERATION_SKILL = `${SUBREDDIT_TARGETING_SKILL}${SEP}${ANGLE_PHASE}`;
export const TIERING_SKILL = `${SUBREDDIT_TARGETING_SKILL}${SEP}${TIERING_PHASE}`;
