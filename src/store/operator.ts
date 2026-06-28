import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Id } from "../../convex/_generated/dataModel";

// Which operator "I" am — purely client-side identity for assignment + the
// action workflow. Persisted so a refresh keeps you signed in as the operator.
interface OperatorState {
  operatorId: Id<"operators"> | null;
  operatorName: string | null;
  setOperator: (id: Id<"operators">, name: string) => void;
  clear: () => void;
}

export const useOperator = create<OperatorState>()(
  persist(
    (set) => ({
      operatorId: null,
      operatorName: null,
      setOperator: (operatorId, operatorName) => set({ operatorId, operatorName }),
      clear: () => set({ operatorId: null, operatorName: null }),
    }),
    { name: "vibeseed-operator" },
  ),
);
