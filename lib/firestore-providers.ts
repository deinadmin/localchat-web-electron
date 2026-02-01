import {
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  collection,
  getDocs,
} from "firebase/firestore";
import { encryptApiKey, decryptApiKey } from "./encryption";

interface StoredProvider {
  id: string;
  type: string;
  name: string;
  encryptedApiKey: string;
  verified: boolean;
  createdAt: number;
}

async function getFirestore() {
  const { getFirebaseApp } = await import("./firebase");
  const { getFirestore } = await import("firebase/firestore");
  return getFirestore(getFirebaseApp());
}

export async function saveProviderApiKey(
  userId: string,
  providerId: string,
  providerType: string,
  providerName: string,
  apiKey: string
): Promise<void> {
  const db = await getFirestore();
  const encryptedKey = await encryptApiKey(apiKey);

  const providerRef = doc(db, "users", userId, "providers", providerId);
  await setDoc(providerRef, {
    id: providerId,
    type: providerType,
    name: providerName,
    encryptedApiKey: encryptedKey,
    verified: true,
    createdAt: Date.now(),
  } as StoredProvider);
}

export async function getProviderApiKey(
  userId: string,
  providerId: string
): Promise<string | null> {
  const db = await getFirestore();
  const providerRef = doc(db, "users", userId, "providers", providerId);
  const providerDoc = await getDoc(providerRef);

  if (!providerDoc.exists()) {
    return null;
  }

  const data = providerDoc.data() as StoredProvider;
  return decryptApiKey(data.encryptedApiKey);
}

export async function getAllProviders(
  userId: string
): Promise<StoredProvider[]> {
  const db = await getFirestore();
  const providersRef = collection(db, "users", userId, "providers");
  const snapshot = await getDocs(providersRef);

  return snapshot.docs.map((doc) => doc.data() as StoredProvider);
}

export async function deleteProviderApiKey(
  userId: string,
  providerId: string
): Promise<void> {
  const db = await getFirestore();
  const providerRef = doc(db, "users", userId, "providers", providerId);
  await deleteDoc(providerRef);
}
