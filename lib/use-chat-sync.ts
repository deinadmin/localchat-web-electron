"use client";

import { useEffect, useRef, useCallback } from "react";
import { useAuth } from "./auth-context";
import { useChatStore, Chat } from "./chat-store";
import {
  saveChat,
  deleteFirestoreChat,
  subscribeToChats,
} from "./firestore-chats";

// Debounce helper
function debounce<T extends (...args: Parameters<T>) => void>(fn: T, delay: number): T {
  let timeoutId: NodeJS.Timeout;
  return ((...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  }) as T;
}

export function useChatSync() {
  const { user } = useAuth();
  const { chats, setUserId, setChats, setInitialSyncComplete } = useChatStore();
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const lastSyncedChatsRef = useRef<Map<string, number>>(new Map());
  const isInitialLoadRef = useRef(true);
  const pendingLocalChatsRef = useRef<Set<string>>(new Set());

  // Save chat to Firestore (debounced)
  const saveChatToFirestore = useCallback(
    debounce(async (userId: string, chat: Chat) => {
      try {
        await saveChat(userId, chat);
        lastSyncedChatsRef.current.set(chat.id, chat.updatedAt.getTime());
        // Remove from pending once saved
        pendingLocalChatsRef.current.delete(chat.id);
      } catch (error) {
        console.error("Failed to save chat:", error);
      }
    }, 500),
    []
  );

  // Set user ID when auth changes
  useEffect(() => {
    if (user) {
      setUserId(user.uid);
      isInitialLoadRef.current = true;
    } else {
      setUserId(null);
      lastSyncedChatsRef.current.clear();
      pendingLocalChatsRef.current.clear();
    }
  }, [user, setUserId]);

  // Subscribe to Firestore changes
  useEffect(() => {
    if (!user) {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      return;
    }

    const setupSubscription = async () => {
      try {
        unsubscribeRef.current = await subscribeToChats(user.uid, (firestoreChats) => {
          // Merge Firestore chats with any pending local chats
          const currentChats = useChatStore.getState().chats;
          const firestoreChatIds = new Set(firestoreChats.map(c => c.id));
          const pendingIds = pendingLocalChatsRef.current;
          const currentChatsMap = new Map(currentChats.map(c => [c.id, c]));
          
          // For each Firestore chat, prefer local version if it has pending changes
          // This prevents stale Firestore data from overwriting local changes during debounce
          const mergedFromFirestore = firestoreChats.map(firestoreChat => {
            if (pendingIds.has(firestoreChat.id)) {
              const localChat = currentChatsMap.get(firestoreChat.id);
              if (localChat) {
                return localChat;
              }
            }
            return firestoreChat;
          });
          
          // Also include pending chats that don't exist in Firestore yet (new chats)
          const pendingNewChats = currentChats.filter(
            (chat) => !firestoreChatIds.has(chat.id) && pendingIds.has(chat.id)
          );
          
          // Merge: Firestore chats (with local overrides) + pending new chats
          const mergedChats = [...mergedFromFirestore, ...pendingNewChats];
          
          // Sort by updatedAt descending
          mergedChats.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
          
          setChats(mergedChats);
          
          // Update last synced timestamps
          firestoreChats.forEach((chat) => {
            lastSyncedChatsRef.current.set(chat.id, chat.updatedAt.getTime());
          });
          
          // Mark initial sync as complete
          if (isInitialLoadRef.current) {
            setInitialSyncComplete(true);
          }
          isInitialLoadRef.current = false;
        });
      } catch (error) {
        console.error("Failed to subscribe to chats:", error);
        isInitialLoadRef.current = false;
      }
    };

    setupSubscription();

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [user, setChats]);

  // Sync local changes to Firestore
  useEffect(() => {
    if (!user || isInitialLoadRef.current) return;

    // Find chats that have been updated locally
    chats.forEach((chat) => {
      const lastSynced = lastSyncedChatsRef.current.get(chat.id);
      const currentTime = chat.updatedAt.getTime();

      // If chat is new or has been updated since last sync
      if (!lastSynced || currentTime > lastSynced) {
        // Mark as pending so it won't be removed by Firestore sync
        pendingLocalChatsRef.current.add(chat.id);
        saveChatToFirestore(user.uid, chat);
      }
    });
  }, [user, chats, saveChatToFirestore]);

  // Delete chat from Firestore
  const deleteChat = useCallback(
    async (chatId: string) => {
      if (!user) return;

      try {
        await deleteFirestoreChat(user.uid, chatId);
        lastSyncedChatsRef.current.delete(chatId);
        pendingLocalChatsRef.current.delete(chatId);
      } catch (error) {
        console.error("Failed to delete chat from Firestore:", error);
      }
    },
    [user]
  );

  return { deleteChat };
}
