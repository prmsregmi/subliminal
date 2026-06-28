import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/format";
import { Loader2 } from "lucide-react";
import type { Id } from "../../convex/_generated/dataModel";

const STATUS_DOT: Record<string, string> = {
  enriching: "bg-amber-400 animate-pulse",
  discovering: "bg-cyan-400 animate-pulse",
  ready: "bg-emerald-400",
  error: "bg-rose-400",
};

export function ProductRail({
  activeId,
  onSelect,
}: {
  activeId: Id<"products"> | null;
  onSelect: (id: Id<"products">) => void;
}) {
  const products = useQuery(api.products.list);

  return (
    <div className="flex flex-col gap-1">
      <div className="label-eyebrow px-2 pb-1">Products</div>
      {products === undefined && (
        <div className="flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> loading…
        </div>
      )}
      {products?.length === 0 && (
        <div className="px-2 py-3 text-xs text-muted-foreground">
          Submit a product URL above to begin.
        </div>
      )}
      {products?.map((p) => (
        <button
          key={p._id}
          onClick={() => onSelect(p._id)}
          className={cn(
            "group flex flex-col gap-0.5 rounded-md border px-2.5 py-2 text-left transition-colors",
            activeId === p._id
              ? "border-primary/40 bg-primary/10"
              : "border-transparent hover:border-border hover:bg-card",
          )}
        >
          <div className="flex items-center gap-2">
            <span className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[p.status] ?? "bg-muted-foreground")} />
            <span className="truncate font-mono text-xs font-medium">
              {p.name || p.domain}
            </span>
          </div>
          <span className="truncate pl-3.5 text-[11px] text-muted-foreground">
            {p.status === "discovering"
              ? `scanning ${p.searchesDone}/${p.searchesTotal}`
              : p.status}{" "}
            · {timeAgo(p.createdAt)}
          </span>
        </button>
      ))}
    </div>
  );
}
