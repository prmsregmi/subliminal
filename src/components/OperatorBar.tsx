import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useOperator } from "@/store/operator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import type { Id } from "../../convex/_generated/dataModel";

export function OperatorBar() {
  const operators = useQuery(api.operators.list) ?? [];
  const createOperator = useMutation(api.operators.create);
  const { operatorId, setOperator } = useOperator();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  async function add() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = await createOperator({ name: trimmed });
    setOperator(id, trimmed);
    setName("");
    setAdding(false);
  }

  return (
    <div className="flex items-center gap-2">
      <span className="label-eyebrow hidden sm:inline">Operator</span>
      <Select
        value={operatorId ?? ""}
        onValueChange={(v) => {
          const op = operators.find((o) => o._id === (v as Id<"operators">));
          if (op) setOperator(op._id, op.name);
        }}
      >
        <SelectTrigger className="h-8 w-[150px] text-xs">
          <SelectValue placeholder="Sign in as…" />
        </SelectTrigger>
        <SelectContent>
          {operators.map((o) => (
            <SelectItem key={o._id} value={o._id}>
              {o.name}
            </SelectItem>
          ))}
          {operators.length === 0 && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">No operators yet</div>
          )}
        </SelectContent>
      </Select>

      {adding ? (
        <div className="flex items-center gap-1">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Name"
            className="h-8 w-28 text-xs"
          />
          <Button size="sm" className="h-8" onClick={add}>
            Add
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5"
          onClick={() => setAdding(true)}
        >
          <UserPlus className="size-3.5" />
          New
        </Button>
      )}
    </div>
  );
}
