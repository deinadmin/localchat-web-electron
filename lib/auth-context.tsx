"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import type { User } from "firebase/auth";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Only import and initialize Firebase on the client side
    const initAuth = async () => {
      const { getFirebaseAuth } = await import("@/lib/firebase");
      const { onAuthStateChanged } = await import("firebase/auth");
      
      const auth = getFirebaseAuth();
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        setUser(user);
        setLoading(false);
      });

      return unsubscribe;
    };

    let unsubscribe: (() => void) | undefined;
    
    initAuth().then((unsub) => {
      unsubscribe = unsub;
    }).catch((error) => {
      console.error("Failed to initialize auth:", error);
      setLoading(false);
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const signInWithGoogle = async () => {
    try {
      const { getFirebaseAuth, getGoogleProvider } = await import("@/lib/firebase");
      const { signInWithPopup } = await import("firebase/auth");
      
      const auth = getFirebaseAuth();
      const provider = getGoogleProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error signing in with Google:", error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      const { getFirebaseAuth } = await import("@/lib/firebase");
      const { signOut: firebaseSignOut } = await import("firebase/auth");
      
      const auth = getFirebaseAuth();
      await firebaseSignOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
