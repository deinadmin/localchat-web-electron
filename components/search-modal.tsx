"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useChatStore, Chat } from "@/lib/chat-store";
import { useProvidersStore } from "@/lib/providers-store";
import { parseModelName } from "@/components/model-picker";
import { IconSearch, IconMessage, IconPin } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { VisuallyHidden } from "radix-ui";

interface SearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffSeconds < 60) {
    return "Just now";
  } else if (diffMinutes === 1) {
    return "1 minute ago";
  } else if (diffMinutes < 60) {
    return `${diffMinutes} minutes ago`;
  } else if (diffHours === 1) {
    return "1 hour ago";
  } else if (diffHours < 24) {
    return `${diffHours} hours ago`;
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else if (diffWeeks === 1) {
    return "1 week ago";
  } else if (diffWeeks < 4) {
    return `${diffWeeks} weeks ago`;
  } else if (diffMonths === 1) {
    return "1 month ago";
  } else {
    return `${diffMonths} months ago`;
  }
}

function getLastModelName(chat: Chat, providers: ReturnType<typeof useProvidersStore.getState>["providers"]): string | null {
  // Find the last assistant message with a modelId
  const lastAssistantMessage = [...chat.messages]
    .reverse()
    .find((m) => m.role === "assistant" && m.modelId);

  if (!lastAssistantMessage?.modelId) return null;

  // Find the model name from providers
  for (const provider of providers) {
    const model = provider.models?.find((m) => m.id === lastAssistantMessage.modelId);
    if (model) {
      // Use parseModelName to get the clean name without provider prefix
      const { cleanName } = parseModelName(model.id, model.name);
      return cleanName;
    }
  }

  // Fallback: extract model name from ID (e.g., "google/gemini-3-flash" -> "gemini-3-flash")
  const modelId = lastAssistantMessage.modelId;
  const parts = modelId.split("/");
  return parts[parts.length - 1];
}

export function SearchModal({ open, onOpenChange }: SearchModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { chats, setActiveChat, getChatById } = useChatStore();
  const { providers, setSelectedModel } = useProvidersStore();

  // Filter chats based on search query
  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) {
      // Show all chats sorted by most recent, pinned first
      return [...chats].sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
    }

    const query = searchQuery.toLowerCase();
    return chats
      .filter((chat) => {
        // Search in title
        if (chat.title.toLowerCase().includes(query)) return true;
        // Search in message content
        return chat.messages.some((m) => m.content.toLowerCase().includes(query));
      })
      .sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [chats, searchQuery]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredChats.length]);

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      setSearchQuery("");
      setSelectedIndex(0);
      // Delay focus to ensure the dialog has fully rendered
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  }, [open]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && filteredChats.length > 0) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex, filteredChats.length]);

  const handleSelectChat = useCallback((chatId: string) => {
    // Switch to the last model used in this chat
    const chat = getChatById(chatId);
    if (chat) {
      const lastAssistantMessage = [...chat.messages]
        .reverse()
        .find((m) => m.role === "assistant" && m.modelId);
      
      if (lastAssistantMessage?.modelId) {
        const provider = providers.find((p) => 
          p.models?.some((m) => m.id === lastAssistantMessage.modelId)
        );
        if (provider) {
          setSelectedModel(provider.id, lastAssistantMessage.modelId);
        }
      }
    }
    
    setActiveChat(chatId);
    onOpenChange(false);
  }, [setActiveChat, onOpenChange, getChatById, providers, setSelectedModel]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredChats.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filteredChats[selectedIndex]) {
          handleSelectChat(filteredChats[selectedIndex].id);
        }
        break;
      case "Escape":
        e.preventDefault();
        onOpenChange(false);
        break;
    }
  }, [filteredChats, selectedIndex, handleSelectChat, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="p-0 gap-0 sm:max-w-xl overflow-hidden top-[20%] translate-y-0"
        onKeyDown={handleKeyDown}
      >
        <VisuallyHidden.Root>
          <DialogTitle>Search chats</DialogTitle>
        </VisuallyHidden.Root>

        {/* Search Input */}
        <div className="flex items-center border-b px-4 py-3">
          <IconSearch className="size-5 text-muted-foreground shrink-0 mr-3" />
          <input
            ref={inputRef}
            placeholder="Search chat titles or messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 text-lg bg-transparent border-0 outline-none placeholder:text-muted-foreground/50"
          />
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          className="max-h-[360px] overflow-y-auto overscroll-contain"
        >
          {filteredChats.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {searchQuery ? "No chats found" : "No chats yet"}
            </div>
          ) : (
            <div className="py-2">
              {filteredChats.map((chat, index) => {
                const modelName = getLastModelName(chat, providers);
                const relativeTime = formatRelativeTime(new Date(chat.updatedAt));

                return (
                  <button
                    key={chat.id}
                    onClick={() => handleSelectChat(chat.id)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={cn(
                      "w-full px-4 py-3 flex items-start gap-3 text-left transition-colors",
                      index === selectedIndex
                        ? "bg-accent"
                        : "hover:bg-accent/50"
                    )}
                  >
                    {/* Icon */}
                    <div className="pt-0.5 shrink-0">
                      {chat.pinned ? (
                        <IconPin className="size-4 text-primary" />
                      ) : (
                        <IconMessage className="size-4 text-muted-foreground" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Title */}
                      <div className="font-medium text-sm truncate">
                        {chat.title}
                      </div>

                      {/* Model and timestamp */}
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        {modelName && (
                          <>
                            <span className="truncate max-w-[180px]">{modelName}</span>
                            <span className="text-muted-foreground/50">·</span>
                          </>
                        )}
                        <span className="shrink-0">{relativeTime}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer hint */}
        {filteredChats.length > 0 && (
          <div className="border-t px-4 py-2 text-xs text-muted-foreground flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">↑↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">↵</kbd>
              open
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">esc</kbd>
              close
            </span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
