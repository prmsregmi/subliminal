import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CopyButton } from "@/components/CopyButton";
import { StatusBadge } from "@/components/Badges";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

function isRedditThreadUrl(url: string): boolean {
  return /reddit\.com\/r\/[^/]+\/comments\/[^/?#]+/i.test(url);
}

function redditSubmitUrl(subreddit: string): string {
  return `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/submit?type=TEXT`;
}

export default function ActionPage() {
  const { token = "" } = useParams();
  const data = useQuery(api.actionLink.getByToken, { token });
  const markOpened = useMutation(api.actionLink.markOpened);
  const markCompleted = useMutation(api.actionLink.markCompleted);

  if (data === undefined) {
    return (
      <Centered>
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </Centered>
    );
  }
  if (data === null) {
    return (
      <Centered>
        <p className="text-sm text-muted-foreground">This action link is invalid or expired.</p>
        <BackLink />
      </Centered>
    );
  }

  const isPost = data.type === "post";
  const status = isPost ? data.post.status : data.opportunity.status;
  const productName =
    data.product?.name || data.product?.domain || "your product";

  const targetUrl = isPost
    ? redditSubmitUrl(data.post.subreddit)
    : isRedditThreadUrl(data.opportunity.url)
      ? data.opportunity.url
      : null;
  const targetLabel = isPost
    ? `r/${data.post.subreddit} · new post`
    : `r/${data.opportunity.subreddit} · reply`;

  const copyText = isPost
    ? `${data.post.title}\n\n${data.post.body}\n\n${data.post.disclosureLine}`
    : `${data.draft?.body ?? ""}\n\n${data.draft?.disclosureLine ?? ""}`;
  const disclosureLine = isPost ? data.post.disclosureLine : data.draft?.disclosureLine;
  const hasContent = isPost ? true : !!data.draft;

  function openTarget() {
    if (!targetUrl) {
      toast.error("This item does not have an exact Reddit thread link.");
      return;
    }
    // Open synchronously within the click gesture so popup blockers don't fire,
    // then record the status best-effort.
    window.open(targetUrl, "_blank", "noopener,noreferrer");
    void markOpened({ token }).catch(() => {});
  }

  async function complete() {
    await markCompleted({ token });
    toast.success("Marked completed");
  }

  if (isPost && data.post.pipelineStage !== "ready") {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <div className="mb-4 flex items-center justify-between">
          <BackLink />
          <StatusBadge value={status} />
        </div>
        <Card className="p-6 text-center">
          {data.post.pipelineStage === "error" ? (
            <p className="text-sm text-rose-300">
              Post generation failed: {data.post.errorMessage ?? "unknown error"}
            </p>
          ) : (
            <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Still generating this post — refresh in a
              moment.
            </p>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between">
        <BackLink />
        <StatusBadge value={status} />
      </div>

      <Card className="gap-0 overflow-hidden p-0">
        <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-primary/[0.05] px-5 py-3">
          <div>
            <div className="label-eyebrow">Action for {productName}</div>
            <div className="font-mono text-sm font-semibold">{targetLabel}</div>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            {isPost ? "original post" : "comment"}
          </span>
        </div>

        {/* Step 1 — open */}
        <Step n={1} title="Open the Reddit target in a new tab">
          <Button onClick={openTarget} className="gap-2">
            <ExternalLink className="size-4" />
            {isPost ? `Open r/${data.post.subreddit} submit` : "Open Reddit post"}
          </Button>
          {!isPost && !targetUrl && (
            <p className="mt-2 text-xs text-amber-700">
              Exact Reddit thread link is unavailable for this generated item.
            </p>
          )}
        </Step>

        <Separator />

        {/* Step 2 — copy */}
        <Step
          n={2}
          title={isPost ? "Copy the post title + body" : "Copy your reply"}
        >
          {isPost ? (
            <div className="space-y-2">
              <div>
                <div className="label-eyebrow mb-1">Title</div>
                <div className="rounded-md border bg-muted/30 p-2.5 text-sm font-medium">
                  {data.post.title}
                </div>
              </div>
              <div>
                <div className="label-eyebrow mb-1">Body</div>
                <div className="whitespace-pre-wrap rounded-md border bg-muted/30 p-2.5 text-sm leading-relaxed">
                  {data.post.body}
                </div>
              </div>
            </div>
          ) : data.draft ? (
            <div className="whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-sm leading-relaxed">
              {data.draft.body}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Draft not ready yet.</p>
          )}

          {disclosureLine && (
            <div className="mt-2 flex items-start gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/[0.06] p-2.5">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-400" />
              <div className="text-xs">
                <div className="label-eyebrow text-emerald-300/80">disclosure (keep this)</div>
                <p className="mt-0.5 italic text-foreground/90">{disclosureLine}</p>
              </div>
            </div>
          )}

          {hasContent && (
            <div className="mt-2">
              <CopyButton text={copyText} label={isPost ? "Copy full post" : "Copy reply"} />
            </div>
          )}
        </Step>

        <Separator />

        {/* Step 3 — instructions */}
        <Step n={3} title="Post it under your own account">
          <ol className="space-y-1.5 text-sm text-muted-foreground">
            {isPost ? (
              <>
                <li>Paste the title into the post title field.</li>
                <li>Paste the body (including the disclosure line) into the text box.</li>
                <li>Review it reads naturally for r/{data.post.subreddit}, then submit.</li>
              </>
            ) : (
              <>
                <li>Scroll to the comment box at the bottom of the thread.</li>
                <li>Paste your reply (the disclosure line is included).</li>
                <li>Read it once more in context, then post.</li>
              </>
            )}
          </ol>
        </Step>

        <Separator />

        {/* Step 4 — confirm */}
        <div className="flex items-center justify-between gap-2 px-5 py-4">
          <span className="text-xs text-muted-foreground">
            {status === "completed"
              ? "Completed — thanks!"
              : "Once it's live, mark it complete."}
          </span>
          <Button
            onClick={complete}
            disabled={status === "completed"}
            className={cn("gap-2", status === "completed" && "opacity-60")}
            variant={status === "completed" ? "secondary" : "default"}
          >
            <CheckCircle2 className="size-4" />
            {status === "completed" ? "Completed" : "Mark completed"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-5 py-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex size-5 items-center justify-center rounded-full bg-primary/15 font-mono text-[11px] font-bold text-primary ring-1 ring-primary/30">
          {n}
        </span>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="pl-7">{children}</div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4">
      {children}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/"
      className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-3.5" /> dashboard
    </Link>
  );
}
