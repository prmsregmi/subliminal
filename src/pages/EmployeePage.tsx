import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Link } from "react-router-dom";
import { OpportunityCard } from "@/components/OpportunityCard";
import { OperatorBar } from "@/components/OperatorBar";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, Radio } from "lucide-react";

// Tier index → human label (matches the targeting skill's four tiers).
const TIER = ["", "Direct", "Competitor", "Indirect", "Far-stretch"];

function whenLabel(ts: number | null): string {
  if (ts == null) return "unscheduled";
  return new Date(ts).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Employee console — the SEPARATE dashboard that tells a human exactly WHAT to
// post and WHEN. The schedule is laid out by the timing algorithm to stay under
// each subreddit's mod radar (daily cap, per-sub cooldown, peak windows).
export default function EmployeePage() {
  const queue = useQuery(api.opportunities.employeeQueue);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto w-full max-w-[920px] px-4 py-5">
        <div className="mb-4">
          <h1 className="text-lg font-semibold tracking-tight">Posting queue</h1>
          <p className="text-sm text-muted-foreground">
            What to post and when. The schedule spaces posts to stay under each subreddit's mod
            radar — work them top to bottom.
          </p>
        </div>

        {queue === undefined ? (
          <p className="text-sm text-muted-foreground">Loading queue…</p>
        ) : queue.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Nothing scheduled yet. Drafted opportunities show up here once a product finishes
            discovery.
          </div>
        ) : (
          <div className="space-y-5">
            {queue.map((row) => (
              <div key={row.opportunity._id}>
                <div className="mb-1.5 flex flex-wrap items-center gap-2 px-1 font-mono text-xs">
                  <span className="flex items-center gap-1.5 font-semibold text-primary">
                    <CalendarClock className="size-3.5" /> {whenLabel(row.scheduledFor)}
                  </span>
                  <span className="text-muted-foreground">· {row.productName}</span>
                  {typeof row.opportunity.targetTier === "number" && (
                    <Badge variant="outline">{TIER[row.opportunity.targetTier] ?? "—"}</Badge>
                  )}
                  {row.scheduleReason && (
                    <span className="hidden text-muted-foreground/70 sm:inline">
                      · {row.scheduleReason}
                    </span>
                  )}
                </div>
                <OpportunityCard opp={row.opportunity} draft={row.draft ?? undefined} />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[920px] items-center justify-between gap-4 px-4 py-3">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="relative flex size-7 items-center justify-center rounded-md bg-primary/15 ring-1 ring-primary/30">
            <span className="size-2.5 rounded-full bg-primary" />
          </span>
          <div className="leading-tight">
            <div className="font-mono text-sm font-bold tracking-[0.16em]">SUBLIMINAL</div>
            <div className="hidden text-[10px] text-muted-foreground sm:block">employee console</div>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-1.5 font-mono text-[11px] text-emerald-300 sm:flex">
            <Radio className="size-3.5 animate-pulse" /> live
          </span>
          <OperatorBar />
        </div>
      </div>
    </header>
  );
}
