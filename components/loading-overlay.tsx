"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useChatStore } from "@/lib/chat-store";
import { IconLoader2 } from "@tabler/icons-react";

export function LoadingOverlay() {
  const { loading: authLoading, user } = useAuth();
  const isInitialSyncComplete = useChatStore((state) => state.isInitialSyncComplete);
  const [isVisible, setIsVisible] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);

  // Determine if we're still loading
  // - If auth is loading, we're loading
  // - If auth is done and no user, we're done (no sync needed)
  // - If auth is done and user exists, wait for initial sync
  const isLoading = authLoading || (user !== null && !isInitialSyncComplete);

  useEffect(() => {
    if (!isLoading) {
      // Start fade out animation
      setIsFadingOut(true);
      // Remove from DOM after animation completes
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 300); // Match animation duration
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-background transition-opacity duration-300 ${
        isFadingOut ? "opacity-0" : "opacity-100"
      }`}
    >
      <IconLoader2 className="size-8 text-muted-foreground animate-spin" />
    </div>
  );
}
