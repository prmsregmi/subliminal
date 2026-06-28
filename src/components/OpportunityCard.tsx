import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CopyButton } from "@/components/CopyButton";
import { ScoreMeter } from "@/components/ScoreMeter";
import { ClassificationBadge, RecommendationBadge, StatusBadge } from "@/components/Badges";
import { cn } from "@/lib/utils";
import { timeAgo, RESPONSE_TYPE_LABEL, criticTone } from "@/lib/format";
import { useOperator } from "@/store/operator";
import {
  ArrowUp,
  ExternalLink,
  Link2,
  Loader2,
  MessageSquare,
  RotateCcw,
  UserCheck,
  X,
} from "lucide-react";

export function OpportunityCard({
  opp,
  draft,
}: {
  opp: Doc<"opportunities">;
  draft?: Doc<"drafts">;
}) {
  const assign = useMutation(api.opportunities.assign);
  const dismiss = useMutation(api.opportunities.dismiss);
  const requeue = useMutation(api.opportunities.requeue);
  const { operatorId } = useOperator();

  const actionUrl = `${window.location.origin}/action/${opp.actionToken}`;
  const isSkip = opp.recommendation === "skip";
  const fullDraft = draft ? `${draft.body}\n\n${draft.disclosureLine}` : "";

  return (
    <Card
      className={cn(
        "gap-0 p-0 transition-opacity",
        isSkip && opp.status === "queued" && "opacity-60 hover:opacity-100",
      )}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3.5">
        <div className="flex items-center gap-2.5 font-mono text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">r/{opp.subreddit}</span>
          <span>·</span>
          <span>{timeAgo(opp.createdUtc * 1000)}</span>
          <span className="flex items-center gap-1">
            <ArrowUp className="size-3" /> {opp.score}
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare className="size-3" /> {opp.numComments}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <ClassificationBadge value={opp.classification} />
          <RecommendationBadge value={opp.recommendation} />
          <StatusBadge value={opp.status} />
        </div>
      </div>

      {/* Title + body */}
      <div className="px-4 pt-2">
        <a
          href={opp.url}
          target="_blank"
          rel="noreferrer"
          className="group inline-flex items-start gap-1 text-[15px] font-semibold leading-snug hover:text-primary"
        >
          {opp.title}
          <ExternalLink className="mt-1 size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
        </a>
        {opp.body && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{opp.body}</p>
        )}
      </div>

      {/* Algorithm row */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 pt-3">
        <div className="flex items-center gap-2">
          <span className="label-eyebrow">relevance</span>
          <ScoreMeter score={opp.relevanceScore} />
        </div>
        {typeof opp.authenticityRisk === "number" && (
          <div className="flex items-center gap-1.5">
            <span className="label-eyebrow">bs-risk</span>
            <span className={cn("font-mono text-xs", criticTone(opp.authenticityRisk * 10))}>
              {Math.round(opp.authenticityRisk * 100)}%
            </span>
          </div>
        )}
        {opp.responseType && opp.responseType !== "skip" && (
          <span className="font-mono text-[11px] text-muted-foreground">
            → {RESPONSE_TYPE_LABEL[opp.responseType] ?? opp.responseType}
          </span>
        )}
        {opp.signals.matchedKeywords.length > 0 && (
          <span className="font-mono text-[11px] text-muted-foreground">
            matched: {opp.signals.matchedKeywords.slice(0, 4).join(", ")}
          </span>
        )}
        {opp.signals.matchedCompetitors.length > 0 && (
          <span className="font-mono text-[11px] text-amber-700">
            mentions: {opp.signals.matchedCompetitors.join(", ")}
          </span>
        )}
      </div>

      {opp.reasoning && (
        <p className="px-4 pt-2 text-xs italic text-muted-foreground/90">“{opp.reasoning}”</p>
      )}

      {/* Draft / pipeline state */}
      <div className="px-4 pb-3 pt-3">
        {draft ? (
          <div className="rounded-lg border border-primary/20 bg-primary/[0.04] p-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="label-eyebrow text-primary/80">generated draft</span>
              <div className="flex items-center gap-2">
                {draft.regenerated && (
                  <span className="font-mono text-[10px] text-muted-foreground">
                    regenerated ↺
                  </span>
                )}
                <span className={cn("font-mono text-[11px]", criticTone(draft.criticScore))}>
                  salesiness {draft.criticScore}/10
                </span>
              </div>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{draft.body}</p>
            <p className="mt-2 text-xs italic text-muted-foreground">{draft.disclosureLine}</p>
          </div>
        ) : (
          <PipelineState stage={opp.pipelineStage} recommendation={opp.recommendation} />
        )}
      </div>

      <Separator />

      {/* Footer actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
        <span className="text-xs text-muted-foreground">
          {opp.assignedToName ? (
            <span className="flex items-center gap-1.5">
              <UserCheck className="size-3.5 text-indigo-400" /> {opp.assignedToName}
            </span>
          ) : (
            <span className="text-muted-foreground/60">unassigned</span>
          )}
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          {draft && <CopyButton text={fullDraft} label="Copy draft" />}
          {operatorId && opp.status === "queued" && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => assign({ opportunityId: opp._id, operatorId })}
            >
              <UserCheck className="size-3.5" /> Assign to me
            </Button>
          )}
          {opp.status !== "queued" && opp.status !== "completed" && (
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 text-muted-foreground"
              onClick={() => requeue({ opportunityId: opp._id })}
            >
              <RotateCcw className="size-3.5" /> Requeue
            </Button>
          )}
          <CopyButton text={actionUrl} label="Link" className="px-2" />
          <Button asChild size="sm" className="gap-1.5">
            <a href={`/action/${opp.actionToken}`} target="_blank" rel="noreferrer">
              <Link2 className="size-3.5" /> Open action
            </a>
          </Button>
          {opp.status !== "completed" && (
            <Button
              size="icon"
              variant="ghost"
              className="size-8 text-muted-foreground hover:text-rose-700"
              title="Dismiss"
              onClick={() => dismiss({ opportunityId: opp._id })}
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function PipelineState({
  stage,
  recommendation,
}: {
  stage: string;
  recommendation?: "engage" | "skip";
}) {
  if (recommendation === "skip")
    return (
      <p className="text-xs text-muted-foreground">
        Algorithm recommends <span className="font-medium">skipping</span> — a product mention here
        would read as marketing.
      </p>
    );
  const label =
    stage === "discovered"
      ? "scoring & classifying…"
      : stage === "scored"
        ? "writing draft…"
        : stage === "error"
          ? "pipeline error"
          : "processing…";
  return (
    <p className="flex items-center gap-2 text-xs text-muted-foreground">
      {stage !== "error" && <Loader2 className="size-3.5 animate-spin" />}
      {label}
    </p>
  );
}
