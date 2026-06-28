import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { OpportunityCard } from "@/components/OpportunityCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Inbox } from "lucide-react";

export function OpportunitiesTab({ productId }: { productId: Id<"products"> }) {
  const opportunities = useQuery(api.opportunities.list, { productId });
  const drafts = useQuery(api.drafts.listByProduct, { productId });
  const [showSkipped, setShowSkipped] = useState(false);

  const draftMap = useMemo(() => {
    const m = new Map<string, Doc<"drafts">>();
    for (const d of drafts ?? []) m.set(d.opportunityId, d);
    return m;
  }, [drafts]);

  const stats = useMemo(() => {
    const list = opportunities ?? [];
    return {
      total: list.length,
      engage: list.filter((o) => o.recommendation === "engage").length,
      skip: list.filter((o) => o.recommendation === "skip").length,
      drafted: list.filter((o) => o.pipelineStage === "drafted").length,
    };
  }, [opportunities]);

  if (opportunities === undefined) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </div>
    );
  }

  const visible = opportunities.filter(
    (o) => o.status !== "dismissed" && (showSkipped || o.recommendation !== "skip"),
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3 font-mono text-xs text-muted-foreground">
          <Stat label="opportunities" value={stats.total} />
          <Stat label="engage" value={stats.engage} className="text-emerald-300" />
          <Stat label="drafted" value={stats.drafted} className="text-primary" />
          <Stat label="gated" value={stats.skip} className="text-muted-foreground" />
        </div>
        <Button
          size="sm"
          variant={showSkipped ? "secondary" : "ghost"}
          className="h-7 text-xs"
          onClick={() => setShowSkipped((s) => !s)}
        >
          {showSkipped ? "Hide" : "Show"} gated ({stats.skip})
        </Button>
      </div>

      {visible.length === 0 ? (
        <EmptyState total={stats.total} />
      ) : (
        visible.map((o) => (
          <OpportunityCard key={o._id} opp={o} draft={draftMap.get(o._id)} />
        ))
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("tabular text-sm font-semibold text-foreground", className)}>{value}</span>
      <span className="uppercase tracking-wide">{label}</span>
    </span>
  );
}

function EmptyState({ total }: { total: number }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-16 text-center">
      <Inbox className="size-6 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        {total === 0
          ? "No opportunities yet — discovery runs as enrichment completes."
          : "All current opportunities are gated. Toggle “Show gated” to review them."}
      </p>
    </div>
  );
}
