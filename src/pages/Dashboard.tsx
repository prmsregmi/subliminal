import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { SubmitForm } from "@/components/SubmitForm";
import { ProductRail } from "@/components/ProductRail";
import { ProductPanel } from "@/components/ProductPanel";
import { OperatorBar } from "@/components/OperatorBar";
import { Card } from "@/components/ui/card";
import { Radio, Users, Target, Search, ThumbsUp, ShieldX, PenLine, Send } from "lucide-react";

// Business-facing dashboard: the landing page for a brand to start the pipeline
// and watch METRICS only. What and when to post lives in the separate employee
// console (/post-by-employees) — never here.
export default function Dashboard() {
  const products = useQuery(api.products.list);
  const [activeId, setActiveId] = useState<Id<"products"> | null>(null);

  useEffect(() => {
    if (!activeId && products && products.length > 0) setActiveId(products[0]._id);
  }, [products, activeId]);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto w-full max-w-[1400px] px-4 py-5">
        <div className="mb-5">
          <SubmitForm onCreated={setActiveId} />
        </div>

        <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="h-fit lg:sticky lg:top-20">
            <ProductRail activeId={activeId} onSelect={setActiveId} />
          </aside>

          <section className="min-w-0 space-y-4">
            {activeId ? (
              <>
                <ProductPanel productId={activeId} />
                <Metrics productId={activeId} />
              </>
            ) : (
              <Welcome />
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function Metrics({ productId }: { productId: Id<"products"> }) {
  const m = useQuery(api.products.metrics, { productId });
  if (!m) return <div className="text-sm text-muted-foreground">Loading metrics…</div>;

  const tiles: Array<{ label: string; value: number | string; icon: typeof Target }> = [
    { label: "Target subreddits", value: m.targets, icon: Target },
    { label: "Threads discovered", value: m.discovered, icon: Search },
    { label: "Worth engaging", value: m.engage, icon: ThumbsUp },
    { label: "Skipped (BS-gate)", value: m.skip, icon: ShieldX },
    { label: "Drafts ready", value: m.drafted, icon: PenLine },
    { label: "Posted", value: m.posted, icon: Send },
    { label: "Avg relevance", value: m.avgScore, icon: Target },
  ];

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="label-eyebrow">campaign metrics</span>
        <span className="font-mono text-[11px] text-muted-foreground">
          tiers — direct {m.byTier[0]} · competitor {m.byTier[1]} · indirect {m.byTier[2]} · far{" "}
          {m.byTier[3]}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-lg border border-border/60 bg-muted/20 p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <t.icon className="size-3.5" />
              <span className="text-[11px]">{t.label}</span>
            </div>
            <div className="mt-1 font-mono text-2xl font-semibold tabular-nums">{t.value}</div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        What and when to post is handled by the posting team in the employee console — this view is
        metrics only.
      </p>
    </Card>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="relative flex size-7 items-center justify-center rounded-md bg-primary/15 ring-1 ring-primary/30">
            <span className="size-2.5 rounded-full bg-primary" />
            <span className="absolute size-4 rounded-full ring-1 ring-primary/40" />
          </span>
          <div className="leading-tight">
            <div className="font-mono text-sm font-bold tracking-[0.16em]">SUBLIMINAL</div>
            <div className="hidden text-[10px] text-muted-foreground sm:block">
              subliminal reddit marketing intelligence
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/post-by-employees"
            className="hidden items-center gap-1.5 font-mono text-[11px] text-muted-foreground hover:text-foreground sm:flex"
          >
            <Users className="size-3.5" /> employee console
          </Link>
          <span className="hidden items-center gap-1.5 font-mono text-[11px] text-emerald-300 sm:flex">
            <Radio className="size-3.5 animate-pulse" /> live
          </span>
          <OperatorBar />
        </div>
      </div>
    </header>
  );
}

function Welcome() {
  return (
    <div className="rounded-xl border border-dashed border-border p-10 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">
        Find where your product genuinely belongs on Reddit.
      </h1>
      <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
        Submit a product URL. SUBLIMINAL profiles it, matches it against a catalog of subreddits with
        RAG, pulls what those communities are talking about, and surfaces the threads where a
        disclosed, value-first comment would actually be welcome — with the posting handled by your
        team in a separate console.
      </p>
    </div>
  );
}
