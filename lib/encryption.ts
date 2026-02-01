// Simple encryption/decryption for API keys
// Note: This is basic obfuscation. For production, consider using a proper encryption service.

const ENCRYPTION_KEY = "localchat-encryption-key-v1";

function stringToArrayBuffer(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function arrayBufferToString(buffer: ArrayBuffer): string {
  return new TextDecoder().decode(buffer);
}

async function getKey(): Promise<CryptoKey> {
  const encodedKey = stringToArrayBuffer(ENCRYPTION_KEY);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encodedKey.buffer as ArrayBuffer,
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  const encodedSalt = stringToArrayBuffer("localchat-salt");
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encodedSalt.buffer as ArrayBuffer,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptApiKey(plainText: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedPlainText = stringToArrayBuffer(plainText);
  
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
    key,
    encodedPlainText.buffer as ArrayBuffer
  );

  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  // Convert to base64 for storage
  return btoa(String.fromCharCode(...combined));
}

export async function decryptApiKey(encryptedText: string): Promise<string> {
  const key = await getKey();
  
  // Decode from base64
  const combined = Uint8Array.from(atob(encryptedText), (c) => c.charCodeAt(0));
  
  // Extract IV and encrypted data
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
    key,
    encrypted.buffer as ArrayBuffer
  );

  return arrayBufferToString(decrypted);
}
