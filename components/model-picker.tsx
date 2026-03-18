"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { ModelPickerModal } from "@/components/model-picker-modal";
import { useProvidersStore, shouldRefreshModels } from "@/lib/providers-store";
import { useAuth } from "@/lib/auth-context";
import { fetchModels } from "@/lib/openrouter";
import { getProviderApiKey } from "@/lib/firestore-providers";
import {
  IconChevronDown,
  IconSparkles,
  IconCpu,
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
  // Split on first colon followed by space and take the part after it
  const cleanName = modelName.includes(": ") 
    ? modelName.split(": ").slice(1).join(": ")
    : modelName;
  
  return { provider, cleanName };
}

// Provider icon component
export function ProviderIcon({ provider, className = "size-4", inverted = false }: { provider: ModelProvider; className?: string; inverted?: boolean }) {
  if (provider === "unknown") {
    return <IconCpu className={`${className} select-none`} />;
  }
  
  const icon = PROVIDER_ICONS[provider];
  const isMonochrome = (NON_COLOR_ICONS as readonly string[]).includes(provider);
  
  // Only monochrome (black) icons need inversion handling
  // - Normal state: invert in dark mode so black icons become white
  // - Inverted state (selected chip): invert in light mode so black icons become white on black bg
  let invertClass = "";
  if (isMonochrome) {
    invertClass = inverted ? " invert dark:invert-0" : " dark:invert";
  }
  
  return (
    <Image
      src={icon.src}
      alt={icon.alt}
      width={24}
      height={24}
      className={`${className}${invertClass} select-none pointer-events-none`}
      draggable={false}
    />
  );
}

export function ModelPicker({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  const { user } = useAuth();
  const {
    providers,
    selectedModel,
    updateProvider,
  } = useProvidersStore();

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

  // Global keyboard shortcut for model picker (Cmd/Ctrl + Shift + M)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "m" &&
        (event.metaKey || event.ctrlKey) &&
        event.shiftKey
      ) {
        event.preventDefault();
        setModalOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Get all available models from all providers
  const allModels = useMemo(() => {
    const models: Array<{
      providerId: string;
      modelId: string;
      modelName: string;
      cleanName: string;
      modelProvider: ModelProvider;
    }> = [];

    for (const provider of providers) {
      if (provider.models) {
        for (const model of provider.models) {
          const { provider: modelProvider, cleanName } = parseModelName(model.id, model.name);
          models.push({
            providerId: provider.id,
            modelId: model.id,
            modelName: model.name,
            cleanName,
            modelProvider,
          });
        }
      }
    }

    return models;
  }, [providers]);

  // Get display info for current model
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
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 max-w-[220px]"
            onClick={() => setModalOpen(true)}
          >
            {currentModelInfo ? (
              <ProviderIcon provider={currentModelInfo.modelProvider} className="size-4 shrink-0" />
            ) : (
              <IconSparkles className="size-4 shrink-0" />
            )}
            <span className="truncate">{shortDisplayName}</span>
            <IconChevronDown className="size-3 shrink-0 opacity-50" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="flex items-center gap-2">
          Select Model
          <KbdGroup>
            <Kbd>⌘</Kbd>
            <Kbd>⇧</Kbd>
            <Kbd>M</Kbd>
          </KbdGroup>
        </TooltipContent>
      </Tooltip>

      <ModelPickerModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}
