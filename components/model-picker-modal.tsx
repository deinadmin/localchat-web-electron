"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useProvidersStore, shouldRefreshModels } from "@/lib/providers-store";
import { useAuth } from "@/lib/auth-context";
import { fetchModels, POPULAR_MODELS } from "@/lib/openrouter";
import { getProviderApiKey } from "@/lib/firestore-providers";
import { getRecentModelIds } from "@/lib/firestore-chats";
import {
  parseModelName,
  ProviderIcon,
  ModelProvider,
} from "@/components/model-picker";
import { IconSearch, IconCheck, IconSparkles } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { Kbd } from "@/components/ui/kbd";
import { VisuallyHidden } from "radix-ui";
import { toast } from "sonner";

interface ModelPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Provider filter options
const PROVIDER_FILTERS: { id: ModelProvider; label: string }[] = [
  { id: "anthropic", label: "Anthropic" },
  { id: "openai", label: "OpenAI" },
  { id: "google", label: "Google" },
  { id: "meta", label: "Meta" },
  { id: "mistral", label: "Mistral" },
  { id: "deepseek", label: "DeepSeek" },
  { id: "xai", label: "xAI" },
  { id: "cohere", label: "Cohere" },
  { id: "perplexity", label: "Perplexity" },
  { id: "qwen", label: "Qwen" },
];

// Format price for display (price per 1M tokens)
function formatPrice(price: number): string {
  if (price === 0) return "Free";
  if (price < 0.01) return "<$0.01";
  if (price < 1) return `$${price.toFixed(2)}`;
  return `$${price.toFixed(2)}`;
}

export function ModelPickerModal({ open, onOpenChange }: ModelPickerModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedProviders, setSelectedProviders] = useState<Set<ModelProvider>>(new Set());
  const [recentModelIds, setRecentModelIds] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { user } = useAuth();
  const {
    providers,
    selectedModel,
    setSelectedModel,
    updateProvider,
  } = useProvidersStore();

  // Fetch recent models from Firestore
  useEffect(() => {
    async function fetchRecentModels() {
      if (!user) return;
      try {
        const recentIds = await getRecentModelIds(user.uid, 5);
        setRecentModelIds(recentIds);
      } catch (error) {
        console.error("Failed to fetch recent models:", error);
      }
    }
    fetchRecentModels();
  }, [user]);

  // Refresh models if cache is stale or models are missing
  useEffect(() => {
    async function refreshModels() {
      if (!user) return;

      for (const provider of providers) {
        const needsRefresh = !provider.models || provider.models.length === 0 || shouldRefreshModels(provider);
        
        if (provider.type === "openrouter" && needsRefresh) {
          try {
            setIsLoadingModels(true);
            const apiKey = await getProviderApiKey(user.uid, provider.id);
            if (apiKey) {
              const models = await fetchModels(apiKey);
              updateProvider(provider.id, {
                models,
                modelsLastFetched: Date.now(),
              });
            }
          } catch (error) {
            console.error("Failed to refresh models:", error);
            toast.error("Failed to load models");
          } finally {
            setIsLoadingModels(false);
          }
        }
      }
    }

    refreshModels();
  }, [user, providers.length, updateProvider]);

  // Get all available models from all providers
  const allModels = useMemo(() => {
    const models: Array<{
      providerId: string;
      providerName: string;
      modelId: string;
      modelName: string;
      cleanName: string;
      modelProvider: ModelProvider;
      isPopular: boolean;
      isRecent: boolean;
      pricing?: { prompt: number; completion: number };
    }> = [];

    for (const provider of providers) {
      if (provider.models) {
        for (const model of provider.models) {
          const { provider: modelProvider, cleanName } = parseModelName(model.id, model.name);
          models.push({
            providerId: provider.id,
            providerName: provider.name,
            modelId: model.id,
            modelName: model.name,
            cleanName,
            modelProvider,
            isPopular: POPULAR_MODELS.includes(model.id),
            isRecent: recentModelIds.includes(model.id),
            pricing: model.pricing,
          });
        }
      }
    }

    return models;
  }, [providers, recentModelIds]);

  // Filter models based on search and provider filters
  const filteredModels = useMemo(() => {
    let filtered = allModels;

    // Apply provider filter
    if (selectedProviders.size > 0) {
      filtered = filtered.filter((m) => selectedProviders.has(m.modelProvider));
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.modelId.toLowerCase().includes(query) ||
          m.modelName.toLowerCase().includes(query) ||
          m.cleanName.toLowerCase().includes(query)
      );
    }

    // Sort: recent first, then popular, then alphabetically
    return filtered.sort((a, b) => {
      if (a.isRecent && !b.isRecent) return -1;
      if (!a.isRecent && b.isRecent) return 1;
      if (a.isPopular && !b.isPopular) return -1;
      if (!a.isPopular && b.isPopular) return 1;
      return a.cleanName.localeCompare(b.cleanName);
    });
  }, [allModels, searchQuery, selectedProviders]);

  // Get available providers from models for filter chips
  const availableProviders = useMemo(() => {
    const providerSet = new Set<ModelProvider>();
    allModels.forEach((m) => {
      if (m.modelProvider !== "unknown") {
        providerSet.add(m.modelProvider);
      }
    });
    return PROVIDER_FILTERS.filter((p) => providerSet.has(p.id));
  }, [allModels]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredModels.length, searchQuery, selectedProviders]);

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      setSearchQuery("");
      setSelectedIndex(0);
      setSelectedProviders(new Set());
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  }, [open]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && filteredModels.length > 0) {
      const innerContainer = listRef.current.querySelector('div.py-2');
      const selectedElement = innerContainer?.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [selectedIndex, filteredModels.length]);

  const handleSelectModel = useCallback((providerId: string, modelId: string) => {
    setSelectedModel(providerId, modelId);
    onOpenChange(false);
  }, [setSelectedModel, onOpenChange]);

  const toggleProviderFilter = useCallback((provider: ModelProvider) => {
    setSelectedProviders((prev) => {
      const next = new Set(prev);
      if (next.has(provider)) {
        next.delete(provider);
      } else {
        next.add(provider);
      }
      return next;
    });
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredModels.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filteredModels[selectedIndex]) {
          handleSelectModel(
            filteredModels[selectedIndex].providerId,
            filteredModels[selectedIndex].modelId
          );
        }
        break;
      case "Escape":
        e.preventDefault();
        onOpenChange(false);
        break;
    }
  }, [filteredModels, selectedIndex, handleSelectModel, onOpenChange]);

  // No models available
  if (providers.length === 0 || allModels.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="p-0 gap-0 sm:max-w-2xl overflow-hidden top-[20%] translate-y-0"
        >
          <VisuallyHidden.Root>
            <DialogTitle>Select Model</DialogTitle>
          </VisuallyHidden.Root>
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <IconSparkles className="size-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground text-center">
              {isLoadingModels ? "Loading models..." : "No models available. Please configure a provider first."}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="p-0 gap-0 sm:max-w-2xl overflow-hidden top-[20%] translate-y-0"
        onKeyDown={handleKeyDown}
      >
        <VisuallyHidden.Root>
          <DialogTitle>Select Model</DialogTitle>
        </VisuallyHidden.Root>

        {/* Search Input */}
        <div className="flex items-center border-b px-4 py-3">
          <IconSearch className="size-5 text-muted-foreground shrink-0 mr-3" />
          <input
            ref={inputRef}
            placeholder="Search models..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 text-lg bg-transparent border-0 outline-none placeholder:text-muted-foreground/50"
          />
        </div>

        {/* Provider Filter Chips */}
        {availableProviders.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 border-b overflow-x-auto scrollbar-hide">
            {availableProviders.map((provider) => {
              const isSelected = selectedProviders.has(provider.id);
              return (
                <button
                  key={provider.id}
                  onClick={() => toggleProviderFilter(provider.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors shrink-0",
                    isSelected
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  <ProviderIcon provider={provider.id} className="size-3.5" inverted={isSelected} />
                  {provider.label}
                </button>
              );
            })}
            {selectedProviders.size > 0 && (
              <button
                onClick={() => setSelectedProviders(new Set())}
                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                Clear
              </button>
            )}
          </div>
        )}

        {/* Results List */}
        <div
          ref={listRef}
          className="max-h-[400px] overflow-y-auto overscroll-contain"
        >
          {filteredModels.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No models found
            </div>
          ) : (
            <div className="py-2">
              {filteredModels.map((model, index) => {
                const isSelected =
                  selectedModel?.modelId === model.modelId &&
                  selectedModel?.providerId === model.providerId;

                return (
                  <button
                    key={`${model.providerId}-${model.modelId}`}
                    onClick={() => handleSelectModel(model.providerId, model.modelId)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={cn(
                      "w-full px-4 py-3 flex items-center gap-3 text-left transition-colors",
                      index === selectedIndex
                        ? "bg-muted"
                        : "hover:bg-muted/50"
                    )}
                  >
                    {/* Provider Icon */}
                    <ProviderIcon provider={model.modelProvider} className="size-8 shrink-0" />

                    {/* Model Info */}
                    <div className="flex-1 min-w-0">
                      {/* Model Name */}
                      <div className="font-medium text-sm truncate">
                        {model.cleanName}
                      </div>

                      {/* Model ID */}
                      <div className="text-xs text-muted-foreground truncate">
                        {model.modelId}
                      </div>
                    </div>

                    {/* Pricing */}
                    {model.modelId === "openrouter/auto" ? (
                      <div className="text-right shrink-0">
                        <div className="text-xs text-foreground/70">
                          Router
                        </div>
                        <div className="text-[10px] text-muted-foreground/50">
                          price varies by model
                        </div>
                      </div>
                    ) : model.pricing && (
                      <div className="text-right shrink-0">
                        <div className="text-xs text-muted-foreground">
                          <span className="text-foreground/70">{formatPrice(model.pricing.prompt * 1000000)}</span>
                          <span className="text-muted-foreground/50"> / </span>
                          <span className="text-foreground/70">{formatPrice(model.pricing.completion * 1000000)}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground/50">
                          prompt / completion
                        </div>
                      </div>
                    )}

                    {/* Selected Check */}
                    {isSelected && (
                      <IconCheck className="size-4 shrink-0 text-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer hint */}
        {filteredModels.length > 0 && (
          <div className="border-t px-4 py-2 text-xs text-muted-foreground flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Kbd>↑↓</Kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <Kbd>↵</Kbd>
              select
            </span>
            <span className="flex items-center gap-1">
              <Kbd>esc</Kbd>
              close
            </span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
