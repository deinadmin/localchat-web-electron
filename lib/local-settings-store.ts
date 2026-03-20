"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface LocalSettings {
  fullWidthChat: boolean;
  showEstimatedCost: boolean;
  webSearchEnabled: boolean;
}

interface LocalSettingsStore extends LocalSettings {
  setFullWidthChat: (value: boolean) => void;
  setShowEstimatedCost: (value: boolean) => void;
  setWebSearchEnabled: (value: boolean) => void;
}

export const useLocalSettingsStore = create<LocalSettingsStore>()(
  persist(
    (set) => ({
      fullWidthChat: false,
      showEstimatedCost: true,
      webSearchEnabled: false,
      setFullWidthChat: (value) => set({ fullWidthChat: value }),
      setShowEstimatedCost: (value) => set({ showEstimatedCost: value }),
      setWebSearchEnabled: (value) => set({ webSearchEnabled: value }),
    }),
    {
      name: "local-settings",
    }
  )
);
