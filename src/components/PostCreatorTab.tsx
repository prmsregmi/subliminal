import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { CopyButton } from "@/components/CopyButton";
import { StatusBadge } from "@/components/Badges";
import { cn } from "@/lib/utils";
import { criticTone, timeAgo } from "@/lib/format";
import { AlertTriangle, Link2, Loader2, PenLine } from "lucide-react";
import { toast } from "sonner";

export function PostCreatorTab({ productId }: { productId: Id<"products"> }) {
  const posts = useQuery(api.posts.listByProduct, { productId });
  const generate = useMutation(api.posts.generate);
  const [subreddit, setSubreddit] = useState("");
  const [angle, setAngle] = useState("");
  const [busy, setBusy] = useState(false);

  async function go() {
    const sub = subreddit.trim();
    if (!sub) {
      toast.error("Enter a target subreddit");
      return;
    }
    setBusy(true);
    try {
      await generate({ productId, subreddit: sub, angle: angle.trim() || undefined });
      setAngle("");
      toast.success("Generating an original post…");
    } catch {
      toast.error("Failed to generate post");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="gap-3 p-4">
        <div className="label-eyebrow">Generate an original post</div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative sm:w-56">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground">
              r/
            </span>
            <Input
              value={subreddit}
              onChange={(e) => setSubreddit(e.target.value)}
              placeholder="subreddit"
              className="pl-7 font-mono text-sm"
            />
          </div>
          <Input
            value={angle}
            onChange={(e) => setAngle(e.target.value)}
            placeholder="Optional angle, e.g. “ask about people's morning routines”"
            className="flex-1 text-sm"
          />
          <Button onClick={go} disabled={busy} className="gap-2">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <PenLine className="size-4" />}
            Generate
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Generates a genuine, disclosed post for an operator to publish under their own account —
          same link-out-and-confirm flow as comments.
        </p>
      </Card>

      {posts === undefined ? (
        <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
      ) : posts.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No generated posts yet.</p>
      ) : (
        posts.map((p) => <PostCard key={p._id} post={p} />)
      )}
    </div>
  );
}

function PostCard({ post }: { post: Doc<"campaignPosts"> }) {
  const actionUrl = `${window.location.origin}/action/${post.actionToken}`;
  const fullText = `${post.title}\n\n${post.body}\n\n${post.disclosureLine}`;

  return (
    <Card className="gap-0 p-0">
      <div className="flex items-center justify-between gap-2 px-4 pt-3.5">
        <span className="font-mono text-xs font-semibold">r/{post.subreddit}</span>
        <div className="flex items-center gap-2">
          {typeof post.criticScore === "number" && post.pipelineStage === "ready" && (
            <span className={cn("font-mono text-[11px]", criticTone(post.criticScore))}>
              salesiness {post.criticScore}/10
            </span>
          )}
          <StatusBadge value={post.status} />
        </div>
      </div>

      <div className="px-4 py-3">
        {post.pipelineStage === "generating" ? (
          <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> drafting an original post for r/{post.subreddit}…
          </p>
        ) : post.pipelineStage === "error" ? (
          <p className="flex items-center gap-2 py-4 text-sm text-rose-300">
            <AlertTriangle className="size-4" /> {post.errorMessage ?? "generation failed"}
          </p>
        ) : (
          <>
            <h3 className="text-[15px] font-semibold leading-snug">{post.title}</h3>
            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {post.body}
            </p>
            <p className="mt-2 text-xs italic text-muted-foreground">{post.disclosureLine}</p>
            {post.angle && (
              <p className="mt-2 font-mono text-[11px] text-muted-foreground">angle: {post.angle}</p>
            )}
          </>
        )}
      </div>

      {post.pipelineStage === "ready" && (
        <>
          <Separator />
          <div className="flex items-center justify-between gap-2 px-4 py-2.5">
            <span className="font-mono text-[11px] text-muted-foreground">
              {timeAgo(post.createdAt)}
            </span>
            <div className="flex items-center gap-1.5">
              <CopyButton text={fullText} label="Copy post" />
              <CopyButton text={actionUrl} label="Link" className="px-2" />
              <Button asChild size="sm" className="gap-1.5">
                <a href={`/action/${post.actionToken}`} target="_blank" rel="noreferrer">
                  <Link2 className="size-3.5" /> Open action
                </a>
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
