import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Id } from "../../convex/_generated/dataModel";

const GUEST_PROFILE = "guest";

type ProductId = Id<"products">;
type ProfileId = Id<"operators"> | typeof GUEST_PROFILE;

interface ClientProjectsState {
  productOwners: Record<string, ProfileId>;
  assignProduct: (productId: ProductId, profileId: Id<"operators"> | null) => void;
  productsForProfile: (profileId: Id<"operators"> | null) => Set<string>;
}

function profileKey(profileId: Id<"operators"> | null): ProfileId {
  return profileId ?? GUEST_PROFILE;
}

export const useClientProjects = create<ClientProjectsState>()(
  persist(
    (set, get) => ({
      productOwners: {},
      assignProduct: (productId, profileId) =>
        set((state) => ({
          productOwners: {
            ...state.productOwners,
            [productId]: profileKey(profileId),
          },
        })),
      productsForProfile: (profileId) => {
        const key = profileKey(profileId);
        return new Set(
          Object.entries(get().productOwners)
            .filter(([, owner]) => owner === key)
            .map(([productId]) => productId),
        );
      },
    }),
    { name: "subliminal-client-projects" },
  ),
);
