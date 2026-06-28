import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useOperator } from "@/store/operator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, ChevronDown, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

export function OperatorBar({ className }: { className?: string }) {
  const operatorsQuery = useQuery(api.operators.list);
  const operators = operatorsQuery ?? [];
  const createOperator = useMutation(api.operators.create);
  const { operatorId, operatorName, setOperator, clear } = useOperator();
  const [adding, setAdding] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [name, setName] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!adding && !menuOpen) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setAdding(false);
        setMenuOpen(false);
        setName("");
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAdding(false);
        setMenuOpen(false);
        setName("");
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [adding, menuOpen]);

  useEffect(() => {
    if (!operatorsQuery || !operatorId) return;
    if (!operatorsQuery.some((operator) => operator._id === operatorId)) {
      clear();
    }
  }, [operatorsQuery, operatorId, clear]);

  async function add() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = await createOperator({ name: trimmed });
    setOperator(id, trimmed);
    setName("");
    setAdding(false);
    setMenuOpen(false);
  }

  return (
    <div
      ref={rootRef}
      className={cn("relative flex flex-wrap items-center justify-end gap-2", className)}
    >
      <span className="label-eyebrow hidden">Profile</span>
      <button
        type="button"
        aria-label="Select profile"
        aria-expanded={menuOpen}
        className="flex h-11 w-[156px] items-center justify-start gap-2 rounded-full border border-primary/20 bg-card p-1 pr-3 text-left shadow-sm transition-all hover:border-primary/40 hover:shadow-md sm:w-[188px]"
        title={operatorName ? `Profile: ${operatorName}` : "Select profile"}
        onClick={() => {
          setMenuOpen((open) => !open);
          setAdding(false);
          setName("");
        }}
      >
        <Avatar name={operatorName} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {operatorName ?? "Profile"}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute right-12 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-xl"
        >
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Switch profile</div>
          <div className="max-h-64 overflow-y-auto">
            {operators.map((operator) => (
              <button
                key={operator._id}
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                onClick={() => {
                  setOperator(operator._id, operator.name);
                  setMenuOpen(false);
                  setAdding(false);
                  setName("");
                }}
              >
                <Avatar name={operator.name} compact />
                <span className="min-w-0 flex-1 truncate">{operator.name}</span>
                {operator._id === operatorId && <Check className="size-4 text-primary" />}
              </button>
            ))}
            {operators.length === 0 && (
              <div className="px-2 py-3 text-sm text-muted-foreground">No profiles yet</div>
            )}
          </div>
          <button
            type="button"
            className="mt-1 flex w-full items-center gap-2 rounded-lg border border-border bg-card px-2 py-2 text-left text-sm font-medium transition-colors hover:border-primary/30 hover:bg-primary/10"
            onClick={() => {
              setMenuOpen(false);
              setAdding(true);
            }}
          >
            <UserPlus className="size-4" />
            New profile
          </button>
        </div>
      )}

      {adding ? (
        <div className="flex min-w-[260px] items-center gap-2 rounded-full border border-border bg-card p-1 shadow-sm">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void add();
              if (e.key === "Escape") {
                setAdding(false);
                setMenuOpen(false);
                setName("");
              }
            }}
            placeholder="Profile"
            className="h-9 min-w-0 flex-1 border-0 bg-transparent px-3 text-sm shadow-none focus-visible:ring-0"
          />
          <Button size="sm" className="h-9 rounded-full px-4" onClick={add}>
            Add
          </Button>
        </div>
      ) : (
        <Button
          size="icon"
          variant="outline"
          className="size-10 rounded-full bg-card shadow-sm"
          onClick={() => {
            setAdding(true);
            setMenuOpen(false);
          }}
          title="Create profile"
        >
          <UserPlus className="size-4" />
          <span className="sr-only">Create profile</span>
        </Button>
      )}
    </div>
  );
}

function Avatar({ name, compact = false }: { name?: string | null; compact?: boolean }) {
  const initial = name?.trim()[0]?.toUpperCase();
  return (
    <span
      className={cn(
        "relative flex items-center justify-center overflow-hidden rounded-full bg-[#d7e6ff] text-primary ring-2 ring-white",
        compact ? "size-7" : "size-9",
      )}
    >
      {initial ? (
        <span className={cn("font-bold", compact ? "text-xs" : "text-sm")}>{initial}</span>
      ) : (
        <>
          <span className="absolute bottom-1.5 left-1/2 size-4 -translate-x-1/2 rounded-full bg-[#7f91c7]" />
          <span className="absolute top-1.5 left-1/2 size-3 -translate-x-1/2 rounded-full bg-[#7f91c7]" />
          <span className="absolute -right-1 top-1 size-4 rounded-full border-2 border-[#d7e6ff] bg-[#9fb4ef]" />
        </>
      )}
      <span className="absolute bottom-0.5 left-0.5 size-2.5 rounded-full border-2 border-white bg-emerald-500" />
    </span>
  );
}
