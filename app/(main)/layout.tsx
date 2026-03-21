"use client";

import { Suspense } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { LoadingOverlay } from "@/components/loading-overlay";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import { ElectronProvider } from "@/lib/electron-context";
import { ScrollProvider } from "@/lib/scroll-context";
import { Toaster } from "sonner";
import { IconCircleCheck, IconCircleX, IconInfoCircle, IconLoader2 } from "@tabler/icons-react";
import { useChatSync } from "@/lib/use-chat-sync";
import { useChatUrlSync } from "@/lib/use-chat-url-sync";

interface MainLayoutProps {
  children: React.ReactNode;
}

function ChatSyncInitializer({ children }: { children: React.ReactNode }) {
  useChatSync();
  useChatUrlSync();
  return <>{children}</>;
}

function MainContent({ children }: MainLayoutProps) {
  return (
    <ScrollProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <ChatSyncInitializer>
            <div className="flex flex-col h-screen overflow-hidden">
              {children}
            </div>
          </ChatSyncInitializer>
        </SidebarInset>
      </SidebarProvider>
    </ScrollProvider>
  );
}

export default function MainLayoutWrapper({ children }: MainLayoutProps) {
  return (
    <ElectronProvider>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider delayDuration={0}>
            <Suspense fallback={null}>
              <MainContent>{children}</MainContent>
            </Suspense>
            <LoadingOverlay />
          </TooltipProvider>
          <Toaster 
            position="bottom-left" 
            className="!bottom-6 !left-6"
            icons={{
              success: <IconCircleCheck className="!size-4 text-green-500" />,
              error: <IconCircleX className="!size-4 text-red-500" />,
              info: <IconInfoCircle className="!size-4 text-blue-500" />,
              loading: <IconLoader2 className="!size-4 text-primary animate-spin" />,
            }}
            toastOptions={{
              className: "!bg-background/50 dark:!bg-black/50 !backdrop-blur-xl !border-border/50 !shadow-lg !text-xs !py-2 !px-3 !min-h-0 !gap-1.5 !max-w-[284px] !rounded-xl !text-foreground",
            }}
          />
        </AuthProvider>
      </ThemeProvider>
    </ElectronProvider>
  );
}
