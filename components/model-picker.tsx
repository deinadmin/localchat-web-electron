"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useProvidersStore, shouldRefreshModels } from "@/lib/providers-store";
import { useAuth } from "@/lib/auth-context";
import { fetchModels, POPULAR_MODELS } from "@/lib/openrouter";
import { getProviderApiKey } from "@/lib/firestore-providers";
import { getRecentModelIds } from "@/lib/firestore-chats";
import {
  IconChevronDown,
  IconSparkles,
  IconSearch,
  IconCpu,
  IconList,
  IconCheck,
} from "@tabler/icons-react";
import { toast } from "sonner";

// Provider icon mapping based on model ID prefix or name
export type ModelProvider = "google" | "openai" | "anthropic" | "perplexity" | "xai" | "meta" | "mistral" | "microsoft" | "deepseek" | "qwen" | "moonshotai" | "zai" | "cohere" | "nvidia" | "minimax" | "tencent" | "nousresearch" | "morph" | "bytedance" | "baidu" | "openrouter" | "arcee" | "unknown";

// Non-color icons that need dark mode inversion
const NON_COLOR_ICONS = ["openrouter", "openai", "xai", "moonshotai", "zai", "nousresearch"] as const;

const PROVIDER_ICONS: Record<ModelProvider, { src: string; alt: string }> = {
  google: { src: "/gemini-color.png", alt: "Google" },
  openai: { src: "/openai.svg", alt: "OpenAI" },
  anthropic: { src: "/claude-color.svg", alt: "Anthropic" },
  perplexity: { src: "/perplexity-color.svg", alt: "Perplexity" },
  xai: { src: "/grok.svg", alt: "xAI" },
  meta: { src: "/meta-color.svg", alt: "Meta" },
  mistral: { src: "/mistral-color.svg", alt: "Mistral" },
  microsoft: { src: "/microsoft-color.svg", alt: "Microsoft" },
  deepseek: { src: "/deepseek-color.svg", alt: "DeepSeek" },
  qwen: { src: "/qwen-color.svg", alt: "Qwen" },
  moonshotai: { src: "/moonshot.svg", alt: "Moonshot AI" },
  zai: { src: "/zai.svg", alt: "Z.AI" },
  cohere: { src: "/cohere-color.svg", alt: "Cohere" },
  nvidia: { src: "/nvidia-color.svg", alt: "Nvidia" },
  minimax: { src: "/minimax-color.svg", alt: "MiniMax" },
  tencent: { src: "/tencent-color.svg", alt: "Tencent" },
  nousresearch: { src: "/nousresearch.svg", alt: "Nous Research" },
  morph: { src: "/morph-color.svg", alt: "Morph" },
  bytedance: { src: "/bytedance-color.svg", alt: "ByteDance" },
  baidu: { src: "/baidu-color.svg", alt: "Baidu" },
  openrouter: { src: "/openrouter.svg", alt: "OpenRouter" },
  arcee: { src: "/arcee-color.svg", alt: "Arcee AI" },
  unknown: { src: "", alt: "Unknown" },
};

// Parse model name to extract provider and clean name
export function parseModelName(modelId: string, modelName: string): { provider: ModelProvider; cleanName: string } {
  const idLower = modelId.toLowerCase();
  
  // Determine provider from model ID
  let provider: ModelProvider = "unknown";
  if (idLower.startsWith("google/") || idLower.includes("gemini")) {
    provider = "google";
  } else if (idLower.startsWith("openai/") || idLower.includes("gpt")) {
    provider = "openai";
  } else if (idLower.startsWith("anthropic/") || idLower.includes("claude")) {
    provider = "anthropic";
  } else if (idLower.startsWith("perplexity/")) {
    provider = "perplexity";
  } else if (idLower.startsWith("x-ai/") || idLower.startsWith("xai/")) {
    provider = "xai";
  } else if (idLower.startsWith("meta-llama/") || idLower.startsWith("meta/") || idLower.includes("llama")) {
    provider = "meta";
  } else if (idLower.startsWith("mistralai/") || idLower.startsWith("mistral/") || idLower.includes("mistral") || idLower.includes("mixtral")) {
    provider = "mistral";
  } else if (idLower.startsWith("microsoft/") || idLower.includes("phi-")) {
    provider = "microsoft";
  } else if (idLower.startsWith("deepseek/") || idLower.includes("deepseek")) {
    provider = "deepseek";
  } else if (idLower.startsWith("qwen/") || idLower.includes("qwen")) {
    provider = "qwen";
  } else if (idLower.startsWith("moonshotai/") || idLower.includes("moonshot")) {
    provider = "moonshotai";
  } else if (idLower.startsWith("zai/") || idLower.startsWith("z-ai/")) {
    provider = "zai";
  } else if (idLower.startsWith("cohere/") || idLower.includes("command-r") || idLower.includes("command-a")) {
    provider = "cohere";
  } else if (idLower.startsWith("nvidia/") || idLower.includes("nemotron")) {
    provider = "nvidia";
  } else if (idLower.startsWith("minimax/")) {
    provider = "minimax";
  } else if (idLower.startsWith("tencent/")) {
    provider = "tencent";
  } else if (idLower.startsWith("nousresearch/") || idLower.includes("hermes")) {
    provider = "nousresearch";
  } else if (idLower.startsWith("morph/")) {
    provider = "morph";
  } else if (idLower.startsWith("bytedance/") || idLower.startsWith("bytedance-seed/")) {
    provider = "bytedance";
  } else if (idLower.startsWith("baidu/") || idLower.includes("ernie")) {
    provider = "baidu";
  } else if (idLower.startsWith("openrouter/")) {
    provider = "openrouter";
  } else if (idLower.startsWith("arcee-ai/") || idLower.startsWith("arcee/")) {
    provider = "arcee";
  }
  
  // Clean the model name by removing any "Provider: " prefix pattern
  // This regex matches any word characters (including spaces) followed by ": " at the start
  const cleanName = modelName.replace(/^[A-Za-z0-9\s.-]+:\s*/, "");
  
  return { provider, cleanName };
}

// Provider icon component
export function ProviderIcon({ provider, className = "size-4" }: { provider: ModelProvider; className?: string }) {
  if (provider === "unknown") {
    return <IconCpu className={`${className} select-none`} />;
  }
  
  const icon = PROVIDER_ICONS[provider];
  const needsInvert = (NON_COLOR_ICONS as readonly string[]).includes(provider);
  
  return (
    <Image
      src={icon.src}
      alt={icon.alt}
      width={24}
      height={24}
      className={`${className}${needsInvert ? " dark:invert" : ""} select-none pointer-events-none`}
      draggable={false}
    />
  );
}

export function ModelPicker({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [showAllModels, setShowAllModels] = useState(false);
  const [recentModelIds, setRecentModelIds] = useState<string[]>([]);

  const { user } = useAuth();
  const {
    providers,
    selectedModel,
    setSelectedModel,
    updateProvider,
    getActiveProvider,
    getActiveModel,
  } = useProvidersStore();

  const activeProvider = getActiveProvider();
  const activeModel = getActiveModel();

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

  // Reset showAllModels when dropdown closes
  useEffect(() => {
    if (!open) {
      setShowAllModels(false);
      setSearch("");
    }
  }, [open]);

  // Refresh models if cache is stale or models are missing
  useEffect(() => {
    async function refreshModels() {
      if (!user) return;

      for (const provider of providers) {
        // Check if models are missing or stale
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
          });
        }
      }
    }

    return models;
  }, [providers, recentModelIds]);

  // Filter models based on search
  const filteredModels = useMemo(() => {
    if (!search.trim()) return allModels;
    const searchLower = search.toLowerCase();
    return allModels.filter(
      (m) =>
        m.modelId.toLowerCase().includes(searchLower) ||
        m.modelName.toLowerCase().includes(searchLower) ||
        m.cleanName.toLowerCase().includes(searchLower)
    );
  }, [allModels, search]);

  // Separate recent, popular, and other models
  const recentModels = filteredModels.filter((m) => m.isRecent);
  const popularModels = filteredModels.filter((m) => m.isPopular && !m.isRecent);
  const otherModels = filteredModels.filter((m) => !m.isPopular && !m.isRecent);

  // Get display info for current model - MUST be before any early returns
  const currentModelInfo = useMemo(() => {
    if (!selectedModel) return null;
    const model = allModels.find(
      (m) => m.providerId === selectedModel.providerId && m.modelId === selectedModel.modelId
    );
    if (model) return model;
    
    // Fallback: parse from modelId if not found in list
    const { provider, cleanName } = parseModelName(selectedModel.modelId, selectedModel.modelId);
    return { modelProvider: provider, cleanName, modelName: selectedModel.modelId };
  }, [selectedModel, allModels]);

  const handleSelectModel = (providerId: string, modelId: string) => {
    setSelectedModel(providerId, modelId);
    setOpen(false);
    setSearch("");
  };

  // No providers configured
  if (providers.length === 0) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="gap-2 text-muted-foreground"
        onClick={onOpenSettings}
      >
        <IconSparkles className="size-4" />
        <span className="hidden sm:inline">Configure a provider</span>
        <span className="sm:hidden">Setup</span>
      </Button>
    );
  }

  // No models available yet
  if (allModels.length === 0) {
    return (
      <Button variant="ghost" size="sm" className="gap-2" disabled>
        <IconSparkles className="size-4" />
        {isLoadingModels ? "Loading models..." : "No models available"}
      </Button>
    );
  }

  // Use cleanName (parsed model name without provider prefix) for display
  const displayName = currentModelInfo?.cleanName || currentModelInfo?.modelName || selectedModel?.modelId || "Select a model";
  const shortDisplayName = displayName.length > 30 
    ? displayName.slice(0, 27) + "..." 
    : displayName;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 max-w-[220px]">
          {currentModelInfo ? (
            <ProviderIcon provider={currentModelInfo.modelProvider} className="size-4 shrink-0" />
          ) : (
            <IconSparkles className="size-4 shrink-0" />
          )}
          <span className="truncate">{shortDisplayName}</span>
          <IconChevronDown className="size-3 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80">
        {/* Search - only show when showing all models */}
        {showAllModels && (
          <>
            <div className="p-2">
              <div className="relative">
                <IconSearch className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search models..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-8"
                />
              </div>
            </div>
            <DropdownMenuSeparator />
          </>
        )}

        <ScrollArea className="h-[300px] [&>div>div]:!block [&_[data-radix-scroll-area-scrollbar]]:hidden">
          {/* Recent Models */}
          {recentModels.length > 0 && !showAllModels && (
            <>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Recent
              </DropdownMenuLabel>
              {recentModels.map((model) => {
                const isSelected = selectedModel?.modelId === model.modelId && selectedModel?.providerId === model.providerId;
                return (
                  <DropdownMenuItem
                    key={`recent-${model.providerId}-${model.modelId}`}
                    onClick={() => handleSelectModel(model.providerId, model.modelId)}
                    className="flex items-center gap-2 py-2"
                  >
                    <ProviderIcon provider={model.modelProvider} className="size-6 shrink-0" />
                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                      <span className="font-medium text-sm truncate">{model.cleanName}</span>
                      <span className="text-xs text-muted-foreground truncate">
                        {model.modelId}
                      </span>
                    </div>
                    {isSelected && <IconCheck className="size-4 shrink-0 text-primary" />}
                    <Image src="/openrouter.svg" alt="OpenRouter" width={16} height={16} className="size-4 shrink-0 opacity-50 mr-1 dark:invert" />
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator />
            </>
          )}

          {/* Popular Models */}
          {popularModels.length > 0 && !showAllModels && (
            <>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Popular
              </DropdownMenuLabel>
              {popularModels.map((model) => {
                const isSelected = selectedModel?.modelId === model.modelId && selectedModel?.providerId === model.providerId;
                return (
                  <DropdownMenuItem
                    key={`popular-${model.providerId}-${model.modelId}`}
                    onClick={() => handleSelectModel(model.providerId, model.modelId)}
                    className="flex items-center gap-2 py-2"
                  >
                    <ProviderIcon provider={model.modelProvider} className="size-6 shrink-0" />
                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                      <span className="font-medium text-sm truncate">{model.cleanName}</span>
                      <span className="text-xs text-muted-foreground truncate">
                        {model.modelId}
                      </span>
                    </div>
                    {isSelected && <IconCheck className="size-4 shrink-0 text-primary" />}
                    <Image src="/openrouter.svg" alt="OpenRouter" width={16} height={16} className="size-4 shrink-0 opacity-50 mr-1 dark:invert" />
                  </DropdownMenuItem>
                );
              })}
            </>
          )}

          {/* All Models - only when showAllModels is true */}
          {showAllModels && (
            <>
              {filteredModels.length > 0 ? (
                <>
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    All Models
                  </DropdownMenuLabel>
                  {filteredModels.map((model) => {
                    const isSelected = selectedModel?.modelId === model.modelId && selectedModel?.providerId === model.providerId;
                    return (
                      <DropdownMenuItem
                        key={`all-${model.providerId}-${model.modelId}`}
                        onClick={() => handleSelectModel(model.providerId, model.modelId)}
                        className="flex items-center gap-2 py-2"
                      >
                        <ProviderIcon provider={model.modelProvider} className="size-6 shrink-0" />
                        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                          <span className="font-medium text-sm truncate">{model.cleanName}</span>
                          <span className="text-xs text-muted-foreground truncate">
                            {model.modelId}
                          </span>
                        </div>
                        <Image src="/openrouter.svg" alt="OpenRouter" width={16} height={16} className="size-4 shrink-0 opacity-50 dark:invert" />
                        {isSelected && <IconCheck className="size-4 shrink-0 text-primary" />}
                      </DropdownMenuItem>
                    );
                  })}
                </>
              ) : (
                <p className="px-2 py-4 text-sm text-muted-foreground text-center">
                  No models found
                </p>
              )}
            </>
          )}
        </ScrollArea>

        {/* Show all models button - floating at bottom */}
        {!showAllModels && (
          <>
            <DropdownMenuSeparator />
            <div className="p-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowAllModels(true);
                }}
              >
                <IconList className="size-4" />
                Show all models
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
