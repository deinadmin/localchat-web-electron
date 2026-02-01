"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ProviderType = "openrouter" | "anthropic" | "openai" | "perplexity";

export interface Model {
  id: string;
  name: string;
  contextLength?: number;
  pricing?: {
    prompt: number;
    completion: number;
  };
}

export interface Provider {
  id: string;
  type: ProviderType;
  name: string;
  verified: boolean;
  models?: Model[];
  modelsLastFetched?: number;
}

interface ProvidersState {
  providers: Provider[];
  selectedModel: { providerId: string; modelId: string } | null;
  
  // Actions
  addProvider: (provider: Provider) => void;
  removeProvider: (id: string) => void;
  updateProvider: (id: string, updates: Partial<Provider>) => void;
  setSelectedModel: (providerId: string, modelId: string) => void;
  getActiveProvider: () => Provider | undefined;
  getActiveModel: () => Model | undefined;
}

const MODELS_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export const useProvidersStore = create<ProvidersState>()(
  persist(
    (set, get) => ({
      providers: [],
      selectedModel: null,

      addProvider: (provider) => {
        set((state) => ({
          providers: [...state.providers, provider],
        }));

        // Auto-select default model if this is the first provider
        const state = get();
        if (!state.selectedModel && provider.type === "openrouter") {
          set({
            selectedModel: {
              providerId: provider.id,
              modelId: "google/gemini-3-flash-preview",
            },
          });
        }
      },

      removeProvider: (id) => {
        set((state) => ({
          providers: state.providers.filter((p) => p.id !== id),
          selectedModel:
            state.selectedModel?.providerId === id ? null : state.selectedModel,
        }));
      },

      updateProvider: (id, updates) => {
        set((state) => ({
          providers: state.providers.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        }));
      },

      setSelectedModel: (providerId, modelId) => {
        set({ selectedModel: { providerId, modelId } });
      },

      getActiveProvider: () => {
        const state = get();
        if (!state.selectedModel) return undefined;
        return state.providers.find(
          (p) => p.id === state.selectedModel?.providerId
        );
      },

      getActiveModel: () => {
        const state = get();
        const provider = state.getActiveProvider();
        if (!provider || !state.selectedModel) return undefined;
        return provider.models?.find(
          (m) => m.id === state.selectedModel?.modelId
        );
      },
    }),
    {
      name: "localchat-providers",
      partialize: (state) => ({
        providers: state.providers.map((p) => ({
          ...p,
          // Don't persist the full models list to localStorage, it can be large
          models: undefined,
        })),
        selectedModel: state.selectedModel,
      }),
    }
  )
);

export function shouldRefreshModels(provider: Provider): boolean {
  if (!provider.modelsLastFetched) return true;
  return Date.now() - provider.modelsLastFetched > MODELS_CACHE_DURATION;
}
