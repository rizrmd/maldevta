import { create } from "zustand";

interface SubClientStore {
  // State
  enabled: boolean;

  // Actions
  setEnabled: (enabled: boolean) => void;
}

export const useSubClientStore = create<SubClientStore>((set) => ({
  // Initial state
  enabled: false,

  // Actions
  setEnabled: (enabled: boolean) => set({ enabled }),
}));
