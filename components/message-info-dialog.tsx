"use client";

import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Message } from "@/lib/chat-store";
import { Model } from "@/lib/providers-store";
import { parseModelName, ProviderIcon, ModelProvider } from "@/components/model-picker";
import {
  estimateTokenCount,
  calculateCost,
  formatCost,
  formatTokenCount,
} from "@/lib/token-utils";
import {
  IconInfoCircle,
  IconClock,
  IconCoins,
  IconHash,
  IconBrain,
} from "@tabler/icons-react";

interface MessageInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: Message;
  model: Model | null;
  modelProvider: ModelProvider | null;
  modelCleanName: string | null;
  /** Previous messages in the conversation for context token calculation */
  previousMessages?: Message[];
}

export function MessageInfoDialog({
  open,
  onOpenChange,
  message,
  model,
  modelProvider,
  modelCleanName,
  previousMessages = [],
}: MessageInfoDialogProps) {
  const isUser = message.role === "user";

  // Calculate token estimates
  const tokenInfo = useMemo(() => {
    const messageTokens = estimateTokenCount(message.content);

    if (isUser) {
      // For user messages, just show the message tokens
      return {
        messageTokens,
        promptTokens: null,
        completionTokens: null,
        totalTokens: messageTokens,
        cost: null,
      };
    }

    // For assistant messages, calculate prompt (context) + completion tokens
    const promptContent = previousMessages
      .map((m) => m.content)
      .join("\n");
    const promptTokens = estimateTokenCount(promptContent);
    const completionTokens = messageTokens;
    const totalTokens = promptTokens + completionTokens;

    // Calculate cost if we have pricing info
    let cost: number | null = null;
    if (model?.pricing) {
      cost = calculateCost(promptTokens, completionTokens, model.pricing);
    }

    return {
      messageTokens,
      promptTokens,
      completionTokens,
      totalTokens,
      cost,
    };
  }, [message.content, isUser, previousMessages, model?.pricing]);

  // Format timestamp
  const formattedDate = useMemo(() => {
    const date = new Date(message.timestamp);
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "medium",
    }).format(date);
  }, [message.timestamp]);

  // Relative time
  const relativeTime = useMemo(() => {
    const now = new Date();
    const date = new Date(message.timestamp);
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return "just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
    return null;
  }, [message.timestamp]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconInfoCircle className="size-5" />
            Information
          </DialogTitle>
          <DialogDescription>
            Details about this message including tokens and estimated cost.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Timestamp */}
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center size-8 rounded-lg bg-muted shrink-0">
              <IconClock className="size-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Sent</p>
              <p className="text-sm text-muted-foreground">
                {formattedDate}
                {relativeTime && (
                  <span className="text-muted-foreground/70"> ({relativeTime})</span>
                )}
              </p>
            </div>
          </div>

          {/* Model (for assistant messages) */}
          {!isUser && model && modelProvider && modelCleanName && (
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center size-8 rounded-lg bg-muted shrink-0">
                <IconBrain className="size-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Model</p>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <ProviderIcon provider={modelProvider} className="size-3.5" />
                  <span className="truncate">{modelCleanName}</span>
                </div>
                <p className="text-xs text-muted-foreground/70 font-mono truncate">
                  {model.id}
                </p>
                {/* Show that this was routed via Auto Router */}
                {message.requestedModelId === "openrouter/auto" && (
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    via <span className="font-medium">Auto Router</span>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Token counts */}
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center size-8 rounded-lg bg-muted shrink-0">
              <IconHash className="size-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Tokens (estimated)</p>
              {isUser ? (
                <p className="text-sm text-muted-foreground">
                  {formatTokenCount(tokenInfo.messageTokens)} tokens
                </p>
              ) : (
                <div className="space-y-0.5">
                  <p className="text-sm text-muted-foreground">
                    <span className="text-foreground">{formatTokenCount(tokenInfo.promptTokens || 0)}</span>
                    {" "}prompt + {" "}
                    <span className="text-foreground">{formatTokenCount(tokenInfo.completionTokens || 0)}</span>
                    {" "}completion
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    = {formatTokenCount(tokenInfo.totalTokens)} total tokens
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Cost estimate (only for assistant messages with pricing) */}
          {!isUser && tokenInfo.cost !== null && (
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center size-8 rounded-lg bg-muted shrink-0">
                <IconCoins className="size-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Estimated Cost</p>
                <p className="text-sm text-muted-foreground">
                  <span className="text-foreground font-medium">
                    {formatCost(tokenInfo.cost)}
                  </span>
                  <span className="text-xs text-muted-foreground/70 ml-1.5">
                    (based on OpenRouter rates)
                  </span>
                </p>
                {model?.pricing && (
                  <p className="text-xs text-muted-foreground/70">
                    ${(model.pricing.prompt * 1_000_000).toFixed(2)}/M prompt, 
                    ${(model.pricing.completion * 1_000_000).toFixed(2)}/M completion
                  </p>
                )}
              </div>
            </div>
          )}

          {/* No pricing available notice */}
          {!isUser && tokenInfo.cost === null && (
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center size-8 rounded-lg bg-muted shrink-0">
                <IconCoins className="size-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Estimated Cost</p>
                <p className="text-sm text-muted-foreground/70 italic">
                  Pricing not available for this model
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter showCloseButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
