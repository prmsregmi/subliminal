---
name: subreddit-targeting
description: >
  Use whenever the goal is to narrow a large pool of subreddits (hundreds to
  thousands, typically stored in a RAG/vector database) down to a ranked target
  list for a marketing or growth campaign around a specific product, brand, or
  service. Turns a product brief into a tiered list of ~50 subreddits — direct,
  competitor, indirect, and far-stretch — where humans can plausibly post
  content that bridges back to the product, with the angle/correlation spelled
  out for each. Trigger on requests like "find subreddits for promoting X,"
  "which communities should we post in for this campaign," "build a Reddit
  target list," or any task that hands over a product plus a subreddit database
  and asks for a marketing shortlist. The core value is surfacing the
  non-obvious, subliminal-fit communities the obvious keyword search never
  returns — pair the product's literal category with its materials, rituals,
  side-effects, gifting contexts, and adjacent identities to find them.
---

# Subreddit Targeting

## What this skill does

Input: a product/brand/service brief, plus access to a RAG database of subreddits (each entry is at least a subreddit name, usually with a description and member/activity signal).

Output: a ranked list of ~50 subreddits split into four tiers. Each pick carries the subreddit name (exactly as it appears in the database), one line on why it fits, and up to three **angle directions** — the correlations a human poster can lean on. Angles are reusable directions, not finished posts; the campaign will post multiple times per subreddit off the same angles.

The hard part is not ranking — it is *generating enough variety in what you search for* so the database actually surfaces the indirect and far-stretch communities. A naive search for "energy drink" returns r/energydrinks and stops. This skill forces a wide net first, then narrows.

## The two phases

**Phase 1 — Cast wide (query generation).** Decompose the product into many independent search angles, then query the RAG once per angle. This is what pulls r/recycling into view for a canned drink, or r/relationships for a hairbrush.

**Phase 2 — Narrow (score, tier, select).** Pool all retrieved candidates, dedupe, score each against the rubric, assign to a tier, and fill the target counts with backfill rules.

Do not skip Phase 1 and search only the literal product. If you do, tiers 3 and 4 will be empty or weak, and those are the tiers that carry the campaign.

## Phase 1 — Decompose the product into search angles

Before querying, write out the product across as many of these dimensions as apply. Each populated dimension becomes one or more RAG queries. Aim for breadth — 20–40 distinct queries is normal.

- **Literal category** — what the thing is (energy drink, voice dictation app, hairbrush).
- **Physical form & material** — what it's made of and shipped in (aluminum can, plastic packaging, glass, software-so-none). Drives r/recycling, r/aluminum, r/zerowaste.
- **Ingredients / components / inputs** — caffeine, taurine, sugar; or for software, "speech recognition," "transcription."
- **The job it does** — the underlying task the user is hiring it for ("stay awake on a night shift," "write faster without typing," "tame frizzy hair").
- **Use occasion / ritual** — when and where it's used (gym, gaming sessions, road trips, morning routine, study all-nighters).
- **User identity / lifestyle** — who uses it as part of who they are (gamers, truckers, students, programmers, runners).
- **Pain it solves** — the problem that creates demand (fatigue, RSI/wrist pain, slow typing, bad hair days).
- **Pain it causes or worsens** — the downside communities (caffeine dependence, sugar/health, sleep problems). These are real, postable, and often high-engagement.
- **Adjacent purchases** — what people buy alongside it (gaming gear, supplements, styling tools, mechanical keyboards).
- **Gifting & relationship contexts** — who buys it for whom (gifts for boyfriend/girlfriend, gifts for gamers, what-to-buy subs).
- **Disposal / aftermath** — what happens after use (recycling, collecting cans, packaging waste).
- **Emotional / social state around use** — the mood or situation (burnout, productivity, motivation, deadlines).
- **Demographic & cultural communities** — broad groups whose interests overlap (college, specific countries/cities, hobby subs).
- **Non-consumption alternatives** — what people do *instead* (r/decaf, r/quittingcaffeine, r/nosurf, handwriting). Their members are exactly the people the product targets.

For each populated dimension, write a short natural-language RAG query (e.g. "communities about recycling aluminum cans," "subreddits for night-shift workers," "gift ideas for a partner"). Run them all. Keep every returned candidate with its source dimension noted — you'll use that to tier later.

## Phase 2 — Score, tier, and select

### Scoring rubric (per candidate)

Rate each candidate on four factors. A candidate must clear a minimum bar on the first two or it's cut regardless of relevance.

1. **Postability** — Can a real human plausibly write an organic post here whose topic lives natively in this subreddit, and which can carry a bridge to the product without reading as an ad? If a post would obviously be spam or violate an obvious self-promo norm, the subreddit is near-useless no matter how on-topic. This is the most important factor for tiers 3–4.
2. **Bridge strength** — How natural is the connection between the subreddit's native topic and the product? Strong = the product is genuinely relevant to a normal post. Weak = you'd have to force it.
3. **Audience overlap** — How much of this community is a realistic buyer/user of the product.
4. **Activity** — Enough live posting that a contribution gets seen (use whatever member/activity signal the database carries).

### Tiers and target counts

Assign each surviving candidate to the highest tier it honestly fits. Target total ~50:

- **Tier 1 — Direct (10).** The product's own category and the thing itself: r/energydrinks, r/MonsterEnergy, the product's named sub. Bridge strength is maximal; postability is the binding constraint (many product subs ban promo).
- **Tier 2 — Competitors & alternatives (10).** Communities for rival brands and substitutes: r/Celsius, r/redbull, r/bangenergy. Posts here are comparison/switching angles.
- **Tier 3 — Indirect / subliminal (20).** The heart of the campaign. Communities whose native topic is one or two hops from the product — materials, rituals, pains, gifting, adjacent purchases. The aluminum-recycling and gift-for-partner examples live here. The poster talks about the community's real topic; the product appears as a natural detail.
- **Tier 4 — Far stretch / lateral (10).** Deliberately loose connections — a community where the product can surface as a passing mention, an aside, or an unexpected tie-in (a horror-stories sub for an insurance product; a frugality sub for a premium drink, via the "is it worth it" angle). Lower bridge strength is acceptable here; postability still is not.

### Backfill rules

The 10/10/20/10 split is a target, not a quota.

- If Tier 1 or Tier 2 is thin (niche B2B product, few or no competitor subs), do **not** pad with weak entries. Move the surplus slots down into Tier 3.
- Never promote a candidate into a higher tier than it honestly fits to hit a count.
- If the whole pool can't responsibly fill 50, return fewer and say so. A tight 38 beats a padded 50.
- Cut any candidate that fails postability outright, even in Tier 1.

## Output format

Group by tier. For each subreddit:

```
r/<exact-name-from-database> — <one line on why it fits>
  • <angle direction 1>
  • <angle direction 2>
  • <angle direction 3>   (1–3 angles; fewer is fine)
```

Angles are *correlations/directions*, not drafted posts. Example angle for Monster × r/recycling: "Monster cans are aluminum — frame around collecting/recycling large volumes of cans." The downstream system writes the actual posts from these.

Close with a one-line note on any tier that fell short of target and why.

## Worked example — Monster Energy

**Tier 1 (direct):** r/energydrinks ("the category itself"), r/MonsterEnergy.
**Tier 2 (competitors):** r/Celsius, r/redbull, r/bang_energy — angles: taste/price/caffeine comparisons, switching stories.
**Tier 3 (indirect):**
- r/recycling — *aluminum cans* — angles: collecting cans in volume, can-recycling habits, deposit returns.
- r/gaming — *use-occasion* — angles: drinks during long sessions, staying sharp in ranked.
- r/nightshift — *pain it solves* — angles: getting through overnight shifts, what keeps you awake.
- r/caffeine — *ingredient* — angles: caffeine tolerance, comparing caffeine sources.
**Tier 4 (far stretch):**
- r/Frugal — *lateral* — angle: "is the per-can cost worth it vs. coffee" debates.
- r/decaf — *non-consumption alternative* — angle: people negotiating their relationship with high-caffeine drinks.

## Worked example — a SaaS dictation app (e.g. voice-to-text)

**Tier 1:** r/dictation, r/speechrecognition, the product's own sub.
**Tier 2:** competitor app subs, r/Dragon (legacy dictation).
**Tier 3:**
- r/RSI — *pain it solves* — angle: reducing typing strain, hands-free workflows.
- r/programming — *user identity* — angle: dictating code comments/messages, typing fatigue.
- r/writing / r/NaNoWriMo — *job it does* — angle: drafting faster by talking.
- r/productivity — *emotional state* — angle: cutting time spent typing.
**Tier 4:**
- r/disability — *lateral* — angle: accessibility and hands-free computing.
- r/handwriting — *non-consumption alternative* — angle: people who avoid typing entirely.

## Guardrails that keep the list usable

- Postability beats cleverness. A brilliant correlation in a sub that removes all non-native posts is a dead pick.
- Respect that each subreddit's native topic must lead. The product is the detail, not the subject — especially in tiers 3 and 4.
- Prefer fewer, defensible picks over a padded count.