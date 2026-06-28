# VIBESEED

**Honest Reddit recommendation intelligence.** Submit a product website. VIBESEED
enriches it (OrangeSlice), discovers relevant Reddit threads (authenticated Reddit
API), scores and classifies each one with an engagement algorithm, and drafts a
**disclosed, value-first** comment via Anthropic — but only where a comment would
genuinely be welcome. A human operator posts it under their own account through a
unique action link. Everything is live: the dashboard subscribes to Convex and
updates in real time, no refresh.

> Built to engage Reddit honestly. It does **not** create covert/undisclosed
> seeding, fake personas, or bot-account networks. Every draft carries a
> disclosure line, and the algorithm actively **skips** threads where a mention
> would read as marketing.

---

## Architecture

```
React + Vite (browser)                Convex (cloud backend + DB + live subscriptions)
─────────────────────                 ────────────────────────────────────────────────
SubmitForm ──useMutation──▶ products.submitProduct (mutation)
                                       └─ scheduler ▶ enrich.run (action)
dashboard  ◀─useQuery live──┐             └─ OrangeSlice: scrape + web.search + generateObject
(opportunities, drafts,     │             └─ products.saveEnrichment ▶ fan out discover.runSearch
 products, posts)           │                 └─ Reddit OAuth search ▶ opportunities.upsert
                            │                     └─ classify.run (Anthropic) ▶ score + gate
                            │                         └─ drafts.generate (Anthropic + BS-critic)
ActionPage ──mutations──────┘  actionLink.markOpened / markCompleted  (queued→assigned→opened→completed)
```

- **All outbound API calls run inside Convex actions** — OrangeSlice, Reddit, and
  Anthropic keys live in the Convex deployment's env, never in the browser.
- **Convex is the only database and backend.** Schema, queries, mutations, actions,
  the scheduler, and real-time subscriptions are all Convex (`convex/`).
- **The engagement algorithm** (`convex/lib/scoring.ts` + `convex/classify.ts`):
  local deterministic signals (keyword/competitor/recency/engagement/subreddit
  fit) blended with an Anthropic semantic pass that assigns a classification, an
  **authenticity-risk** score, and a recommended response type. High risk or low
  fit → the opportunity is **gated (skip)** and no draft is written. Drafts run
  through a "skeptical Redditor" critic that scores salesiness 0–10 and regenerates
  once if it reads like marketing.

**Stack:** Convex · React 19 + Vite + TypeScript · Tailwind v4 + shadcn/ui ·
react-router · Zustand (operator identity). One command runs everything.

---

## Quick start

### 1. Prerequisites

- Node 20+ and `pnpm`
- An **OrangeSlice** login: `npx orangeslice login` (stores an `osk_` key in
  `~/.config/orangeslice/config.json` — `pnpm run secrets` reads it automatically)
- A **Reddit** "web app" (id + secret) from <https://www.reddit.com/prefs/apps>
- An **Anthropic** API key from <https://console.anthropic.com>

### 2. Install

```bash
pnpm install
```

### 3. Configure the Convex deployment (one-time)

```bash
# Cloud (recommended for a shared demo) — opens a browser to log in:
npx convex dev --once
```

This creates the deployment and writes `CONVEX_DEPLOYMENT` + `VITE_CONVEX_URL`
to `.env.local`. (No account? Run `CONVEX_AGENT_MODE=anonymous npx convex dev --once`
for a local-only deployment — `pnpm run secrets` and `pnpm dev` then pick it up
automatically.)

### 4. Push the secrets

```bash
cp .env.secrets.example .env.secrets   # fill in Reddit + Anthropic
pnpm run secrets                             # pushes OrangeSlice (auto) + Reddit + Anthropic to Convex
```

### 5. Run it (one command)

```bash
pnpm dev
```

Open the printed Vite URL. Submit a product URL (try one with a clear product,
e.g. a SaaS or a consumer brand) and watch the opportunity queue populate live.

---

## Environment variables

All secrets are stored **server-side in the Convex deployment** (set via
`pnpm run secrets` → `npx convex env set`). The browser only ever sees `VITE_CONVEX_URL`.

| Variable | Where it lives | Purpose |
|---|---|---|
| `ORANGESLICE_API_KEY` | Convex env (auto from `~/.config/orangeslice/config.json`) | Domain enrichment: scrape, web search, structured extraction |
| `REDDIT_CLIENT_ID` | Convex env (`.env.secrets`) | Reddit app-only OAuth client id |
| `REDDIT_CLIENT_SECRET` | Convex env (`.env.secrets`) | Reddit app-only OAuth client secret |
| `REDDIT_USER_AGENT` | Convex env (`.env.secrets`, optional) | Required UA string for Reddit (a default is used if unset) |
| `ANTHROPIC_API_KEY` | Convex env (`.env.secrets`) | Classification, draft generation, BS-meter critic |
| `CONVEX_DEPLOYMENT` | `.env.local` (written by `convex dev`) | Selects the Convex deployment for the CLI |
| `VITE_CONVEX_URL` | `.env.local` (written by `convex dev`) | The Convex URL the browser client connects to |

Verify what's set on the deployment: `npx convex env list`
(prefix with `CONVEX_AGENT_MODE=anonymous` for a local deployment).

---

## The full demo flow

1. **Submit** a product URL → `products.submitProduct`.
2. **Enrich** (OrangeSlice) → `{ ownKeywords, competitorDomains, topicTerms }` saved to Convex.
3. **Discover** (Reddit) → authenticated search per keyword/competitor; each post is
   scored locally and written as an opportunity.
4. **Score + classify** (Anthropic) → classification, authenticity-risk, final
   relevance; low-fit threads are **gated**.
5. **Draft** (Anthropic) → a disclosed, helpful comment + a BS-critic salesiness score.
6. **Act** → click an opportunity's action link: it opens the Reddit thread in a new
   tab, shows the draft with copy-to-clipboard and step-by-step instructions, and the
   operator posts under their own account, then marks it complete.
7. **Post-creation mode** → generate an original, disclosed post for a chosen
   subreddit with the same link-out-and-confirm mechanic.

Status is tracked live in Convex: `queued → assigned → opened → completed`.

---

## Project layout

```
convex/
  schema.ts            tables + shared validators
  products.ts          submit + enrichment persistence + discovery fan-out
  enrich.ts            OrangeSlice enrichment action
  discover.ts          authenticated Reddit search action
  classify.ts          Anthropic scoring/classification + the skip gate
  drafts.ts            Anthropic draft + BS-meter critic loop
  opportunities.ts     queue mutations/queries + assignment
  posts.ts             post-creation mode
  operators.ts         operator identities
  actionLink.ts        token → action resolution + status transitions
  lib/                 orangeslice, reddit, anthropic clients + scoring
src/
  pages/Dashboard.tsx  submit + product panel + live queue + post creator
  pages/ActionPage.tsx operator action workflow (/action/:token)
  components/          UI built on shadcn/ui
```
