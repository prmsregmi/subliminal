import { ConvexReactClient } from "convex/react";

const url = import.meta.env.VITE_CONVEX_URL as string | undefined;
if (!url) {
  // Surfaces clearly during dev if `convex dev` hasn't written .env.local yet.
  console.error("VITE_CONVEX_URL is not set. Run `pnpm dev` (Convex writes it to .env.local).");
}

export const convex = new ConvexReactClient(url ?? "");
