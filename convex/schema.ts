import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Shared validators (re-used in function args).
export const vClassification = v.union(
  v.literal("competitor-mention"),
  v.literal("frustrated-user"),
  v.literal("similar-interest"),
  v.literal("general"),
);

// What KIND of engagement the algorithm recommends for a post. "skip" is the
// honesty gate: the system actively refuses posts where a comment would read as
// marketing — the strongest defense against Reddit's BS meter.
export const vResponseType = v.union(
  v.literal("answer-question"),
  v.literal("share-experience"),
  v.literal("add-data-point"),
  v.literal("mention-if-relevant"),
  v.literal("skip"),
);

// Human-in-the-loop workflow lifecycle.
export const vWorkflowStatus = v.union(
  v.literal("queued"),
  v.literal("assigned"),
  v.literal("opened"),
  v.literal("completed"),
  v.literal("dismissed"),
);

export const vSignals = v.object({
  matchedKeywords: v.array(v.string()),
  matchedCompetitors: v.array(v.string()),
  keywordOverlap: v.number(),
  competitorMention: v.boolean(),
  recency: v.number(),
  engagement: v.number(),
  subredditFit: v.number(),
});

export default defineSchema({
  // The submitted product website + its OrangeSlice-derived enrichment.
  products: defineTable({
    url: v.string(),
    domain: v.string(),
    name: v.optional(v.string()),
    status: v.union(
      v.literal("enriching"),
      v.literal("discovering"),
      v.literal("ready"),
      v.literal("error"),
    ),
    category: v.optional(v.string()),
    summary: v.optional(v.string()),
    ownKeywords: v.array(v.string()),
    competitorDomains: v.array(v.string()),
    topicTerms: v.array(v.string()),
    disclosureTemplate: v.string(),
    searchesTotal: v.number(),
    searchesDone: v.number(),
    enrichmentRaw: v.optional(v.any()),
    errorMessage: v.optional(v.string()),
    discoveryError: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_domain", ["domain"]),

  // A discovered Reddit thread = a comment-seeding opportunity.
  opportunities: defineTable({
    productId: v.id("products"),
    redditId: v.string(),
    subreddit: v.string(),
    title: v.string(),
    body: v.string(),
    permalink: v.string(),
    url: v.string(),
    author: v.optional(v.string()),
    score: v.number(),
    numComments: v.number(),
    createdUtc: v.number(),
    discoveredVia: v.string(),
    signals: vSignals,
    baseScore: v.number(),
    relevanceScore: v.number(),
    classification: v.optional(vClassification),
    responseType: v.optional(vResponseType),
    authenticityRisk: v.optional(v.number()),
    recommendation: v.optional(
      v.union(v.literal("engage"), v.literal("skip")),
    ),
    reasoning: v.optional(v.string()),
    pipelineStage: v.union(
      v.literal("discovered"),
      v.literal("scored"),
      v.literal("drafted"),
      v.literal("error"),
    ),
    status: vWorkflowStatus,
    assignedTo: v.optional(v.id("operators")),
    assignedToName: v.optional(v.string()),
    actionToken: v.string(),
    completedNote: v.optional(v.string()),
    scoredAt: v.optional(v.number()),
    draftedAt: v.optional(v.number()),
    openedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_product", ["productId"])
    .index("by_product_and_reddit", ["productId", "redditId"])
    .index("by_token", ["actionToken"]),

  // The Anthropic-generated, disclosed comment draft for an opportunity.
  drafts: defineTable({
    opportunityId: v.id("opportunities"),
    productId: v.id("products"),
    body: v.string(),
    disclosureLine: v.string(),
    rationale: v.optional(v.string()),
    criticScore: v.number(),
    criticVerdict: v.optional(v.string()),
    regenerated: v.boolean(),
    model: v.string(),
    version: v.number(),
    createdAt: v.number(),
  })
    .index("by_opportunity", ["opportunityId"])
    .index("by_product", ["productId"]),

  // Post-creation mode: an original post (title + body) for a chosen subreddit.
  campaignPosts: defineTable({
    productId: v.id("products"),
    subreddit: v.string(),
    angle: v.optional(v.string()),
    title: v.string(),
    body: v.string(),
    disclosureLine: v.string(),
    rationale: v.optional(v.string()),
    criticScore: v.optional(v.number()),
    pipelineStage: v.union(
      v.literal("generating"),
      v.literal("ready"),
      v.literal("error"),
    ),
    status: vWorkflowStatus,
    assignedTo: v.optional(v.id("operators")),
    assignedToName: v.optional(v.string()),
    actionToken: v.string(),
    errorMessage: v.optional(v.string()),
    openedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_product", ["productId"])
    .index("by_token", ["actionToken"]),

  operators: defineTable({
    name: v.string(),
    createdAt: v.number(),
  }),
});
