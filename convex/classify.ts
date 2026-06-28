import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { callStructured } from "./lib/anthropic";
import { combineScores } from "./lib/scoring";
import { MODEL_CLASSIFY, SKIP_RISK_THRESHOLD, MIN_ENGAGE_SCORE } from "./constants";

const CLASSIFY_SCHEMA = {
  type: "object",
  properties: {
    classification: {
      type: "string",
      enum: ["competitor-mention", "frustrated-user", "similar-interest", "general"],
    },
    responseType: {
      type: "string",
      enum: [
        "answer-question",
        "share-experience",
        "add-data-point",
        "mention-if-relevant",
        "skip",
      ],
    },
    authenticityRisk: {
      type: "number",
      description:
        "0..1 — how likely a disclosed comment that mentions our product would read as spam/marketing to skeptical Redditors. Higher = riskier.",
    },
    semanticRelevance: {
      type: "number",
      description: "0..100 — how relevant this thread is to our product and its audience.",
    },
    reasoning: { type: "string", description: "One or two sentences explaining the call." },
  },
  required: ["classification", "responseType", "authenticityRisk", "semanticRelevance", "reasoning"],
};

interface ClassifyResult {
  classification: "competitor-mention" | "frustrated-user" | "similar-interest" | "general";
  responseType:
    | "answer-question"
    | "share-experience"
    | "add-data-point"
    | "mention-if-relevant"
    | "skip";
  authenticityRisk: number;
  semanticRelevance: number;
  reasoning: string;
}

export const run = internalAction({
  args: { opportunityId: v.id("opportunities") },
  handler: async (ctx, { opportunityId }) => {
    const opp = await ctx.runQuery(internal.opportunities.getInternal, { opportunityId });
    if (!opp) return;
    const product = await ctx.runQuery(internal.products.getInternal, {
      productId: opp.productId,
    });
    if (!product) return;

    try {
      const prompt = [
        "We promote a product on Reddit HONESTLY — only engaging where a genuinely useful, disclosed comment is welcome, and skipping anywhere it would read as marketing.",
        "",
        `OUR PRODUCT: ${product.name || product.domain} — ${product.summary || product.category || ""}`,
        `Our keywords: ${product.ownKeywords.join(", ")}`,
        `Competitors: ${product.competitorDomains.join(", ")}`,
        "",
        "REDDIT THREAD:",
        `r/${opp.subreddit} — "${opp.title}"`,
        opp.body ? opp.body.slice(0, 1500) : "(no body text)",
        `Score: ${opp.score}, Comments: ${opp.numComments}`,
        "",
        'Classify this thread and judge whether engaging is worthwhile. Reddit users have a very strong "BS meter" — even soft marketing is detected. Set a HIGH authenticityRisk and responseType "skip" if a product mention here would feel forced or salesy. Only recommend engaging where we can genuinely help.',
      ].join("\n");

      const r = await callStructured<ClassifyResult>({
        model: MODEL_CLASSIFY,
        prompt,
        toolName: "classify_opportunity",
        toolDescription: "Classify a Reddit thread and judge engagement worthiness.",
        schema: CLASSIFY_SCHEMA,
        maxTokens: 500,
      });

      const semantic = Math.max(0, Math.min(100, Number(r.semanticRelevance) || 0));
      const risk = Math.max(0, Math.min(1, Number(r.authenticityRisk) || 0));
      const finalScore = combineScores(opp.baseScore, semantic);
      const recommendation =
        risk > SKIP_RISK_THRESHOLD || finalScore < MIN_ENGAGE_SCORE || r.responseType === "skip"
          ? "skip"
          : "engage";

      await ctx.runMutation(internal.opportunities.applyClassification, {
        opportunityId,
        classification: r.classification,
        responseType: r.responseType,
        authenticityRisk: risk,
        relevanceScore: finalScore,
        recommendation,
        reasoning: String(r.reasoning || ""),
      });
    } catch (e) {
      console.error("[classify] failed:", e);
      await ctx.runMutation(internal.opportunities.setStageError, { opportunityId });
    }
  },
});
