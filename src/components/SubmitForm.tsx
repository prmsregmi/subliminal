import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Globe2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Id } from "../../convex/_generated/dataModel";

export function SubmitForm({ onCreated }: { onCreated: (id: Id<"products">) => void }) {
  const submit = useMutation(api.products.submitProduct);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  async function go() {
    const v = url.trim();
    if (!v) return;
    setBusy(true);
    try {
      const id = await submit({ url: v });
      setUrl("");
      onCreated(id);
      toast.success("Project created. Analysis started.");
    } catch {
      toast.error("Failed to submit URL");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void go();
      }}
      className="grid w-full gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"
    >
      <div className="relative flex-1">
        <Globe2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="company.com or https://company.com/product"
          className="h-11 pl-9 text-sm"
        />
      </div>
      <Button type="submit" size="lg" disabled={busy} className="h-11 gap-2">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Globe2 className="size-4" />}
        Start analysis
      </Button>
    </form>
  );
}
