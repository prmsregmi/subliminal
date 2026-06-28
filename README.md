# SUBLIMINAL

**Subliminal Reddit marketing intelligence.** Submit a product website. SUBLIMINAL
profiles the brand, decomposes it into dozens of search angles, matches it with RAG
against a catalog of ~1,800 subreddits, pulls what those communities are actually
talking about, and surfaces the exact threads where a **disclosed, value-first**
comment would be welcome — then hands a human posting team a schedule of *what* to
post and *when*, spaced so Reddit's moderators never see a coordinated burst.

The hard part of Reddit marketing isn't writing the comment. It's (1) finding the
non-obvious communities where your product can surface as an organic detail rather
than an ad, and (2) posting into them at a cadence that doesn't trip a mod's radar.
SUBLIMINAL automates both.

> **On "subliminal."** This means surfacing the *subliminal-fit* communities a naive
> keyword search never returns — a recycling sub for an aluminum-canned drink, a
> night-shift sub for caffeine — where the community's own topic leads and the
> product is an incidental detail. It does **not** mean deception: every draft
> carries a disclosure line, and the engagement gate actively **skips** any thread
> where a mention would read as marketing. Honest content, non-obvious placement.

---

## The pipeline (happy path)

```
1. PROFILE      products.submitProduct → enrich.run (OrangeSlice)
                scrape site + 2 SERP searches → { ownKeywords, competitorDomains,
                complementaryDomains, topicTerms }

2. CAST WIDE    targeting.run · Phase 1 (OrangeSlice LLM + subreddit-targeting skill)
                decompose the product across ~14 dimensions (material, ritual, pain,
                gifting, non-consumption alternatives, …) → 20–40 search angles

3. MATCH (RAG)  targeting.run · retrieval  (Convex vector search over the catalog)
                embed each angle (OpenAI) → vectorSearch the subreddits table →
                pooled candidate communities   [full-text fallback when no key]

4. TIER         targeting.run · Phase 2 (OrangeSlice LLM + skill)
                score the pool on postability/bridge/audience/activity → ~50 targets
                tiered Direct / Competitor / Indirect / Far-stretch, each with angles

5. DISCOVER     discover.runSubreddit  (Apify → Reddit API → mock)
                search the product's keywords WITHIN each target subreddit, score
                locally, write the top on-topic threads as opportunities

6. GATE + DRAFT classify.run + drafts.generate (Anthropic)
                relevance + authenticity-risk; high risk → SKIP (no draft). Otherwise
                a disclosed, tier-aware comment + a "skeptical Redditor" BS-critic

7. SCHEDULE     lib/timing.ts
                lay every drafted opportunity on a mod-safe calendar: ≤4 posts/day,
                ≥3-day per-subreddit cooldown, peak-hour windows, deterministic jitter

8. TWO VIEWS    /                  business dashboard — metrics ONLY
                /post-by-employees employee console — exactly WHAT and WHEN to post
```

Everything is live: both dashboards subscribe to Convex and update in real time.

---

## Why each stage is hard (the complexity we handle)

- **Finding non-obvious communities.** A keyword search for "energy drink" returns
  `r/energydrinks` and stops. The [`subreddit-targeting` skill](finding-matching-subreddit.md)
  forces a *wide net first*: it decomposes the product into materials, rituals,
  pains it solves, pains it causes, gifting contexts, and non-consumption
  alternatives, then runs one RAG query per dimension. That's how `r/recycling`
  surfaces for a canned drink and `r/nightshift` for caffeine.
- **Semantic match, not lexical.** The ~1,800-subreddit catalog is embedded with
  OpenAI `text-embedding-3-small` and queried by **Convex vector search**, so an
  angle like "communities for staying awake on overnight shifts" finds the right sub
  even when the words don't overlap. No embedding key? It degrades gracefully to
  Convex full-text search.
- **Tiering for postability.** Not every relevant sub is *postable* — many product
  subs ban promo. Phase 2 scores each candidate on postability first and tiers them
  Direct → Competitor → Indirect → Far-stretch, carrying 1–3 reusable *angle*
  directions per sub (the correlation a human bridges back through).
- **Resilient discovery.** For each target subreddit we run a **keyword search
  scoped to that sub** via **Apify** (primary; the harshmaur actor) so the threads
  are on-topic, not just recent — with automatic fallback to the **official Reddit
  API** (`/r/<sub>/search`), then the bundled **mock** for the offline demo. Any
  single source failing degrades to fewer opportunities, never a crash.
- **The BS gate.** Reddit users have a ferocious BS meter. An Anthropic pass scores
  each thread's *authenticity-risk*; health-scare or astroturf-suspicion threads are
  gated to **skip** with no draft. Drafts that read salesy are regenerated once.
- **Mod-safe timing.** Posting 50 comments the day they're drafted is how accounts
  get banned. The timing algorithm spreads them: a campaign-wide daily cap, a
  per-subreddit cooldown (the biggest "are you astroturfing?" tell), and peak-hour
  windows with jitter so the cadence never looks metronomic.

---

## Deep dive 1 — Finding the subreddits

The catalog is ~1,771 subreddits (name + description, `data/subreddits.md`),
imported into the `subreddits` table and embedded with OpenAI
`text-embedding-3-small` (1536-d) in the `embedding` column, indexed by Convex's
`vectorIndex("by_embedding")`. Matching a product to its communities runs in three
moves (`convex/targeting.ts`, driven by `convex/lib/skill.ts`):

**Phase 1 — Cast wide (query generation).** A naive search for the literal product
returns the one obvious sub and nothing that carries a subliminal campaign. So the
skill first decomposes the product across ~14 dimensions and writes 1–2 RAG queries
per populated dimension — **20–40 angles total**:

> literal category · physical form & material · ingredients/components · the job it
> does · use occasion/ritual · user identity/lifestyle · pain it solves · pain it
> *causes* · adjacent purchases · gifting & relationship contexts · disposal/aftermath
> · emotional/social state · demographic/cultural communities · **non-consumption
> alternatives** (people who do the thing *instead* — your exact targets)

This is what pulls `r/recycling` into view for an aluminum-canned drink and
`r/nightshift` for caffeine. The angles are generated by OrangeSlice's LLM
(`generateObject`) with the Phase-1 skill as the system prompt and the enrichment
brief (own keywords, competitors, complements, topic terms) as input.

**Retrieval — RAG over the catalog.** Each angle is embedded (one batched OpenAI
call) and run through `ctx.vectorSearch("subreddits", "by_embedding", …)` for the
top `RAG_PER_ANGLE` (8) communities; results are pooled and deduped by name into a
candidate set capped at `MAX_CANDIDATE_POOL` (150). With no `OPENAI_API_KEY`, this
path swaps to Convex full-text search (`withSearchIndex("search_description")`) over
the descriptions — lexical, but dependency-free.

**Phase 2 — Narrow (score, tier, select).** The candidate pool (names + descriptions)
goes back to the LLM with the Phase-2 skill. Each candidate is scored on
**postability** (can a human post organically here without it reading as spam? — the
binding constraint), **bridge strength**, **audience overlap**, and **activity**,
then assigned to the highest tier it honestly fits, ~`MAX_TARGETS` (50) total:

| Tier | Name | What it is | How the product appears later |
|---|---|---|---|
| 1 | **Direct** | the product's own category/sub | a real mention, but promo-sensitive |
| 2 | **Competitor** | rival & substitute communities | an honest alternative; concede their strengths |
| 3 | **Indirect** | one–two hops out (materials, rituals, pains, gifting) — *the heart of the campaign* | an incidental detail; the community's topic leads |
| 4 | **Far-stretch** | deliberately loose, lateral ties | at most a passing aside |

Each pick carries 1–3 **angle directions** — reusable correlations (e.g. "Monster
cans are aluminum → frame around collecting/recycling cans in volume"), not finished
posts. Picks are validated against the retrieved pool (no hallucinated subs), saved
to the `targets` table, and each one fans out a discovery job.

---

## Deep dive 2 — The posting algorithm (what & when, to seem human)

Once discovery writes opportunities, two algorithms decide **what** to say and
**when** to say it so the activity reads as a real person, not a campaign.

### What to post

1. **Local relevance signals** (`lib/scoring.ts`, deterministic, transparent):
   keyword overlap (title match counts double a body match), competitor mention,
   recency (exponential decay, ~72h half-life), engagement (log-scaled upvotes +
   comments, with a penalty for giant threads where a new comment gets buried), and
   subreddit fit — blended by fixed `WEIGHTS` (sum 100) into a `baseScore` 0–100.
2. **Semantic + risk pass** (`classify.ts`, Anthropic): assigns a classification, a
   0–100 `semanticRelevance`, a 0–1 **authenticity-risk**, and a response type. Final
   score = `0.45·base + 0.55·semantic`.
3. **The skip gate** — the anti-BS core. An opportunity is **gated to `skip` (no
   draft)** if `authenticity-risk > 0.70` **or** final score `< 35` **or** the model
   itself returns `skip`. Health-scare ("ER", "palpitations") and
   astroturf-suspicion threads are exactly what this kills — any product mention
   there confirms the suspicion.
4. **Tier-aware drafting** (`drafts.ts`): the draft prompt is conditioned on the
   target tier (`intentHint`) — *direct* tolerates a real mention, *competitor* must
   concede the rival's strengths, *indirect* keeps the product an incidental detail,
   *far-stretch* allows only an aside — plus the subreddit's bridge **angle**, so the
   comment talks about the community's native topic first.
5. **Voice rules** (`DRAFT_SYSTEM`): answer the real question in sentence one; sound
   like a member (plain, lowercase-casual, **no** hype words — game-changer, elevate,
   unlock, supercharge); mention the product once as honest first-hand experience;
   concede real flaws; own the bias up front. 2–4 sentences.
6. **BS-critic loop**: a "jaded, skeptical Redditor" model scores the draft's
   salesiness 0–10. Above `CRITIC_SALESINESS_THRESHOLD` (5) it regenerates **once**
   with the critique; a missing/garbage score is treated as worst-case (10) so a
   bad draft never slips through. A **disclosure line is always appended** — the
   honesty guarantee that makes owning the bias the winning move.

### When to post

The schedule (`lib/timing.ts`, `computeSchedule`) is **pure and deterministic** — it
takes `now` and uses no `Date.now()`/randomness internally, so the same queue always
produces the same calendar. It enforces the three things a moderator watches for:

| Rule | Constant | Why it matters |
|---|---|---|
| **Daily cap** | `MAX_POSTS_PER_DAY = 4` (campaign-wide) | activity never looks like a coordinated burst |
| **Per-sub cooldown** | `SUB_COOLDOWN_DAYS = 3` | repeated posting in one sub is the single biggest "are you astroturfing?" tell |
| **Peak windows + jitter** | `PEAK_HOURS = [8, 12, 19]` local, 0–22 min deterministic jitter | posts land when threads are actually seen, and never on a metronomic clock |

**Mechanics:** opportunities are sorted by relevance (best get the earliest slots). A
generator yields candidate slots in chronological order — the peak hours of each day,
future-only, each nudged by an index-based jitter. For each opportunity the algorithm
walks the slots and takes the **earliest one that is unused, under the daily cap, and
past the per-subreddit cooldown**, then records the slot with a human-readable reason
(`"r/X: peak window, ≥3d after the last post here, ≤4/day campaign-wide"`). The search
is bounded to a one-year horizon. The employee console renders the queue sorted by
this scheduled time — so a human just works top to bottom, posting at a human pace.

---

## Two dashboards, deliberately separated

- **`/` — Business dashboard.** The landing page a brand uses to start the pipeline
  and watch **metrics only**: target subreddits by tier, threads discovered, how many
  are worth engaging vs. gated, drafts ready, posted, average relevance. It never
  shows *what* or *when* to post.
- **`/post-by-employees` — Employee console.** The internal queue for the posting
  team: every drafted, engage-recommended opportunity, sorted by its scheduled time,
  with the thread, the disclosed draft (copy-to-clipboard), the tier/angle, and the
  action link to post under a real account. This is where *what + when* lives.

---

## Architecture

- **Convex is the entire backend + database + scheduler + live subscriptions.** All
  outbound API calls (OrangeSlice, OpenAI, Apify, Reddit, Anthropic) run inside
  Convex actions; their keys live in the deployment env, never in the browser.
- **RAG** uses Convex's native `vectorIndex` (`subreddits.by_embedding`, 1536-d) with
  a `searchIndex` (`search_description`) fallback — no external vector DB.
- **The targeting skill is embedded** (`convex/lib/skill.ts`) as the system prompt for
  both LLM phases, so the model "uses the skill" deterministically.

**Stack:** Convex · React 19 + Vite + TypeScript · Tailwind v4 + shadcn/ui ·
react-router · Zustand. OrangeSlice (enrichment + LLM) · OpenAI (embeddings) ·
Apify (Reddit scraping) · Reddit OAuth · Anthropic (classify/draft/critic).

---

## Quick start

### 1. Prerequisites

- Node 20+ and `pnpm`
- An **OrangeSlice** login: `npx orangeslice login` (stores an `osk_` key; `pnpm run secrets` reads it)
- An **Anthropic** API key — <https://console.anthropic.com>
- *Optional but recommended:* an **Apify** token (<https://apify.com> — primary discovery), an **OpenAI** key (semantic RAG), and a **Reddit** "web app" (discovery fallback, <https://www.reddit.com/prefs/apps>)

### 2. Install & configure

```bash
pnpm install
npx convex dev --once          # creates the deployment, writes .env.local
cp .env.secrets.example .env.secrets   # fill in keys (see table below)
pnpm run secrets               # pushes all keys to the Convex deployment
```

### 3. Load the subreddit catalog (one-time)

```bash
pnpm run import:subreddits                 # parses data/subreddits.md → subreddits table (~1,771 rows)
npx convex run subreddits:backfillEmbeddings   # only if OPENAI_API_KEY is set — enables semantic RAG
```

Without the embedding backfill, matching still works via full-text search.

### 4. Run it

```bash
pnpm dev
```

Open the printed Vite URL, submit a product, and watch the business metrics fill in.
The posting queue builds at `/post-by-employees`.

---

## Environment variables

All secrets live **server-side in the Convex deployment**. The browser only sees `VITE_CONVEX_URL`.

| Variable | Required | Purpose |
|---|---|---|
| `ORANGESLICE_API_KEY` | yes | Enrichment + both targeting LLM phases (auto-read from the OrangeSlice CLI) |
| `ANTHROPIC_API_KEY` | yes | Classification, draft generation, BS-critic |
| `APIFY_TOKEN` | recommended | Primary discovery: keyword search within target subreddits (harshmaur actor) |
| `OPENAI_API_KEY` | recommended | Embeddings for semantic RAG; without it, matching falls back to full-text |
| `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` | optional | Discovery fallback when Apify is unset/fails (`/r/<sub>/new`) |
| `REDDIT_USER_AGENT` | optional | Reddit UA string (a default is used if unset) |
| `APIFY_REDDIT_ACTOR` | optional | Override the Apify actor (default `harshmaur~reddit-scraper`) |
| `CONVEX_DEPLOYMENT` / `VITE_CONVEX_URL` | auto | Written to `.env.local` by `convex dev` |

Inspect what's set: `npx convex env list`.

---

## Project layout

```
convex/
  schema.ts          tables (products, opportunities, drafts, targets, subreddits, …) + validators
  products.ts        submit + enrichment persistence + business metrics
  enrich.ts          OrangeSlice profiling (competitors + complements)
  targeting.ts       the skill: Phase-1 angles → RAG retrieval → Phase-2 tiering
  subreddits.ts      RAG retrieval helpers + embedding backfill
  discover.ts        subreddit-latest discovery (Apify → Reddit → mock)
  classify.ts        Anthropic scoring/classification + the skip gate
  drafts.ts          Anthropic draft + tier-aware positioning + BS-critic
  opportunities.ts   queue mutations/queries + the scheduled employee queue
  posts.ts           original-post creation mode
  lib/
    skill.ts         the subreddit-targeting methodology, embedded for the LLM
    embeddings.ts    OpenAI embeddings client (optional)
    apify.ts         Apify keyword-search-in-subreddit client (primary discovery)
    reddit.ts        Reddit OAuth client (search + /new fallback)
    timing.ts        the mod-safe when-to-post scheduler
    orangeslice.ts   enrichment + LLM client
    anthropic.ts     classify/draft/critic client
    scoring.ts       local deterministic relevance signals
scripts/
  import-subreddits.mjs   parses the catalog markdown → subreddits table
  setup-env.mjs           pushes secrets to the Convex deployment
src/
  pages/Dashboard.tsx     business dashboard — metrics only
  pages/EmployeePage.tsx  employee console — what + when to post (/post-by-employees)
  pages/ActionPage.tsx    operator posting workflow (/action/:token)
data/
  subreddits.md           the subreddit catalog (name + description)
finding-matching-subreddit.md   the subreddit-targeting skill
```
