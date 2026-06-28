// Display helpers + the visual vocabulary for classifications, statuses, etc.

export function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 0) return "just now";
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

export type Classification =
  | "competitor-mention"
  | "frustrated-user"
  | "similar-interest"
  | "general";

export const CLASSIFICATION_META: Record<
  Classification,
  { label: string; classes: string }
> = {
  "competitor-mention": {
    label: "competitor",
    classes: "text-amber-300 bg-amber-500/10 border-amber-500/30",
  },
  "frustrated-user": {
    label: "frustrated user",
    classes: "text-rose-300 bg-rose-500/10 border-rose-500/30",
  },
  "similar-interest": {
    label: "similar interest",
    classes: "text-cyan-300 bg-cyan-500/10 border-cyan-500/30",
  },
  general: {
    label: "general",
    classes: "text-slate-300 bg-slate-500/10 border-slate-500/30",
  },
};

export type WorkflowStatus =
  | "queued"
  | "assigned"
  | "opened"
  | "completed"
  | "dismissed";

export const STATUS_META: Record<
  WorkflowStatus,
  { label: string; classes: string; dot: string }
> = {
  queued: { label: "Queued", classes: "text-slate-300 bg-slate-500/10 border-slate-500/30", dot: "bg-slate-400" },
  assigned: { label: "Assigned", classes: "text-indigo-300 bg-indigo-500/10 border-indigo-500/30", dot: "bg-indigo-400" },
  opened: { label: "Opened", classes: "text-amber-300 bg-amber-500/10 border-amber-500/30", dot: "bg-amber-400" },
  completed: { label: "Completed", classes: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30", dot: "bg-emerald-400" },
  dismissed: { label: "Dismissed", classes: "text-muted-foreground bg-muted/40 border-border", dot: "bg-muted-foreground" },
};

export const RESPONSE_TYPE_LABEL: Record<string, string> = {
  "answer-question": "Answer a question",
  "share-experience": "Share experience",
  "add-data-point": "Add a data point",
  "mention-if-relevant": "Mention if relevant",
  skip: "Skip",
};

// Ember-toned score color: hotter = more relevant.
export function scoreTone(score: number): string {
  if (score >= 70) return "text-primary";
  if (score >= 45) return "text-amber-300";
  return "text-muted-foreground";
}

export function criticTone(salesiness: number): string {
  if (salesiness <= 3) return "text-emerald-300";
  if (salesiness <= 5) return "text-amber-300";
  return "text-rose-300";
}
