import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SubClientStore {
  // State - map of project ID to enabled state
  enabledMap: Record<string, boolean>;

  // Actions
  getEnabled: (projectId: string) => boolean;
  setEnabled: (projectId: string, enabled: boolean) => void;
}

export const useSubClientStore = create<SubClientStore>()(
  persist(
    (set, get) => ({
      // Initial state
      enabledMap: {},

      // Get enabled state for a specific project
      getEnabled: (projectId: string) => {
        const state = get();
        return state.enabledMap[projectId] ?? false;
      },

      // Set enabled state for a specific project
      setEnabled: (projectId: string, enabled: boolean) =>
        set((state) => ({
          enabledMap: {
            ...state.enabledMap,
            [projectId]: enabled,
          },
        })),
    }),
    {
      name: "sub-client-storage",
    }
  )
);
