import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Link } from "react-router-dom";
import { OpportunityCard } from "@/components/OpportunityCard";
import { OperatorBar } from "@/components/OperatorBar";
import { useOperator } from "@/store/operator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/CopyButton";
import { ScoreMeter } from "@/components/ScoreMeter";
import { StatusBadge } from "@/components/Badges";
import type { Doc } from "../../convex/_generated/dataModel";
import {
  CalendarClock,
  ExternalLink,
  LayoutGrid,
  Link2,
  ListChecks,
  MessageSquare,
  PenLine,
} from "lucide-react";

// Tier index → human label (matches the targeting skill's four tiers).
const TIER = ["", "Direct", "Competitor", "Indirect", "Far-stretch"];

type CommentQueueRow = {
  kind: "comment";
  opportunity: Doc<"opportunities">;
  draft: Doc<"drafts">;
  productName: string;
  scheduledFor: number | null;
  scheduleReason?: string | null;
};

type PostQueueRow = {
  kind: "post";
  post: Doc<"campaignPosts">;
  disclosureLine: string;
  productName: string;
  scheduledFor: number | null;
  scheduleReason?: string | null;
};

type QueueRow = CommentQueueRow | PostQueueRow;

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
  const [view, setView] = useState<"cards" | "table">("cards");

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto w-full max-w-[1180px] px-4 py-5">
        <div className="mb-4">
          <div>
            <div className="label-eyebrow mb-2">Employee portal</div>
            <h1 className="text-xl font-semibold tracking-tight">Reddit posting queue</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              Generated posts for the team to review, copy, and publish manually. Work from the
              earliest scheduled item down.
            </p>
          </div>
        </div>

        <Card className="mb-5 flex flex-wrap items-center justify-between gap-3 p-3">
          <div className="px-1">
            <div className="label-eyebrow">Queue view</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Switch layouts depending on whether you want detail or scan speed.
            </p>
          </div>
          <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1">
            <Button
              type="button"
              size="sm"
              variant={view === "cards" ? "secondary" : "ghost"}
              className="gap-1.5"
              onClick={() => setView("cards")}
            >
              <LayoutGrid className="size-3.5" />
              Cards
            </Button>
            <Button
              type="button"
              size="sm"
              variant={view === "table" ? "secondary" : "ghost"}
              className="gap-1.5"
              onClick={() => setView("table")}
            >
              <ListChecks className="size-3.5" />
              Table
            </Button>
          </div>
        </Card>

        {queue === undefined ? (
          <p className="text-sm text-muted-foreground">Loading queue…</p>
        ) : queue.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Nothing scheduled yet. Generated comments and original posts show up here once a
            product finishes discovery.
          </div>
        ) : view === "cards" ? (
          <CardQueue rows={queue} />
        ) : (
          <TableQueue rows={queue} />
        )}
      </main>
    </div>
  );
}

function CardQueue({ rows }: { rows: QueueRow[] }) {
  return (
    <div className="space-y-5">
      {rows.map((row) => (
        row.kind === "comment" ? (
          <CommentQueueCard key={row.opportunity._id} row={row} />
        ) : (
          <PostQueueCard key={row.post._id} row={row} />
        )
      ))}
    </div>
  );
}

function CommentQueueCard({ row }: { row: CommentQueueRow }) {
  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center gap-2 px-1 font-mono text-xs">
        <span className="flex items-center gap-1.5 font-semibold text-primary">
          <CalendarClock className="size-3.5" /> {whenLabel(row.scheduledFor)}
        </span>
        <span className="text-muted-foreground">· {row.productName}</span>
        <Badge variant="outline" className="gap-1">
          <MessageSquare className="size-3" /> Comment
        </Badge>
        {typeof row.opportunity.targetTier === "number" && (
          <Badge variant="outline">{TIER[row.opportunity.targetTier] ?? "—"}</Badge>
        )}
        {row.scheduleReason && (
          <span className="hidden text-muted-foreground/70 sm:inline">· {row.scheduleReason}</span>
        )}
      </div>
      <OpportunityCard opp={row.opportunity} draft={row.draft} />
    </div>
  );
}

function PostQueueCard({ row }: { row: PostQueueRow }) {
  const post = row.post;
  const actionUrl = `${window.location.origin}/action/${post.actionToken}`;
  const fullText = `${post.title}\n\n${post.body}\n\n${row.disclosureLine}`;

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center gap-2 px-1 font-mono text-xs">
        <span className="flex items-center gap-1.5 font-semibold text-primary">
          <CalendarClock className="size-3.5" /> {whenLabel(row.scheduledFor)}
        </span>
        <span className="text-muted-foreground">· {row.productName}</span>
        <Badge variant="outline" className="gap-1">
          <PenLine className="size-3" /> Original post
        </Badge>
        {row.scheduleReason && (
          <span className="hidden text-muted-foreground/70 sm:inline">· {row.scheduleReason}</span>
        )}
      </div>
      <Card className="gap-0 p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3.5">
          <span className="font-mono text-xs font-semibold">r/{post.subreddit}</span>
          <div className="flex items-center gap-2">
            {typeof post.criticScore === "number" && (
              <span className="font-mono text-[11px] text-muted-foreground">
                salesiness {post.criticScore}/10
              </span>
            )}
            <StatusBadge value={post.status} />
          </div>
        </div>
        <div className="px-4 py-3">
          <h3 className="text-[15px] font-semibold leading-snug">{post.title}</h3>
          <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
            {post.body}
          </p>
          <p className="mt-2 text-xs italic text-muted-foreground">{row.disclosureLine}</p>
          {post.angle && (
            <p className="mt-2 font-mono text-[11px] text-muted-foreground">angle: {post.angle}</p>
          )}
          {post.rationale && (
            <p className="mt-2 text-xs text-muted-foreground">{post.rationale}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5 border-t border-border px-4 py-2.5">
          <CopyButton text={fullText} label="Copy post" />
          <CopyButton text={actionUrl} label="Link" className="px-2" />
          <Button asChild size="sm" className="gap-1.5">
            <a href={`/action/${post.actionToken}`} target="_blank" rel="noreferrer">
              <Link2 className="size-3.5" /> Open action
            </a>
          </Button>
        </div>
      </Card>
    </div>
  );
}

function TableQueue({ rows }: { rows: QueueRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">When</th>
              <th className="px-3 py-2 font-medium">Thread</th>
              <th className="px-3 py-2 font-medium">Fit</th>
              <th className="px-3 py-2 font-medium">Draft preview</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              if (row.kind === "post") {
                const post = row.post;
                const fullText = `${post.title}\n\n${post.body}\n\n${row.disclosureLine}`;
                return (
                  <tr key={post._id} className="border-b border-border/70 align-top last:border-b-0">
                    <td className="w-36 px-3 py-3">
                      <div className="flex items-center gap-1.5 font-medium text-primary">
                        <CalendarClock className="size-3.5" />
                        <span>{whenLabel(row.scheduledFor)}</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{row.productName}</div>
                    </td>
                    <td className="max-w-[260px] px-3 py-3">
                      <div className="font-mono text-xs text-muted-foreground">r/{post.subreddit}</div>
                      <div className="mt-1 line-clamp-2 font-medium leading-snug">{post.title}</div>
                      <Badge variant="outline" className="mt-2 gap-1">
                        <PenLine className="size-3" /> Original post
                      </Badge>
                    </td>
                    <td className="w-40 px-3 py-3">
                      {typeof post.criticScore === "number" ? (
                        <span className="font-mono text-xs text-muted-foreground">
                          salesiness {post.criticScore}/10
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">ready</span>
                      )}
                    </td>
                    <td className="max-w-[330px] px-3 py-3">
                      <p className="line-clamp-3 leading-6 text-muted-foreground">{post.body}</p>
                      <p className="mt-1 text-xs italic text-muted-foreground/80">
                        {row.disclosureLine}
                      </p>
                    </td>
                    <td className="w-28 px-3 py-3">
                      <StatusBadge value={post.status} />
                    </td>
                    <td className="w-52 px-3 py-3">
                      <div className="flex justify-end gap-1.5">
                        <CopyButton text={fullText} label="Copy" />
                        <Button asChild size="sm" variant="outline" className="gap-1.5">
                          <a href={`/action/${post.actionToken}`} target="_blank" rel="noreferrer">
                            <ExternalLink className="size-3.5" />
                            Open
                          </a>
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              }

              const opp = row.opportunity;
              const draft = row.draft;
              const fullDraft = `${draft.body}\n\n${draft.disclosureLine}`;
              return (
                <tr key={opp._id} className="border-b border-border/70 align-top last:border-b-0">
                  <td className="w-36 px-3 py-3">
                    <div className="flex items-center gap-1.5 font-medium text-primary">
                      <CalendarClock className="size-3.5" />
                      <span>{whenLabel(row.scheduledFor)}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{row.productName}</div>
                  </td>
                  <td className="max-w-[260px] px-3 py-3">
                    <div className="font-mono text-xs text-muted-foreground">r/{opp.subreddit}</div>
                    <a
                      href={opp.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 line-clamp-2 font-medium leading-snug hover:text-primary"
                    >
                      {opp.title}
                    </a>
                  </td>
                  <td className="w-40 px-3 py-3">
                    <div className="flex items-center gap-2">
                      <ScoreMeter score={opp.relevanceScore} />
                    </div>
                    <div className="mt-2">
                      {typeof opp.targetTier === "number" && (
                        <Badge variant="outline">{TIER[opp.targetTier] ?? "—"}</Badge>
                      )}
                    </div>
                  </td>
                  <td className="max-w-[330px] px-3 py-3">
                    {draft ? (
                      <>
                        <p className="line-clamp-3 leading-6 text-muted-foreground">{draft.body}</p>
                        <p className="mt-1 text-xs italic text-muted-foreground/80">
                          {draft.disclosureLine}
                        </p>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">Draft pending</span>
                    )}
                  </td>
                  <td className="w-28 px-3 py-3">
                    <StatusBadge value={opp.status} />
                  </td>
                  <td className="w-52 px-3 py-3">
                    <div className="flex justify-end gap-1.5">
                      {draft && <CopyButton text={fullDraft} label="Copy" />}
                      <Button asChild size="sm" variant="outline" className="gap-1.5">
                        <a href={`/action/${opp.actionToken}`} target="_blank" rel="noreferrer">
                          <ExternalLink className="size-3.5" />
                          Open
                        </a>
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Header() {
  const { clear } = useOperator();

  return (
    <header className="sticky top-0 z-20 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[1180px] items-center justify-between gap-4 px-4 py-3">
        <Link to="/" onClick={clear} className="flex items-center gap-2.5">
          <span className="relative flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <span className="size-3 rounded-full bg-primary-foreground" />
          </span>
          <div className="leading-tight">
            <div className="text-sm font-bold tracking-wide">Subliminal</div>
            <div className="hidden text-[10px] text-muted-foreground sm:block">Employee portal</div>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            to="/"
            onClick={clear}
            className="inline-flex h-8 items-center rounded-lg border border-border bg-card px-3 text-sm font-medium text-muted-foreground shadow-sm transition-colors hover:border-primary/30 hover:text-foreground"
          >
            Client portal
          </Link>
          <OperatorBar className="justify-end" />
        </div>
      </div>
    </header>
  );
}
