"use client";

import { useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useChatStore } from "./chat-store";
import { useProvidersStore } from "./providers-store";

export function useChatUrlSync() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { activeChatId, chats, setActiveChat, getChatById, isInitialSyncComplete } = useChatStore();
  const { providers, setSelectedModel } = useProvidersStore();
  
  // Track if we're currently updating to prevent loops
  const isUpdatingFromUrlRef = useRef(false);
  const hasInitializedRef = useRef(false);

  // Helper to switch model based on chat's last assistant message
  const switchModelForChat = (chatId: string) => {
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
  };

  // On initial load: Read chatId from URL and set active chat
  useEffect(() => {
    // Only run once when initial sync is complete
    if (hasInitializedRef.current || !isInitialSyncComplete) return;
    
    const chatIdFromUrl = searchParams.get("chatId");
    
    if (chatIdFromUrl) {
      const chatExists = chats.some((chat) => chat.id === chatIdFromUrl);
      
      if (chatExists) {
        isUpdatingFromUrlRef.current = true;
        switchModelForChat(chatIdFromUrl);
        setActiveChat(chatIdFromUrl);
        setTimeout(() => {
          isUpdatingFromUrlRef.current = false;
        }, 100);
      } else {
        // Chat doesn't exist, remove the URL param
        const url = new URL(window.location.href);
        url.searchParams.delete("chatId");
        router.replace(url.pathname + url.search, { scroll: false });
      }
    }
    
    hasInitializedRef.current = true;
  }, [isInitialSyncComplete, chats, searchParams, setActiveChat, router, providers, getChatById, setSelectedModel]);

  // When activeChatId changes (from user interaction), update the URL
  useEffect(() => {
    // Skip if this change came from URL sync
    if (isUpdatingFromUrlRef.current) return;
    
    // Don't modify URL until initial sync from URL is complete
    if (!hasInitializedRef.current) return;
    
    const currentUrlChatId = searchParams.get("chatId");
    
    if (activeChatId) {
      // Set chatId in URL if different
      if (currentUrlChatId !== activeChatId) {
        const url = new URL(window.location.href);
        url.searchParams.set("chatId", activeChatId);
        router.replace(url.pathname + url.search, { scroll: false });
      }
    } else {
      // No active chat, remove chatId from URL if present
      if (currentUrlChatId) {
        const url = new URL(window.location.href);
        url.searchParams.delete("chatId");
        router.replace(url.pathname + url.search, { scroll: false });
      }
    }
  }, [activeChatId, router, searchParams]);
}
