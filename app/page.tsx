"use client";

import { Suspense } from "react";
import { SidebarProvider, SidebarTrigger, SidebarInset, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ChatView } from "@/components/chat-view";
import { ModelPicker } from "@/components/model-picker";
import { WindowControls } from "@/components/window-controls";
import { LoadingOverlay } from "@/components/loading-overlay";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import { ElectronProvider, useElectron } from "@/lib/electron-context";
import { ScrollProvider, useScroll } from "@/lib/scroll-context";
import { useChatSync } from "@/lib/use-chat-sync";
import { useChatUrlSync } from "@/lib/use-chat-url-sync";
import { Toaster } from "sonner";
import { IconCircleCheck, IconCircleX, IconInfoCircle, IconLoader2 } from "@tabler/icons-react";

// Component that initializes chat sync and URL sync
function ChatSyncInitializer({ children }: { children: React.ReactNode }) {
  useChatSync();
  useChatUrlSync();
  return <>{children}</>;
}

function MainLayout() {
  const { isScrolled } = useScroll();
  const { state, isMobile } = useSidebar();
  const { isElectron, platform } = useElectron();
  const isMacElectron = isElectron && platform === "darwin";
  const sidebarHidden = state === "collapsed";

  // Calculate left position based on sidebar state (offcanvas mode)
  const getLeftPosition = () => {
    if (isMobile) return "0px";
    // In offcanvas mode, sidebar overlays so content always starts at 0
    // But when open, we want content to respect sidebar width
    if (state === "collapsed") return "0px";
    return "var(--sidebar-width)";
  };

  return (
    <>
      <AppSidebar />
      <SidebarInset>
        <header 
          className={`fixed top-0 right-0 z-50 flex h-12 items-center gap-2 px-2 sm:px-4 transition-[border-color,left,background-color] duration-200 ease-linear ${
            isScrolled
              ? "bg-background/80 backdrop-blur-xl border-b"
              : "bg-background border-b border-transparent"
          }`}
          style={{ 
            left: getLeftPosition(),
            // Make the header draggable in Electron (except for interactive elements)
            WebkitAppRegion: isMacElectron ? "drag" : undefined,
          } as React.CSSProperties}
        >
          {/* Show window controls in header only when sidebar is hidden */}
          {isMacElectron && sidebarHidden && (
            <div 
              className="flex items-center ml-[6px]"
              style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            >
              <WindowControls className="mr-3" />
            </div>
          )}
          <div style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties} className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <ModelPicker />
          </div>
          {/* Draggable area fills remaining space */}
          <div className="flex-1" />
        </header>
        <div className="flex flex-col h-screen pt-12 overflow-hidden">
          <ChatView />
        </div>
      </SidebarInset>
    </>
  );
}

function MainContent() {
  return (
    <ChatSyncInitializer>
      <ScrollProvider>
        <SidebarProvider>
          <MainLayout />
        </SidebarProvider>
      </ScrollProvider>
    </ChatSyncInitializer>
  );
}

export default function Page() {
  return (
    <ElectronProvider>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider delayDuration={0}>
            <Suspense fallback={null}>
              <MainContent />
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
