import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { SubmitForm } from "@/components/SubmitForm";
import { ProductRail } from "@/components/ProductRail";
import { ProductPanel } from "@/components/ProductPanel";
import { OpportunitiesTab } from "@/components/OpportunitiesTab";
import { PostCreatorTab } from "@/components/PostCreatorTab";
import { OperatorBar } from "@/components/OperatorBar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MessagesSquare, PenLine, Radio } from "lucide-react";

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
                <Tabs defaultValue="opps" className="w-full">
                  <TabsList>
                    <TabsTrigger value="opps" className="gap-1.5">
                      <MessagesSquare className="size-3.5" /> Opportunities
                    </TabsTrigger>
                    <TabsTrigger value="posts" className="gap-1.5">
                      <PenLine className="size-3.5" /> Post Creator
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="opps" className="mt-4">
                    <OpportunitiesTab productId={activeId} />
                  </TabsContent>
                  <TabsContent value="posts" className="mt-4">
                    <PostCreatorTab productId={activeId} />
                  </TabsContent>
                </Tabs>
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
            <div className="font-mono text-sm font-bold tracking-[0.16em]">VIBESEED</div>
            <div className="hidden text-[10px] text-muted-foreground sm:block">
              honest reddit recommendation intelligence
            </div>
          </div>
        </div>
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

function Welcome() {
  return (
    <div className="rounded-xl border border-dashed border-border p-10 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">
        Find where your product genuinely belongs on Reddit.
      </h1>
      <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
        Submit a product URL. OrangeSlice enriches it into keywords and competitors, authenticated
        Reddit search surfaces real threads, and the engagement algorithm scores each one — drafting
        a disclosed, value-first comment only where it would actually be welcome.
      </p>
    </div>
  );
}
