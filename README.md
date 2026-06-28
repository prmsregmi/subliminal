# SUBLIMINAL

**Subliminal is a hackathon demo showing how subliminal seeding could be automated
across Reddit.** The idea is not to buy ads in the obvious category. It is to make
a brand appear inside the problems, tools, comparisons, complaints, and decision
moments that surround that category.

Paste a company website. SUBLIMINAL scrapes the site, runs 2 web searches for
competitors and related tools, creates 20–40 concrete Reddit searches, matches them
against ~1,771 subreddit descriptions, searches inside the best subreddits, scores
real threads, skips bad fits, writes drafts, and builds a demo posting schedule.

The core idea is simple: direct keyword search finds the obvious subreddit.
SUBLIMINAL also finds people asking for alternatives, complaining about competitors,
trying to solve the same problem, buying related tools, dealing with downsides, or
asking for recommendations. That is where a brand can enter a conversation before
people are explicitly searching for it.

---

## The Pipeline

```
1. PROFILE      company domain → website scrape + 2 web searches
                output: keywords, competitors, complements, topic terms

2. EXPAND       company brief → 20–40 searches for use cases, alternatives, problems,
                related tools, materials, buyers, and objections

3. MATCH        each search → meaning-based search over subreddit descriptions
                output: 8 matches/search, deduped into a pool capped at 150

4. SELECT       candidate communities → usefulness, fit, audience, activity scoring
                output: up to 50 target subreddits, each with posting guidance

5. DISCOVER     search company/topic terms inside every target subreddit; fetch up to
                25 posts/subreddit and keep the best 6

6. DECIDE       thread relevance + risk that a reply would feel forced
                output: skip, or a draft; max 30 opportunities/submitted site

7. SCHEDULE     approved threads → human-paced calendar
                ≤4 posts/day, ≥3-day per-subreddit cooldown, peak windows, jitter

8. TWO VIEWS    /                  demo dashboard — metrics ONLY
                /post-by-employees posting queue — exactly WHAT and WHEN to post
```

Everything is live: both dashboards subscribe to Convex and update in real time.

---

## Sponsor Tech Used

- **OrangeSlice** scrapes the submitted site, runs the competitor and
related-tool searches, and powers the site-to-subreddit selection prompts.
- **Convex** is the backend, database, scheduler, live query layer, and vector
search engine. Submitted sites, target subreddits, discovered threads,
drafts, queue status, and dashboard metrics all live there.
- **OpenAI** creates the subreddit-description embeddings used for meaning-based
matching, so a company search can find relevant communities even when the words
do not match exactly.

---

## Why Each Stage Is Hard

- **Finding non-obvious communities.** Direct category search returns the obvious
subreddit and misses people talking around the company/category. SUBLIMINAL searches for
concrete connections: what the thing is made of, what it is used for, what it
replaces, what problem it solves, what downside it creates, who buys it, and what
people buy with it.
- **Matching meaning, not exact words.** The ~1,800-subreddit catalog is embedded
with `text-embedding-3-small` and searched by meaning. A search can match a
subreddit even when the words do not overlap. Without `OPENAI_API_KEY`, the same
flow falls back to full-text search.
- **Choosing places where a reply belongs.** Not every relevant subreddit is useful.
The system narrows a candidate pool capped at 150 down to at most 50 subreddits.
It scores whether a reply could fit there, how closely the subreddit matches the
company/category, whether the audience is right, and whether the community is
active. Each target gets guidance for how direct the mention can be.
- **Resilient discovery.** For each target subreddit we run a **keyword search
scoped to that sub** so the threads are on-topic, not just recent. The source
chain is Apify, then the Reddit API, then the bundled mock data for offline
demos. A failed source means fewer opportunities, not a broken demo run.
- **Rejecting bad threads.** Each thread receives a relevance score and a risk
score. Medical-alarm threads, threads accusing brands of shilling, weak fits, and
forced mentions become **skip** with no draft. Drafts that read promotional are
rewritten once using the critique.
- **Human-paced scheduling.** The queue is sorted by relevance and spread with a
campaign-wide cap of 4 posts/day, a 3-day gap per subreddit, three daily time
windows, and 0–22 minutes of deterministic jitter. The demo produces a calendar
instead of a burst of generated text.

---

## Deep Dive 1 — Finding The Subreddits

The catalog is ~1,771 subreddits (name + description, `data/subreddits.md`),
imported into the `subreddits` table, embedded with `text-embedding-3-small`, and
indexed by Convex vector search. Matching a submitted site to communities happens in
three steps:

**Step 1 — Write many searches.** A search for the literal category returns the
obvious communities and misses the useful ones nearby. SUBLIMINAL writes searches
for the category, what it is made of, what problem it solves, what problem it can
cause, who buys it, what people compare it with, what people buy alongside it, and
what people use instead. The result is **20–40 searches** from a single website.

**Step 2 — Search subreddit descriptions by meaning.** Each search is embedded and
matched against subreddit descriptions. The system pulls the top `RAG_PER_ANGLE`
(8) matches for each search, removes duplicates, and caps the candidate list at
`MAX_CANDIDATE_POOL` (150). Without embeddings, the same flow uses full-text search.

**Step 3 — Keep the subreddits where a reply can fit.** Each candidate subreddit
is scored for how useful a reply would be, how closely the community matches the
company/category, whether the audience is right, and whether the subreddit is active.
The system keeps up to `MAX_TARGETS` (50) targets:


| Level | Name           | What it is                                                             | How the brand appears later                                    |
| ----- | -------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1     | **Direct**     | the brand's own category/sub                                           | a real mention, but promo-sensitive                            |
| 2     | **Competitor** | rival & substitute communities                                         | comparison angle                                               |
| 3     | **Indirect**   | communities about use cases, problems, materials, or related purchases | the subreddit topic comes first; the brand is a small detail   |
| 4     | **Loose**      | weak but possible matches                                              | at most a passing aside                                        |


Each target carries 1–3 short notes explaining how the brand relates to that
subreddit. These are not finished posts. Picks are validated against the retrieved
pool, saved to the `targets` table, and each target starts its own discovery job.

---

## Deep Dive 2 — The Posting Algorithm

Once discovery finds threads, the system decides **what** should be drafted and
**when** it should appear in the execution queue. The demo still keeps a human
review step between generated text and any real-world action.

### What to post

1. **Local relevance score.** The first score uses measurable thread data: keyword
  overlap, competitor mentions, age, upvotes, comment count, and subreddit fit.
   Title matches count more than body matches. Recent threads score higher. Huge
   threads are penalized because a new reply is less visible there.
2. **Meaning and risk check.** A second pass reads what the thread is actually
  asking, how closely it matches the brand/category, what kind of reply would fit,
   and how likely a mention is to feel forced.
3. **Weighted final score.** The final relevance score blends the deterministic
  evidence with the meaning check. Local signals keep the system grounded in
   thread data; the meaning check catches relevant threads that keyword matching
   misses.
4. **Skip gate.** An opportunity receives no draft when risk is above `0.70`, final
  relevance is below `35`, or the recommended response is `skip`. Medical-alarm
   threads, threads accusing brands of shilling, weak fits, and forced mentions
   stop here.
5. **Drafting rules by subreddit type.** Direct communities allow a real mention,
  competitor communities use comparison, indirect communities keep the brand
   incidental, and loose matches allow only a passing aside.
6. **Voice constraints.** The draft must answer the real thread first, avoid obvious
  ad language, mention the brand once at most, and fit in 2–4 sentences.
7. **Skeptical-reader pass.** A critic scores salesiness from 0–10. Scores above
  `CRITIC_SALESINESS_THRESHOLD` (5) trigger one rewrite using the critique. Missing
   or invalid critic output is treated as worst-case, so unscored drafts do not pass.

### When to post

The scheduler takes drafted threads as `{ id, subreddit, score }` and returns a
calendar with `{ scheduledFor, reason }`. It is pure and deterministic: `now` is
passed in, no hidden current time is read, and no random number is used. The same
queue always produces the same calendar, so Convex live updates can re-render the
posting queue without reshuffling assignments.

This is not a simple delay. It is a bounded search over future posting slots, built
around the patterns Reddit systems and moderators notice: same-day bursts, repeated
activity in one subreddit, identical timestamps, and low-priority comments posted
before better ones.


| Rule                    | Constant                                     | Why it matters                                                          |
| ----------------------- | -------------------------------------------- | ----------------------------------------------------------------------- |
| **Daily cap**           | `MAX_POSTS_PER_DAY = 4`                      | a 30-thread queue cannot become 30 same-day actions                     |
| **Per-subreddit gap**   | `SUB_COOLDOWN_DAYS = 3`                      | the same subreddit cannot be touched again for at least 3 days          |
| **Useful time windows** | `PEAK_HOURS = [8, 12, 19]` + 0–22 min jitter | work lands during normal attention windows without identical timestamps |


**Mechanics:**

1. Sort every drafted thread by relevance score, highest first. The best threads
  reserve the earliest valid slots.
2. Generate candidate slots for the next 365 days. Each day emits 8am, 12pm, and
  7pm local slots. Past slots are skipped.
3. Add stable jitter to every slot with `((n * 17 + 11) % 23)` minutes. The offset
  is always 0–22 minutes, but it is reproducible, so the queue looks natural
   without becoming random or impossible to audit.
4. For each thread, walk candidate slots until one passes all checks: the timestamp
  is unused, the day has fewer than 4 scheduled posts, and the same subreddit has
   not been scheduled in the previous 3 days.
5. Commit the slot by updating three pieces of state: used timestamps, post count
  for that day, and last scheduled time for that subreddit.
6. Store a human-readable reason, e.g. `r/X: peak window, >=3d after the last post
  here, <=4/day campaign-wide`.

The result is a calendar that is stable, explainable, and built from the same
constraints a posting lead would enforce manually. The queue renders in scheduled
order, so the demo has a concrete execution plan instead of loose generated text.

---

## Two Views, Deliberately Separated

- **`/` — Demo dashboard.** Metrics only: target subreddits by level, threads
discovered, worth replying to vs. skipped, drafts ready, posted, and average
relevance. It never shows *what* or *when* to post.
- **`/post-by-employees` — Posting queue.** The execution view: every drafted,
engage-recommended opportunity, sorted by scheduled time, with the thread, draft,
level/guidance, and action link. This is where *what + when* lives.

---

## Architecture

- **Convex is the entire backend + database + scheduler + live subscriptions.** All outbound API calls (OrangeSlice, OpenAI, Apify, Reddit, Anthropic) run inside Convex actions; their keys live in the deployment env.
- **Subreddit matching** uses Convex's native `vectorIndex`
(`subreddits.by_embedding`, 1536-d) with a `searchIndex` fallback — no external
vector database.
- **The subreddit-search instructions** live in `convex/lib/skill.ts` and are used
by both selection passes, so target generation follows the same method every run.

**Stack:** Convex · React 19 + Vite + TypeScript · Tailwind v4 + shadcn/ui ·
react-router · Zustand. OrangeSlice (enrichment + LLM) · OpenAI (embeddings) ·
Apify (Reddit scraping) · Reddit OAuth · Anthropic (classify/draft/critic).

---

## Quick start

### 1. Prerequisites

- Node 20+ and `pnpm`
- An **OrangeSlice** login: `npx orangeslice login` (stores an `osk_` key; `pnpm run secrets` reads it)
- An **Anthropic** API key — [https://console.anthropic.com](https://console.anthropic.com)
- *Optional but recommended:* an **Apify** token ([https://apify.com](https://apify.com) — primary discovery), an **OpenAI** key (meaning-based subreddit matching), and a **Reddit** "web app" (discovery fallback, [https://www.reddit.com/prefs/apps](https://www.reddit.com/prefs/apps))

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
npx convex run subreddits:backfillEmbeddings   # only if OPENAI_API_KEY is set — enables meaning-based matching
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


| Variable                                    | Required    | Purpose                                                                                       |
| ------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------- |
| `ORANGESLICE_API_KEY`                       | yes         | Enrichment + both targeting LLM phases (auto-read from the OrangeSlice CLI)                   |
| `ANTHROPIC_API_KEY`                         | yes         | Classification, draft generation, promotional-language critic                                 |
| `APIFY_TOKEN`                               | recommended | Primary discovery: keyword search within target subreddits (harshmaur actor)                  |
| `OPENAI_API_KEY`                            | recommended | Embeddings for meaning-based subreddit matching; without it, matching falls back to full-text |
| `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` | optional    | Discovery fallback when Apify is unset/fails (`/r/<sub>/new`)                                 |
| `REDDIT_USER_AGENT`                         | optional    | Reddit UA string (a default is used if unset)                                                 |
| `APIFY_REDDIT_ACTOR`                        | optional    | Override the Apify actor (default `harshmaur~reddit-scraper`)                                 |
| `CONVEX_DEPLOYMENT` / `VITE_CONVEX_URL`     | auto        | Written to `.env.local` by `convex dev`                                                       |


Inspect what's set: `npx convex env list`.

---

## Project layout

```
convex/
  schema.ts          tables (products, opportunities, drafts, targets, subreddits, …) + validators
  products.ts        submit + enrichment persistence + business metrics
  enrich.ts          OrangeSlice profiling (competitors + complements)
  targeting.ts       search generation → subreddit matching → target selection
  subreddits.ts      subreddit search helpers + embedding backfill
  discover.ts        subreddit-latest discovery (Apify → Reddit → mock)
  classify.ts        Anthropic scoring/classification + the skip gate
  drafts.ts          Anthropic draft + subreddit-type positioning + critic
  opportunities.ts   queue mutations/queries + the scheduled employee queue
  posts.ts           original-post creation mode
  lib/
    skill.ts         the subreddit-targeting methodology, embedded for the LLM
    embeddings.ts    OpenAI embeddings client (optional)
    apify.ts         Apify keyword-search-in-subreddit client (primary discovery)
    reddit.ts        Reddit OAuth client (search + /new fallback)
    timing.ts        human-paced posting scheduler
    orangeslice.ts   enrichment + LLM client
    anthropic.ts     classify/draft/critic client
    scoring.ts       local deterministic relevance signals
scripts/
  import-subreddits.mjs   parses the catalog markdown → subreddits table
  setup-env.mjs           pushes secrets to the Convex deployment
src/
  pages/Dashboard.tsx     demo dashboard — metrics only
  pages/EmployeePage.tsx  posting queue — what + when to post (/post-by-employees)
  pages/ActionPage.tsx    posting workflow (/action/:token)
data/
  subreddits.md           the subreddit catalog (name + description)
finding-matching-subreddit.md   the subreddit-targeting skill
```
