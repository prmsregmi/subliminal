import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { AlertTriangle, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import type { Id } from "../../convex/_generated/dataModel";

function Chips({ items, tone }: { items: string[]; tone: string }) {
  if (!items.length) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t) => (
        <span
          key={t}
          className={cn(
            "rounded-full border px-2 py-0.5 font-mono text-[11px] lowercase",
            tone,
          )}
        >
          {t}
        </span>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="label-eyebrow">{label}</div>
      {children}
    </div>
  );
}

export function ProductPanel({ productId }: { productId: Id<"products"> }) {
  const product = useQuery(api.products.get, { productId });
  const updateDisclosure = useMutation(api.products.updateDisclosure);
  const [disclosure, setDisclosure] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (product && !dirty) setDisclosure(product.disclosureTemplate);
  }, [product, dirty]);

  if (!product) return null;

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-lg font-semibold tracking-tight">
              {product.name || product.domain}
            </h2>
            {product.category && (
              <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-primary">
                {product.category}
              </span>
            )}
          </div>
          {product.summary && (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{product.summary}</p>
          )}
          <a
            href={product.url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block font-mono text-xs text-muted-foreground hover:text-primary"
          >
            {product.domain} ↗
          </a>
        </div>
        <StatusIndicator
          status={product.status}
          done={product.searchesDone}
          total={product.searchesTotal}
          error={product.errorMessage}
        />
      </div>

      {product.discoveryError && (
        <div className="flex items-start gap-2 border-b border-amber-500/20 bg-amber-500/[0.06] px-4 py-2 text-xs text-amber-300">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Reddit discovery hit errors ({product.discoveryError}). Check REDDIT_CLIENT_ID /
            REDDIT_CLIENT_SECRET, then re-run <code className="font-mono">pnpm run secrets</code>.
          </span>
        </div>
      )}

      <div className="grid gap-4 p-4 md:grid-cols-3">
        <Field label="Our keywords">
          <Chips items={product.ownKeywords} tone="border-primary/30 bg-primary/10 text-primary" />
        </Field>
        <Field label="Competitor domains">
          <Chips items={product.competitorDomains} tone="border-amber-500/30 bg-amber-500/10 text-amber-300" />
        </Field>
        <Field label="Topic terms (reddit)">
          <Chips items={product.topicTerms} tone="border-cyan-500/30 bg-cyan-500/10 text-cyan-300" />
        </Field>
      </div>

      <div className="border-t border-border/60 p-4">
        <Field label="Disclosure template (kept on every draft)">
          <Textarea
            value={disclosure}
            onChange={(e) => {
              setDisclosure(e.target.value);
              setDirty(true);
            }}
            rows={2}
            className="font-mono text-xs"
          />
          <div className="flex items-center justify-between pt-1">
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <ShieldCheck className="size-3.5 text-emerald-400" />
              <code className="text-muted-foreground">{"{{product}}"}</code> is replaced with the
              product name.
            </span>
            {dirty && (
              <Button
                size="sm"
                className="h-7"
                disabled={!disclosure.trim()}
                onClick={async () => {
                  try {
                    await updateDisclosure({ productId, disclosureTemplate: disclosure });
                    setDirty(false);
                  } catch {
                    toast.error("Disclosure template can't be empty");
                  }
                }}
              >
                Save
              </Button>
            )}
          </div>
        </Field>
      </div>
    </Card>
  );
}

function StatusIndicator({
  status,
  done,
  total,
  error,
}: {
  status: string;
  done: number;
  total: number;
  error?: string;
}) {
  if (status === "enriching")
    return (
      <Badge className="text-amber-300 border-amber-500/30 bg-amber-500/10">
        <Loader2 className="size-3.5 animate-spin" /> enriching via OrangeSlice
      </Badge>
    );
  if (status === "discovering")
    return (
      <div className="flex flex-col items-end gap-1">
        <Badge className="text-cyan-300 border-cyan-500/30 bg-cyan-500/10">
          <Loader2 className="size-3.5 animate-spin" /> scanning reddit {done}/{total}
        </Badge>
        <Progress value={total ? (done / total) * 100 : 0} className="h-1 w-40" />
      </div>
    );
  if (status === "error")
    return (
      <Badge className="text-rose-300 border-rose-500/30 bg-rose-500/10">
        <AlertTriangle className="size-3.5" /> {error ? error.slice(0, 60) : "error"}
      </Badge>
    );
  return (
    <Badge className="text-emerald-300 border-emerald-500/30 bg-emerald-500/10">
      <span className="size-1.5 rounded-full bg-emerald-400" /> ready
    </Badge>
  );
}

function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        className,
      )}
    >
      {children}
    </span>
  );
}
