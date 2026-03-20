"use client";

import { create } from "zustand";
import type { UrlCitation } from "./openrouter";

export type { UrlCitation };

export type StreamingStatus = 'connecting' | 'searching' | 'thinking' | 'generating' | null;

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  modelId?: string;
  requestedModelId?: string;
  error?: string;
  annotations?: UrlCitation[];
  reasoning?: string;
  thinkingDuration?: number;
}

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  pinned?: boolean;
}

interface ChatState {
  chats: Chat[];
  activeChatId: string | null;
  isLoading: boolean;
  streamingMessageId: string | null;
  streamingStatus: StreamingStatus;
  userId: string | null;
  isInitialSyncComplete: boolean;

  // Actions
  createChat: () => string;
  deleteChat: (id: string) => void;
  setActiveChat: (id: string | null) => void;
  addMessage: (chatId: string, message: Omit<Message, "id" | "timestamp">) => void;
  addMessageWithId: (chatId: string, message: Omit<Message, "timestamp"> & { id: string }) => void;
  updateMessageContent: (chatId: string, messageId: string, content: string) => void;
  updateMessageModel: (chatId: string, messageId: string, modelId: string) => void;
  setMessageError: (chatId: string, messageId: string, error: string) => void;
  clearMessageError: (chatId: string, messageId: string) => void;
  appendToMessage: (chatId: string, messageId: string, chunk: string) => void;
  appendToMessageReasoning: (chatId: string, messageId: string, chunk: string) => void;
  setMessageThinkingDuration: (chatId: string, messageId: string, duration: number) => void;
  setMessageAnnotations: (chatId: string, messageId: string, annotations: UrlCitation[]) => void;
  deleteMessage: (chatId: string, messageId: string) => void;
  updateChatTitle: (chatId: string, title: string) => void;
  togglePinChat: (chatId: string) => void;
  setLoading: (loading: boolean) => void;
  setStreamingMessageId: (id: string | null) => void;
  setStreamingStatus: (status: StreamingStatus) => void;
  
  // Firestore sync
  setUserId: (userId: string | null) => void;
  setChats: (chats: Chat[]) => void;
  getChatById: (chatId: string) => Chat | undefined;
  setInitialSyncComplete: (complete: boolean) => void;

  // Getters
  getActiveChat: () => Chat | undefined;
}

const generateId = () => Math.random().toString(36).substring(2, 15);

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  activeChatId: null,
  isLoading: false,
  streamingMessageId: null,
  streamingStatus: null,
  userId: null,
  isInitialSyncComplete: false,

  createChat: () => {
    const id = generateId();
    const newChat: Chat = {
      id,
      title: "New Chat",
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    set((state) => ({
      chats: [newChat, ...state.chats],
      activeChatId: id,
    }));

    return id;
  },

  deleteChat: (id) => {
    set((state) => ({
      chats: state.chats.filter((chat) => chat.id !== id),
      activeChatId: state.activeChatId === id ? null : state.activeChatId,
    }));
  },

  setActiveChat: (id) => {
    set({ activeChatId: id });
  },

  addMessage: (chatId, message) => {
    const newMessage: Message = {
      ...message,
      id: generateId(),
      timestamp: new Date(),
    };

    set((state) => ({
      chats: state.chats.map((chat) => {
        if (chat.id !== chatId) return chat;

        const updatedChat = {
          ...chat,
          messages: [...chat.messages, newMessage],
          updatedAt: new Date(),
        };

        // Auto-generate title from first user message
        if (
          chat.title === "New Chat" &&
          message.role === "user" &&
          chat.messages.length === 0
        ) {
          updatedChat.title =
            message.content.slice(0, 30) + (message.content.length > 30 ? "..." : "");
        }

        return updatedChat;
      }),
    }));
  },

  addMessageWithId: (chatId, message) => {
    const newMessage: Message = {
      ...message,
      timestamp: new Date(),
    };

    set((state) => ({
      chats: state.chats.map((chat) => {
        if (chat.id !== chatId) return chat;

        const updatedChat = {
          ...chat,
          messages: [...chat.messages, newMessage],
          updatedAt: new Date(),
        };

        return updatedChat;
      }),
    }));
  },

  updateMessageContent: (chatId, messageId, content) => {
    set((state) => ({
      chats: state.chats.map((chat) => {
        if (chat.id !== chatId) return chat;
        return {
          ...chat,
          messages: chat.messages.map((msg) =>
            msg.id === messageId ? { ...msg, content } : msg
          ),
          updatedAt: new Date(),
        };
      }),
    }));
  },

  updateMessageModel: (chatId, messageId, modelId) => {
    set((state) => ({
      chats: state.chats.map((chat) => {
        if (chat.id !== chatId) return chat;
        return {
          ...chat,
          messages: chat.messages.map((msg) =>
            msg.id === messageId ? { ...msg, modelId } : msg
          ),
          updatedAt: new Date(),
        };
      }),
    }));
  },

  setMessageError: (chatId, messageId, error) => {
    set((state) => ({
      chats: state.chats.map((chat) => {
        if (chat.id !== chatId) return chat;
        return {
          ...chat,
          messages: chat.messages.map((msg) =>
            msg.id === messageId ? { ...msg, error } : msg
          ),
          updatedAt: new Date(),
        };
      }),
    }));
  },

  clearMessageError: (chatId, messageId) => {
    set((state) => ({
      chats: state.chats.map((chat) => {
        if (chat.id !== chatId) return chat;
        return {
          ...chat,
          messages: chat.messages.map((msg) =>
            msg.id === messageId ? { ...msg, error: undefined } : msg
          ),
          updatedAt: new Date(),
        };
      }),
    }));
  },

  appendToMessage: (chatId, messageId, chunk) => {
    set((state) => ({
      chats: state.chats.map((chat) => {
        if (chat.id !== chatId) return chat;
        return {
          ...chat,
          messages: chat.messages.map((msg) =>
            msg.id === messageId ? { ...msg, content: msg.content + chunk } : msg
          ),
          updatedAt: new Date(),
        };
      }),
    }));
  },

  appendToMessageReasoning: (chatId, messageId, chunk) => {
    set((state) => ({
      chats: state.chats.map((chat) => {
        if (chat.id !== chatId) return chat;
        return {
          ...chat,
          messages: chat.messages.map((msg) =>
            msg.id === messageId ? { ...msg, reasoning: (msg.reasoning || '') + chunk } : msg
          ),
          // Ensure Firestore sync triggers while we're only streaming reasoning.
          updatedAt: new Date(),
        };
      }),
    }));
  },

  setMessageThinkingDuration: (chatId, messageId, duration) => {
    set((state) => ({
      chats: state.chats.map((chat) => {
        if (chat.id !== chatId) return chat;
        return {
          ...chat,
          messages: chat.messages.map((msg) =>
            msg.id === messageId ? { ...msg, thinkingDuration: duration } : msg
          ),
          // Ensure Firestore sync triggers when reasoning ends.
          updatedAt: new Date(),
        };
      }),
    }));
  },

  setMessageAnnotations: (chatId, messageId, annotations) => {
    set((state) => ({
      chats: state.chats.map((chat) => {
        if (chat.id !== chatId) return chat;
        return {
          ...chat,
          messages: chat.messages.map((msg) =>
            msg.id === messageId ? { ...msg, annotations } : msg
          ),
        };
      }),
    }));
  },

  deleteMessage: (chatId, messageId) => {
    set((state) => ({
      chats: state.chats.map((chat) => {
        if (chat.id !== chatId) return chat;
        return {
          ...chat,
          messages: chat.messages.filter((msg) => msg.id !== messageId),
          updatedAt: new Date(),
        };
      }),
    }));
  },

  updateChatTitle: (chatId, title) => {
    set((state) => ({
      chats: state.chats.map((chat) =>
        chat.id === chatId ? { ...chat, title, updatedAt: new Date() } : chat
      ),
    }));
  },

  togglePinChat: (chatId) => {
    set((state) => ({
      chats: state.chats.map((chat) =>
        chat.id === chatId ? { ...chat, pinned: !chat.pinned, updatedAt: new Date() } : chat
      ),
    }));
  },

  setLoading: (loading) => {
    set({ isLoading: loading });
  },

  setStreamingMessageId: (id) => {
    set({ streamingMessageId: id });
  },

  setStreamingStatus: (status) => {
    set({ streamingStatus: status });
  },

  setUserId: (userId) => {
    set({ userId, chats: [], activeChatId: null, isInitialSyncComplete: false });
  },

  setChats: (chats) => {
    set({ chats });
  },

  getChatById: (chatId) => {
    const state = get();
    return state.chats.find((chat) => chat.id === chatId);
  },

  setInitialSyncComplete: (complete) => {
    set({ isInitialSyncComplete: complete });
  },

  getActiveChat: () => {
    const state = get();
    return state.chats.find((chat) => chat.id === state.activeChatId);
  },
}));
