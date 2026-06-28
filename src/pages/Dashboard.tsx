import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { SubmitForm } from "@/components/SubmitForm";
import { ProductRail } from "@/components/ProductRail";
import { OperatorBar } from "@/components/OperatorBar";
import { useOperator } from "@/store/operator";
import { useClientProjects } from "@/store/clientProjects";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  CircleDashed,
  FolderKanban,
  Globe2,
  Loader2,
  Menu,
  PenLine,
  Search,
  Send,
  ShieldX,
  Target,
  ThumbsUp,
  Users,
  X,
} from "lucide-react";

const GUEST_PROFILE = "guest";

function profileKey(profileId: Id<"operators"> | null): string {
  return profileId ?? GUEST_PROFILE;
}

// Business-facing dashboard: the landing page for a brand to start the pipeline
// and watch METRICS only. What and when to post lives in the separate employee
// console (/post-by-employees) — never here.
export default function Dashboard() {
  const products = useQuery(api.products.list);
  const { operatorId, clear } = useOperator();
  const { assignProduct, productOwners, productsForProfile } = useClientProjects();
  const [activeId, setActiveId] = useState<Id<"products"> | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [createdThisSession, setCreatedThisSession] = useState<Record<string, Set<string>>>({});
  const visibleProducts = useMemo(() => {
    void productOwners;
    const ownedProductIds = productsForProfile(operatorId);
    const sessionIds = createdThisSession[profileKey(operatorId)] ?? new Set();
    return products?.filter((p) => ownedProductIds.has(p._id) || sessionIds.has(p._id)) ?? [];
  }, [createdThisSession, operatorId, productOwners, products, productsForProfile]);

  useEffect(() => {
    if (activeId && !visibleProducts.some((p) => p._id === activeId)) {
      if (operatorId && products?.some((product) => product._id === activeId)) return;
      setActiveId(null);
      return;
    }
    if (!activeId && visibleProducts.length > 0) setActiveId(visibleProducts[0]._id);
  }, [visibleProducts, activeId, operatorId, products]);

  useEffect(() => {
    if (!operatorId || !activeId || productOwners[activeId]) return;
    if (products?.some((product) => product._id === activeId)) {
      assignProduct(activeId, operatorId);
    }
  }, [activeId, assignProduct, operatorId, productOwners, products]);

  useEffect(() => {
    if (!operatorId || activeId || visibleProducts.length > 0 || !products?.length) return;
    const recentCutoff = Date.now() - 60_000;
    const newestUnlinked = products.find(
      (product) => !productOwners[product._id] && product.createdAt >= recentCutoff,
    );
    if (!newestUnlinked) return;
    assignProduct(newestUnlinked._id, operatorId);
    setActiveId(newestUnlinked._id);
  }, [activeId, assignProduct, operatorId, productOwners, products, visibleProducts.length]);

  return (
    <div className="min-h-screen">
      <Header
        hasProfile={Boolean(operatorId)}
        onOpenSidebar={() => setSidebarOpen(true)}
        onHome={() => {
          clear();
          setActiveId(null);
          setSidebarOpen(false);
        }}
      />
      {!operatorId && (
        <SidebarDrawer
          open={sidebarOpen}
          onOpenChange={setSidebarOpen}
          activeId={activeId}
          onSelect={(id) => {
            setActiveId(id);
            setSidebarOpen(false);
          }}
          products={visibleProducts}
          isLoading={products === undefined}
        />
      )}
      <main className="mx-auto w-full max-w-[1320px] px-4 py-6">
        <section className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Card className="p-5">
            <div className="mb-4 max-w-3xl">
              <div className="label-eyebrow mb-2">Client portal</div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Create a Reddit seeding brief from a company website.
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Add the product website. Subliminal profiles the company, finds relevant Reddit
                communities, and turns the result into progress and campaign metrics for review.
              </p>
            </div>
            <SubmitForm
              onCreated={(id) => {
                assignProduct(id, operatorId);
                setCreatedThisSession((byProfile) => {
                  const key = profileKey(operatorId);
                  const ids = new Set(byProfile[key] ?? []);
                  ids.add(id);
                  return { ...byProfile, [key]: ids };
                });
                setActiveId(id);
              }}
            />
          </Card>
          <Card className="p-5">
            <div className="flex h-full flex-col justify-between gap-5">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                  <FolderKanban className="size-5" />
                </span>
                <div>
                  <div className="font-medium">
                    {operatorId ? "Projects stay with this profile" : "Pick a profile to begin"}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {operatorId
                      ? "Your sidebar now keeps this profile's projects together."
                      : "Use the avatar button in the top-right to select or create a profile."}
                  </p>
                </div>
              </div>
              {!operatorId && (
                <Button
                  type="button"
                  variant="outline"
                  className="justify-start gap-2 bg-card"
                  onClick={() => setSidebarOpen(true)}
                >
                  <Menu className="size-4" />
                  Open workspace
                </Button>
              )}
            </div>
          </Card>
        </section>

        <div className={operatorId ? "grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]" : ""}>
          {operatorId && (
            <aside className="lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)]">
              <SidebarContent
                activeId={activeId}
                onSelect={setActiveId}
                products={visibleProducts}
                isLoading={products === undefined}
              />
            </aside>
          )}

          <section className="min-w-0 space-y-4">
            {activeId ? (
              <>
                <ClientProjectOverview productId={activeId} />
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

function SidebarDrawer({
  open,
  onOpenChange,
  activeId,
  onSelect,
  products,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeId: Id<"products"> | null;
  onSelect: (id: Id<"products">) => void;
  products: Parameters<typeof ProductRail>[0]["products"];
  isLoading: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="left-0 top-0 h-dvh max-w-[320px] translate-x-0 translate-y-0 rounded-none p-0 sm:max-w-[320px]"
      >
        <DialogTitle className="sr-only">Workspace navigation</DialogTitle>
        <DialogDescription className="sr-only">
          Open projects, switch profile, or go to the employee portal.
        </DialogDescription>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="absolute right-3 top-3 z-10"
          onClick={() => onOpenChange(false)}
        >
          <X className="size-4" />
          <span className="sr-only">Close navigation</span>
        </Button>
        <SidebarContent
          activeId={activeId}
          onSelect={onSelect}
          products={products}
          isLoading={isLoading}
          showEmployeePortal
          className="h-full rounded-none border-0 ring-0"
        />
      </DialogContent>
    </Dialog>
  );
}

function SidebarContent({
  activeId,
  onSelect,
  products,
  isLoading,
  showEmployeePortal = false,
  className,
}: {
  activeId: Id<"products"> | null;
  onSelect: (id: Id<"products">) => void;
  products: Parameters<typeof ProductRail>[0]["products"];
  isLoading: boolean;
  showEmployeePortal?: boolean;
  className?: string;
}) {
  return (
    <Card className={`flex h-full min-h-[420px] flex-col p-3 ${className ?? ""}`}>
      <div className="mb-3 flex items-center gap-2 px-1">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <FolderKanban className="size-4" />
        </span>
        <div className="min-w-0">
          <div className="text-sm font-semibold">Workspace</div>
          <div className="truncate text-xs text-muted-foreground">Projects for this profile</div>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <ProductRail
          activeId={activeId}
          onSelect={onSelect}
          products={products}
          isLoading={isLoading}
        />
      </div>
      {showEmployeePortal && (
        <Link
          to="/post-by-employees"
          className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-secondary/70 px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-foreground"
        >
          <Users className="size-4" />
          <span>Employee portal</span>
        </Link>
      )}
    </Card>
  );
}

function ClientProjectOverview({ productId }: { productId: Id<"products"> }) {
  const product = useQuery(api.products.get, { productId });
  if (!product) return null;

  const isDiscovering = product.status === "discovering";
  const progress = product.searchesTotal ? (product.searchesDone / product.searchesTotal) * 100 : 0;
  const steps = [
    {
      label: "Website analyzed",
      done: product.status !== "enriching" && product.status !== "error",
      active: product.status === "enriching",
    },
    {
      label: "Communities mapped",
      done: product.searchesTotal > 0 || product.status === "ready",
      active: isDiscovering && product.searchesTotal === 0,
    },
    {
      label: "Reddit feed generated",
      done: product.status === "ready",
      active: isDiscovering && product.searchesTotal > 0,
    },
  ];

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="label-eyebrow mb-2">Active project</div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-xl font-semibold tracking-tight">
              {product.name || product.domain}
            </h2>
            <StatusBadge status={product.status} />
          </div>
          {product.summary && (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              {product.summary}
            </p>
          )}
          <a
            href={product.url}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <Globe2 className="size-4" />
            {product.domain}
          </a>
        </div>
        {isDiscovering && product.searchesTotal > 0 && (
          <div className="w-full rounded-lg border border-border/70 bg-muted/20 p-3 sm:w-64">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-medium">Discovery progress</span>
              <span className="tabular text-muted-foreground">
                {product.searchesDone}/{product.searchesTotal}
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {steps.map((step) => (
          <div key={step.label} className="flex items-center gap-3 rounded-lg border border-border/70 p-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
              {step.done ? (
                <CheckCircle2 className="size-4 text-emerald-600" />
              ) : step.active ? (
                <Loader2 className="size-4 animate-spin text-primary" />
              ) : (
                <CircleDashed className="size-4 text-muted-foreground" />
              )}
            </span>
            <div className="min-w-0">
              <div className="text-sm font-medium">{step.label}</div>
              <div className="text-xs text-muted-foreground">
                {step.done ? "Complete" : step.active ? "In progress" : "Waiting"}
              </div>
            </div>
          </div>
        ))}
      </div>

      {product.discoveryError && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-100 px-3 py-2 text-xs text-amber-700">
          Some discovery sources returned errors. Metrics may continue to update as the remaining
          sources finish.
        </p>
      )}
    </Card>
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
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="label-eyebrow">Campaign metrics</span>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">Pipeline health</h2>
        </div>
        <span className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 font-mono text-[11px] text-muted-foreground">
          direct {m.byTier[0]} · competitor {m.byTier[1]} · indirect {m.byTier[2]} · far {m.byTier[3]}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-lg border border-border/70 bg-card p-4">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <t.icon className="size-4" />
              <span className="text-xs">{t.label}</span>
            </div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">{t.value}</div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        What and when to post is handled by the posting team in the employee portal — this view is
        metrics only.
      </p>
    </Card>
  );
}

function Header({
  hasProfile,
  onOpenSidebar,
  onHome,
}: {
  hasProfile: boolean;
  onOpenSidebar: () => void;
  onHome: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-2.5">
          {!hasProfile && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="relative size-10 rounded-full"
              onClick={onOpenSidebar}
            >
              <Menu className="size-5" />
              <span className="absolute right-2 top-2 size-2.5 rounded-full bg-primary" />
              <span className="sr-only">Open navigation</span>
            </Button>
          )}
          <button
            type="button"
            className="flex items-center gap-2.5 rounded-lg text-left transition-opacity hover:opacity-80"
            onClick={onHome}
            title="Go home"
          >
            <span className="relative flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <span className="size-3 rounded-full bg-primary-foreground" />
            </span>
            <div className="leading-tight">
              <div className="text-sm font-bold tracking-wide">Subliminal</div>
              <div className="hidden text-[10px] text-muted-foreground sm:block">
                client campaign portal
              </div>
            </div>
          </button>
        </div>
        <OperatorBar className="justify-end" />
      </div>
    </header>
  );
}

function Welcome() {
  return (
    <div className="rounded-xl border border-dashed border-border p-10 text-center">
      <h2 className="text-xl font-semibold tracking-tight">No project selected</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
        Submit a company website above to create a project for the active profile. This view will
        show progress and metrics only; generated Reddit copy stays in the employee portal.
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label =
    status === "enriching"
      ? "Analyzing"
      : status === "discovering"
        ? "Generating"
        : status === "error"
          ? "Needs attention"
          : "Ready";
  const classes =
    status === "enriching"
      ? "border-amber-200 bg-amber-100 text-amber-700"
      : status === "discovering"
        ? "border-cyan-200 bg-cyan-100 text-cyan-700"
        : status === "error"
          ? "border-rose-200 bg-rose-100 text-rose-700"
          : "border-emerald-200 bg-emerald-100 text-emerald-700";
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${classes}`}>{label}</span>;
}
