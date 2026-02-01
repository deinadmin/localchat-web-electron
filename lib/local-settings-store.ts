"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface LocalSettings {
  fullWidthChat: boolean;
  showEstimatedCost: boolean;
}

interface LocalSettingsStore extends LocalSettings {
  setFullWidthChat: (value: boolean) => void;
  setShowEstimatedCost: (value: boolean) => void;
}

export const useLocalSettingsStore = create<LocalSettingsStore>()(
  persist(
    (set) => ({
      fullWidthChat: false,
      showEstimatedCost: true,
      setFullWidthChat: (value) => set({ fullWidthChat: value }),
      setShowEstimatedCost: (value) => set({ showEstimatedCost: value }),
    }),
    {
      name: "local-settings",
    }
  )
);
