import {
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  orderBy,
  onSnapshot,
  Unsubscribe,
} from "firebase/firestore";
import type { Chat, Message } from "./chat-store";

// Firestore-compatible types (no Date objects)
interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  modelId?: string;
  error?: string;
}

interface StoredChat {
  id: string;
  title: string;
  messages: StoredMessage[];
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
}

async function getFirestore() {
  const { getFirebaseApp } = await import("./firebase");
  const { getFirestore } = await import("firebase/firestore");
  return getFirestore(getFirebaseApp());
}

// Convert Chat to StoredChat for Firestore
function chatToStored(chat: Chat): StoredChat {
  const stored: StoredChat = {
    id: chat.id,
    title: chat.title,
    messages: chat.messages.map((m) => {
      const storedMessage: StoredMessage = {
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp.getTime(),
      };
      // Only include modelId if it exists (Firebase doesn't accept undefined)
      if (m.modelId) {
        storedMessage.modelId = m.modelId;
      }
      // Only include error if it exists
      if (m.error) {
        storedMessage.error = m.error;
      }
      return storedMessage;
    }),
    createdAt: chat.createdAt.getTime(),
    updatedAt: chat.updatedAt.getTime(),
  };
  // Only include pinned if it's true (Firebase doesn't accept undefined)
  if (chat.pinned) {
    stored.pinned = true;
  }
  return stored;
}

// Convert StoredChat to Chat
function storedToChat(stored: StoredChat): Chat {
  return {
    id: stored.id,
    title: stored.title,
    messages: stored.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: new Date(m.timestamp),
      modelId: m.modelId,
      error: m.error,
    })),
    createdAt: new Date(stored.createdAt),
    updatedAt: new Date(stored.updatedAt),
    pinned: stored.pinned,
  };
}

// Save a chat to Firestore
export async function saveChat(userId: string, chat: Chat): Promise<void> {
  const db = await getFirestore();
  const chatRef = doc(db, "users", userId, "chats", chat.id);
  await setDoc(chatRef, chatToStored(chat));
}

// Get a single chat from Firestore
export async function getChat(userId: string, chatId: string): Promise<Chat | null> {
  const db = await getFirestore();
  const chatRef = doc(db, "users", userId, "chats", chatId);
  const chatDoc = await getDoc(chatRef);

  if (!chatDoc.exists()) {
    return null;
  }

  return storedToChat(chatDoc.data() as StoredChat);
}

// Get all chats for a user
export async function getAllChats(userId: string): Promise<Chat[]> {
  const db = await getFirestore();
  const chatsRef = collection(db, "users", userId, "chats");
  const q = query(chatsRef, orderBy("updatedAt", "desc"));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => storedToChat(doc.data() as StoredChat));
}

// Delete a chat from Firestore
export async function deleteFirestoreChat(userId: string, chatId: string): Promise<void> {
  const db = await getFirestore();
  const chatRef = doc(db, "users", userId, "chats", chatId);
  await deleteDoc(chatRef);
}

// Subscribe to chat changes (real-time sync)
export async function subscribeToChats(
  userId: string,
  onChatsChange: (chats: Chat[]) => void
): Promise<Unsubscribe> {
  const db = await getFirestore();
  const chatsRef = collection(db, "users", userId, "chats");
  const q = query(chatsRef, orderBy("updatedAt", "desc"));

  return onSnapshot(q, (snapshot) => {
    const chats = snapshot.docs.map((doc) => storedToChat(doc.data() as StoredChat));
    onChatsChange(chats);
  });
}

// Get recently used model IDs from chat history
export async function getRecentModelIds(userId: string, limit: number = 5): Promise<string[]> {
  const db = await getFirestore();
  const chatsRef = collection(db, "users", userId, "chats");
  const q = query(chatsRef, orderBy("updatedAt", "desc"));
  const snapshot = await getDocs(q);

  const modelIds = new Set<string>();
  
  for (const doc of snapshot.docs) {
    const chat = doc.data() as StoredChat;
    // Go through messages in reverse order (most recent first)
    for (let i = chat.messages.length - 1; i >= 0; i--) {
      const msg = chat.messages[i];
      if (msg.modelId && msg.role === "assistant") {
        modelIds.add(msg.modelId);
        if (modelIds.size >= limit) {
          return Array.from(modelIds);
        }
      }
    }
  }

  return Array.from(modelIds);
}
