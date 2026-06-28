// Demo Reddit mock: discovery is mocked ONLY when the submitted product is
// Monster Energy (any monsterenergy.com variant). Every other product runs the
// real pipeline. Enrichment is never mocked — it always extracts from the real
// website; only the Reddit discovery step is seeded here, so the curated White
// Monster demo looks legit without live Reddit access (gated by their policy).
//
// The library is curated to the five demo scenarios (brand = White Monster, i.e.
// Monster Energy Ultra / the zero-sugar white can):
//   1. competitor thread → market White Monster   (Bang, Celsius, Red Bull)
//   2. complaint about White Monster → reassure    (too sweet, crash; ER + astroturf gated)
//   3. exploration / suggestion ask                (all-nighter, study)
//   5. alternating caffeination / coffee on the go (commute, pre-workout)
//   4. an original seeded post                     (see MONSTER_POSTS)
//
// A couple of cards point at real (competitor) threads; the rest use real
// subreddit search deep-links that always resolve to genuine, on-topic posts.

import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { newToken } from "./lib/token";
import { MODEL_DRAFT, DEFAULT_DISCLOSURE } from "./constants";

// The only brand the bundled Reddit mock is curated for. Any monsterenergy.com
// variant triggers mocked discovery; everything else runs real discovery.
export function isMonsterDomain(domain: string): boolean {
  return /(^|\.)monsterenergy\.com$/i.test(domain) || domain.toLowerCase().includes("monsterenergy");
}

function isRedditThreadUrl(url: string): boolean {
  return /reddit\.com\/r\/[^/]+\/comments\/[^/?#]+/i.test(url);
}

type Classification = "competitor-mention" | "frustrated-user" | "similar-interest" | "general";
type ResponseType =
  | "answer-question"
  | "share-experience"
  | "add-data-point"
  | "mention-if-relevant"
  | "skip";

interface DraftSeed {
  body: string;
  rationale: string;
  criticScore: number; // 0..10 salesiness as scored by the BS-critic
}

interface OppSeed {
  redditId: string;
  subreddit: string;
  title: string;
  body: string;
  author: string;
  score: number;
  numComments: number;
  hoursAgo: number;
  searchQuery: string; // builds the real subreddit search deep-link
  url?: string; // explicit real thread permalink; overrides the search deep-link
  discoveredVia: string;
  classification: Classification;
  responseType: ResponseType;
  authenticityRisk: number; // 0..1
  relevanceScore: number;
  baseScore: number;
  recommendation: "engage" | "skip";
  reasoning: string;
  matchedKeywords?: string[];
  matchedCompetitors?: string[];
  subredditFit?: number;
  draft?: DraftSeed; // omitted for gated (skip) opportunities
}

interface PostSeed {
  subreddit: string;
  angle: string;
  title: string;
  body: string;
  rationale: string;
  criticScore: number;
}

// ---- The White Monster mock library ----

export const MONSTER_OPPS: OppSeed[] = [
  // --- Scenario 1: competitor thread → market White Monster ---
  {
    redditId: "mock_mon_01",
    subreddit: "energydrinks",
    title: "Bang Energy fell off hard — what happened to the flavors?",
    body: "Used to love Bang but the last few cans taste watered down and the caffeine barely hits. Did they change the formula after the buyout?",
    author: "throwaway_fizz",
    score: 412,
    numComments: 87,
    hoursAgo: 9,
    searchQuery: "bang energy fell off flavor",
    discoveredVia: "competitor:bang",
    classification: "competitor-mention",
    responseType: "share-experience",
    authenticityRisk: 0.23,
    relevanceScore: 77,
    baseScore: 70,
    recommendation: "engage",
    reasoning: "Active complaint about a competitor's decline — a low-key 'what I drink instead' note fits naturally.",
    matchedKeywords: ["energy drink", "caffeine"],
    matchedCompetitors: ["bang"],
    subredditFit: 1,
    draft: {
      body: "Yeah Bang fell off after the buyout — half of them taste like cough syrup now. Biased since I work on Monster, but the White Monster (Ultra) is the one I actually drink: zero sugar, light citrus, none of the syrup. Worth a shot if you're done with Bang.",
      rationale: "Owns the bias, frames White Monster as a personal pick inside a real competitor complaint.",
      criticScore: 3,
    },
  },
  {
    redditId: "mock_mon_02",
    subreddit: "energydrinks",
    title: "Do you guys prefer Celsius or Red Bull?",
    body: "Trying to settle on one as my go-to. Red Bull's the classic but everyone keeps pushing Celsius at me. Which do you actually reach for?",
    author: "daily_driver_q",
    score: 188,
    numComments: 71,
    hoursAgo: 15,
    searchQuery: "celsius or red bull",
    url: "https://www.reddit.com/r/energydrinks/comments/z62j2o/do_you_guys_prefer_celsius_or_red_bull/",
    discoveredVia: "competitor:celsius",
    classification: "competitor-mention",
    responseType: "add-data-point",
    authenticityRisk: 0.3,
    relevanceScore: 74,
    baseScore: 66,
    recommendation: "engage",
    reasoning: "Direct competitor head-to-head — an honest 'why I'd take the third option' data point fits.",
    matchedKeywords: ["energy drink"],
    matchedCompetitors: ["celsius", "red bull"],
    subredditFit: 1,
    draft: {
      body: "Biased, I work on Monster, so grain of salt — but I'd take a White Monster Ultra over both. Zero sugar like Celsius but tastes better to me, and a bigger can than Red Bull for less per oz. Red Bull's still the move if you want that exact classic taste though.",
      rationale: "Owns affiliation, concedes both competitors' strengths, lands on the criteria asked.",
      criticScore: 3,
    },
  },
  {
    redditId: "mock_mon_03",
    subreddit: "energydrinks",
    title: "Red Bull just stopped working for me — anyone else?",
    body: "Used to give me a real kick, now I feel nothing. And the cans are tiny for what they cost.",
    author: "tolerance_tom",
    score: 256,
    numComments: 63,
    hoursAgo: 17,
    searchQuery: "red bull stopped working tolerance",
    discoveredVia: "competitor:red bull",
    classification: "competitor-mention",
    responseType: "share-experience",
    authenticityRisk: 0.27,
    relevanceScore: 73,
    baseScore: 65,
    recommendation: "engage",
    reasoning: "Tolerance + value complaint about a competitor — a higher-caffeine, bigger-can answer is genuinely responsive.",
    matchedKeywords: ["caffeine"],
    matchedCompetitors: ["red bull"],
    subredditFit: 1,
    draft: {
      body: "Tolerance is real, same thing happened to me. Red Bull's only ~80mg in a tiny can — switching to a White Monster Ultra (200mg, way bigger) fixed the 'nothing happens' for me. Biased since I work on Monster, but the caffeine gap alone is night and day.",
      rationale: "Answers the real cause (low dose) and the value gripe; product is the concrete fix.",
      criticScore: 3,
    },
  },
  {
    redditId: "mock_mon_04",
    subreddit: "energydrinks",
    title: "Celsius — really bad dehydration, night sweats, and headaches",
    body: "Been having one a day and lately I'm waking up drenched with headaches. Could the drink be doing this?",
    author: "sweaty_nights",
    score: 224,
    numComments: 119,
    hoursAgo: 26,
    searchQuery: "celsius dehydration night sweats",
    url: "https://www.reddit.com/r/energydrinks/comments/uac8fv/celsius_really_bad_dehydration_night_sweats_and/",
    discoveredVia: "competitor:celsius",
    classification: "competitor-mention",
    responseType: "answer-question",
    authenticityRisk: 0.36,
    relevanceScore: 67,
    baseScore: 59,
    recommendation: "engage",
    reasoning: "Competitor health complaint with a genuine answer — caffeine + the niacin in Celsius; an honest contrast is fine if it leads with real help.",
    matchedKeywords: ["caffeine"],
    matchedCompetitors: ["celsius"],
    subredditFit: 1,
    draft: {
      body: "Caffeine's a diuretic so any of them can do this if you're not matching it with water. That said, the big dose of niacin in Celsius gives some people the flush/sweats specifically — I work on Monster so grain of salt, but White Monster Ultra doesn't have that and it stopped for me. Drink water alongside either way.",
      rationale: "Leads with the real cause and a hydration fix; the contrast is honest and bias is owned.",
      criticScore: 4,
    },
  },

  // --- Scenario 2: complaint about White Monster → reassure (ER + astroturf gated) ---
  {
    redditId: "mock_mon_05",
    subreddit: "energydrinks",
    title: "White Monster Ultra is too sweet for me — anyone else?",
    body: "Everyone raves about it but the aftertaste is rough for me. Am I crazy or is there a less sweet option?",
    author: "not_so_sweet",
    score: 198,
    numComments: 76,
    hoursAgo: 22,
    searchQuery: "white monster ultra too sweet aftertaste",
    discoveredVia: "own:white monster",
    classification: "frustrated-user",
    responseType: "answer-question",
    authenticityRisk: 0.28,
    relevanceScore: 70,
    baseScore: 61,
    recommendation: "engage",
    reasoning: "Genuine taste complaint about our own brand — an honest 'try this variant or it's fine to pass' answer keeps the door open.",
    matchedKeywords: ["white monster", "ultra"],
    subredditFit: 1,
    draft: {
      body: "Totally fair, the sweetener isn't for everyone — I work on it so take that with salt. If the white one's too sweet, a lot of people find the Ultra Zero or Ultra Paradise read lighter. And if it's just not your thing, that's completely valid, no shame in passing.",
      rationale: "Concedes the flaw, offers a real alternative, and gives permission to walk away.",
      criticScore: 2,
    },
  },
  {
    redditId: "mock_mon_06",
    subreddit: "energydrinks",
    title: "Monster gives me the worst crash every time — anyone else?",
    body: "Love the taste but two hours later I'm completely wrecked. Is it just the sugar?",
    author: "midday_zombie",
    score: 311,
    numComments: 98,
    hoursAgo: 13,
    searchQuery: "monster crash sugar",
    discoveredVia: "own:monster",
    classification: "frustrated-user",
    responseType: "share-experience",
    authenticityRisk: 0.26,
    relevanceScore: 72,
    baseScore: 64,
    recommendation: "engage",
    reasoning: "Crash complaint about the sugary green can — an honest 'it's the sugar, try the zero-sugar one' answer genuinely helps.",
    matchedKeywords: ["monster", "crash"],
    subredditFit: 1,
    draft: {
      body: "That's the sugar in the regular green can. The fix for me was the White Monster (the Ultra) — zero sugar, so no hour-two cliff. Biased, I work on Monster, but the crash is a sugar thing, not the caffeine; the zero-sugar ones don't do it to me.",
      rationale: "Diagnoses the real cause and steers to the zero-sugar variant of our own brand.",
      criticScore: 3,
    },
  },
  {
    redditId: "mock_mon_07",
    subreddit: "energydrinks",
    title: "Monster sent me to the ER — heart palpitations, please watch your intake",
    body: "Slammed a few during a deadline and ended up in the ER with palpitations. Just a warning to everyone.",
    author: "er_survivor",
    score: 1180,
    numComments: 503,
    hoursAgo: 8,
    searchQuery: "monster energy ER heart palpitations",
    discoveredVia: "own:monster",
    classification: "frustrated-user",
    responseType: "skip",
    authenticityRisk: 0.95,
    relevanceScore: 38,
    baseScore: 52,
    recommendation: "skip",
    reasoning: "A health-scare / ER story about our own brand — any brand presence is tone-deaf and reputationally radioactive. Gate it.",
    matchedKeywords: ["monster"],
    subredditFit: 1,
    // No draft: the gate refuses this one.
  },
  {
    redditId: "mock_mon_08",
    subreddit: "energydrinks",
    title: "Is Monster astroturfing Reddit? Every thread shills the white one",
    body: "Every energy drink post has a conveniently-placed White Monster recommendation. Am I paranoid or is this coordinated marketing?",
    author: "pattern_noticer",
    score: 932,
    numComments: 388,
    hoursAgo: 3,
    searchQuery: "monster astroturfing reddit shilling white monster",
    discoveredVia: "own:monster",
    classification: "general",
    responseType: "skip",
    authenticityRisk: 0.93,
    relevanceScore: 40,
    baseScore: 54,
    recommendation: "skip",
    reasoning: "Thread is explicitly about suspected astroturfing — any pro-Monster comment confirms the suspicion and backfires. Gate it.",
    matchedKeywords: ["monster", "white monster"],
    subredditFit: 1,
    // No draft: the gate refuses this one.
  },

  // --- Scenario 3: exploration / suggestion asks ---
  {
    redditId: "mock_mon_09",
    subreddit: "college",
    title: "How do you actually pull an all-nighter without dying?",
    body: "Two midterms back to back and I have to stay up. What actually works for you guys?",
    author: "midterm_panic",
    score: 1340,
    numComments: 421,
    hoursAgo: 4,
    searchQuery: "all nighter stay awake midterms",
    discoveredVia: "topic:all nighter",
    classification: "similar-interest",
    responseType: "answer-question",
    authenticityRisk: 0.18,
    relevanceScore: 81,
    baseScore: 73,
    recommendation: "engage",
    reasoning: "High-traffic genuine ask — useful advice with caffeine staged in reads as help, not promo.",
    matchedKeywords: ["all nighter", "caffeine"],
    subredditFit: 0.6,
    draft: {
      body: "Hydrate way more than you think, snack on protein instead of sugar, and stage your caffeine — don't slam it all at midnight or you'll crash at 4am. I keep a White Monster Ultra for the 2am wall; biased since I work on Monster, but honestly a 20-min nap around 3 resets you more than another drink. Good luck.",
      rationale: "Leads with genuine all-nighter tactics; the product is one line inside real advice.",
      criticScore: 1,
    },
  },
  {
    redditId: "mock_mon_10",
    subreddit: "GetStudying",
    title: "Best thing to keep you awake during long study sessions?",
    body: "Coffee makes me jittery and then I crash. Looking for something steadier.",
    author: "deep_work_andy",
    score: 540,
    numComments: 152,
    hoursAgo: 13,
    searchQuery: "stay awake studying steadier than coffee",
    discoveredVia: "topic:stay awake studying",
    classification: "similar-interest",
    responseType: "share-experience",
    authenticityRisk: 0.2,
    relevanceScore: 76,
    baseScore: 68,
    recommendation: "engage",
    reasoning: "Asks specifically for a steadier alternative to coffee — direct, honest fit.",
    matchedKeywords: ["caffeine", "studying"],
    subredditFit: 0.6,
    draft: {
      body: "Cold room + a no-lyrics playlist does more for my focus than caffeine tbh. When I do need the boost, a White Monster Ultra lasts the whole session without the coffee jitter-then-crash. I work on Monster so grain of salt, but the zero-sugar part is why it doesn't wreck me mid-session.",
      rationale: "Validates the coffee complaint, positions the zero-sugar option as the steadier answer.",
      criticScore: 2,
    },
  },

  // --- Scenario 5: alternating caffeination / coffee on the go ---
  {
    redditId: "mock_mon_11",
    subreddit: "caffeine",
    title: "Coffee's great but such a pain on the go — how do you manage?",
    body: "I don't have time to brew or wait in a line every morning. What's your portable caffeine setup?",
    author: "always_late_commuter",
    score: 311,
    numComments: 98,
    hoursAgo: 19,
    searchQuery: "coffee on the go portable caffeine",
    discoveredVia: "topic:caffeine on the go",
    classification: "similar-interest",
    responseType: "share-experience",
    authenticityRisk: 0.24,
    relevanceScore: 74,
    baseScore: 66,
    recommendation: "engage",
    reasoning: "Explicit convenience pain point — a 'grab-and-go can' answer is genuinely responsive.",
    matchedKeywords: ["caffeine", "coffee"],
    subredditFit: 1,
    draft: {
      body: "This is exactly why I mostly switched to cans. Cold brew cans are decent but I grab a White Monster Ultra most mornings — 200mg, zero prep, fits in my bag. Biased, I work on Monster, but coffee's still better when I'm home with the time for it.",
      rationale: "Directly answers the convenience problem; coffee gets honest credit too.",
      criticScore: 2,
    },
  },
  {
    redditId: "mock_mon_12",
    subreddit: "Fitness",
    title: "What do you drink pre-workout that isn't a $40 tub of powder?",
    body: "Don't want the megadose pumps and tingles, just something to wake me up before lifting.",
    author: "budget_lifter",
    score: 825,
    numComments: 240,
    hoursAgo: 11,
    searchQuery: "cheap pre workout not a tub",
    discoveredVia: "topic:pre workout",
    classification: "similar-interest",
    responseType: "share-experience",
    authenticityRisk: 0.26,
    relevanceScore: 75,
    baseScore: 68,
    recommendation: "engage",
    reasoning: "Budget pre-workout ask — a cheap, zero-sugar option is a legitimately useful answer.",
    matchedKeywords: ["pre workout", "caffeine"],
    subredditFit: 0.6,
    draft: {
      body: "Half a White Monster Ultra ~20 min before I lift does the job and it's way cheaper than a $40 tub. Biased since I work on Monster, but zero sugar + 200mg is basically the useful part of a pre anyway. Add cheap citrulline separately if you want the pump.",
      rationale: "Answers the budget ask with a concrete cheap option; product is the caffeine source.",
      criticScore: 3,
    },
  },
];

// --- Scenario 4: original seeded posts (Post Creator) ---
export const MONSTER_POSTS: PostSeed[] = [
  {
    subreddit: "energydrinks",
    angle: "honest 30-day switch story",
    title: "Switched from coffee to White Monster Ultra for 30 days — the honest good and annoying",
    body: "Did a dumb little experiment: replaced my morning coffee with a White Monster Ultra for a month.\n\nGood: more consistent energy, no 11am crash (zero sugar), and a full 200mg actually carries me to lunch.\n\nAnnoying: it's a lot of caffeine first thing if you're not used to it, and I missed the ritual of actually making something.\n\nNet I'm mostly keeping it on weekdays and going back to coffee on weekends. Anyone else swap their morning coffee for a can — did it stick?",
    rationale: "Reads as a genuine n=1 experiment that invites replies; the product is the subject but framed with real downsides.",
    criticScore: 3,
  },
  {
    subreddit: "energydrinks",
    angle: "light relationship anecdote",
    title: "My girlfriend says I have a White Monster problem",
    body: "She counted the cans in the recycling and staged an intervention. In my defense it's one a day (...usually). Her actual complaint isn't even the caffeine — it's that I leave the empty cans everywhere.\n\nAnyway now I'm curious: what's the most ridiculous reason someone's called you out for an energy drink habit?",
    rationale: "Self-deprecating community-bait that normalizes daily use through a relatable story.",
    criticScore: 3,
  },
  {
    subreddit: "Fitness",
    angle: "pre-workout question seeding",
    title: "Anyone else using a half-can of White Monster Ultra as their pre-workout now?",
    body: "Got tired of the $40 tubs and the weird tingles. Lately it's half a White Monster Ultra about 20 min before lifting and honestly my sessions are fine.\n\nAm I leaving gains on the table by not running a real pre, or is the caffeine basically the part that matters for most people?",
    rationale: "Frames the product as a pre-workout via a genuine question, inviting validation from the community.",
    criticScore: 3,
  },
];

export const MONSTER_OPP_COUNT = MONSTER_OPPS.length;

// ---- Seeders (called from products.saveEnrichment for monsterenergy.com) ----

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

// Seed a single mock opportunity (+ its draft) and advance discovery progress.
// Staggered by the scheduler so the dashboard populates live, like real search.
export const seedOpportunity = internalMutation({
  args: { productId: v.id("products"), index: v.number() },
  handler: async (ctx, { productId, index }) => {
    const d = MONSTER_OPPS[index];
    if (!d) return;

    const nowSec = Math.floor(Date.now() / 1000);
    const vol = Math.max(0, d.score) + Math.max(0, d.numComments);
    // Prefer an explicit real thread permalink; otherwise a real subreddit
    // search deep-link (always resolves to genuine, on-topic discussions).
    let url: string;
    let path: string;
    if (d.url) {
      url = d.url;
      try {
        const u = new URL(d.url);
        path = u.pathname + u.search;
      } catch {
        path = "/";
      }
    } else {
      path = `/r/${d.subreddit}/search/?q=${encodeURIComponent(d.searchQuery)}&restrict_sr=1&sort=relevance`;
      url = `https://www.reddit.com${path}`;
    }

    const product = await ctx.db.get(productId);
    const productName = product?.name || "White Monster";
    const disclosure = DEFAULT_DISCLOSURE.replace(/\{\{product\}\}/g, productName);

    const signals = {
      matchedKeywords: d.matchedKeywords ?? [],
      matchedCompetitors: d.matchedCompetitors ?? [],
      keywordOverlap: clamp01((d.matchedKeywords?.length ?? 0) / 3),
      competitorMention: (d.matchedCompetitors?.length ?? 0) > 0,
      recency: clamp01(Math.exp(-d.hoursAgo / 72)),
      engagement: clamp01(Math.log10(vol + 1) / 3.5),
      subredditFit: d.subredditFit ?? 0.6,
    };

    const common = {
      productId,
      redditId: d.redditId,
      subreddit: d.subreddit,
      title: d.title,
      body: d.body,
      permalink: path,
      url,
      author: d.author,
      score: d.score,
      numComments: d.numComments,
      createdUtc: nowSec - d.hoursAgo * 3600,
      discoveredVia: d.discoveredVia,
      signals,
      baseScore: d.baseScore,
      actionToken: newToken(),
      createdAt: Date.now(),
    };
    const draft = isRedditThreadUrl(url) ? d.draft : undefined;

    // The Monster demo is curated so the employee portal reliably has copyable
    // rows even when the live classifier is stricter than expected.
    const oppId = await ctx.db.insert("opportunities", {
      ...common,
      relevanceScore: d.relevanceScore,
      classification: d.classification,
      responseType: d.responseType,
      authenticityRisk: d.authenticityRisk,
      recommendation: d.recommendation,
      reasoning: d.reasoning,
      pipelineStage: draft ? "drafted" : "scored",
      status: "queued",
      scoredAt: Date.now(),
      draftedAt: draft ? Date.now() : undefined,
    });
    if (draft) {
      await ctx.db.insert("drafts", {
        opportunityId: oppId,
        productId,
        body: draft.body,
        disclosureLine: disclosure,
        rationale: draft.rationale,
        criticScore: draft.criticScore,
        criticVerdict: "reads as a genuine, disclosed peer comment",
        regenerated: false,
        model: MODEL_DRAFT,
        version: 1,
        createdAt: Date.now(),
      });
    }

    if (product) {
      const done = product.searchesDone + 1;
      await ctx.db.patch(productId, {
        searchesDone: done,
        status: done >= product.searchesTotal ? "ready" : product.status,
      });
    }
  },
});

// Seed the post-creation ("new post") demo entries.
export const seedPosts = internalMutation({
  args: { productId: v.id("products") },
  handler: async (ctx, { productId }) => {
    const product = await ctx.db.get(productId);
    const productName = product?.name || "White Monster";
    const disclosure = DEFAULT_DISCLOSURE.replace(/\{\{product\}\}/g, productName);

    for (const post of MONSTER_POSTS) {
      await ctx.db.insert("campaignPosts", {
        productId,
        subreddit: post.subreddit,
        angle: post.angle,
        title: post.title,
        body: post.body,
        disclosureLine: disclosure,
        rationale: post.rationale,
        criticScore: post.criticScore,
        pipelineStage: "ready",
        status: "queued",
        actionToken: newToken(),
        createdAt: Date.now(),
      });
    }
  },
});
