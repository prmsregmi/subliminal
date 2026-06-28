import { cn } from "@/lib/utils";
import {
  CLASSIFICATION_META,
  STATUS_META,
  type Classification,
  type WorkflowStatus,
} from "@/lib/format";
import { CircleSlash, Sparkles } from "lucide-react";

function Pill({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function ClassificationBadge({ value }: { value?: Classification | null }) {
  if (!value)
    return <Pill className="text-muted-foreground bg-muted/40 border-border">analyzing…</Pill>;
  const m = CLASSIFICATION_META[value];
  return <Pill className={m.classes}>{m.label}</Pill>;
}

export function StatusBadge({ value }: { value: WorkflowStatus }) {
  const m = STATUS_META[value];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        m.classes,
      )}
    >
      <span className={cn("size-1.5 rounded-full", m.dot)} />
      {m.label}
    </span>
  );
}

export function RecommendationBadge({ value }: { value?: "engage" | "skip" | null }) {
  if (value === "engage")
    return (
      <Pill className="text-emerald-700 bg-emerald-100 border-emerald-200">
        <Sparkles className="size-3" /> engage
      </Pill>
    );
  if (value === "skip")
    return (
      <Pill className="text-muted-foreground bg-muted/40 border-border">
        <CircleSlash className="size-3" /> skip
      </Pill>
    );
  return null;
}
