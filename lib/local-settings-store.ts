"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface LocalSettings {
  fullWidthChat: boolean;
}

interface LocalSettingsStore extends LocalSettings {
  setFullWidthChat: (value: boolean) => void;
}

export const useLocalSettingsStore = create<LocalSettingsStore>()(
  persist(
    (set) => ({
      fullWidthChat: false,
      setFullWidthChat: (value) => set({ fullWidthChat: value }),
    }),
    {
      name: "local-settings",
    }
  )
);
