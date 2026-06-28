import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { scoreTone } from "@/lib/format";

export function ScoreMeter({ score, className }: { score: number; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Progress value={Math.max(0, Math.min(100, score))} className="h-1.5 w-16" />
      <span className={cn("tabular font-mono text-sm font-semibold", scoreTone(score))}>
        {score}
      </span>
    </div>
  );
}
