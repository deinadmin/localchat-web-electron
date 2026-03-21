"use client";

import React, { useState, useMemo, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuAction,
  useSidebar,
} from "@/components/ui/sidebar";
import { SearchModal } from "@/components/search-modal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { WindowControls } from "@/components/window-controls";
import { useChatStore } from "@/lib/chat-store";
import { getPickerModelIdFromLastAssistant } from "@/lib/chat-model-preference";
import { useAuth } from "@/lib/auth-context";
import { useElectron } from "@/lib/electron-context";
import { useProvidersStore, ProviderType } from "@/lib/providers-store";
import { validateApiKey, fetchModels } from "@/lib/openrouter";
import {
  saveProviderApiKey,
  deleteProviderApiKey,
  getAllProviders,
  getProviderApiKey,
} from "@/lib/firestore-providers";
import { deleteFirestoreChat } from "@/lib/firestore-chats";
import {
  IconPlus,
  IconSearch,
  IconMessage,
  IconTrash,
  IconLogin,
  IconLogout,
  IconCheck,
  IconX,
  IconBrandOpenai,
  IconLoader2,
  IconPencil,
  IconPin,
  IconSun,
  IconMoon,
  IconDeviceDesktop,
  IconDotsVertical,
  IconPhoto,
  IconLibrary,
} from "@tabler/icons-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useTheme } from "@/lib/theme-context";
import { useLocalSettingsStore } from "@/lib/local-settings-store";

const PROVIDER_INFO: Record<
  ProviderType,
  { name: string; icon: React.ReactNode; available: boolean }
> = {
  openrouter: {
    name: "OpenRouter",
    icon: <Image src="/openrouter.svg" alt="OpenRouter" width={16} height={16} className="size-4 dark:invert" />,
    available: true,
  },
  openai: {
    name: "OpenAI",
    icon: <IconBrandOpenai className="size-4" />,
    available: false,
  },
  anthropic: {
    name: "Anthropic",
    icon: <Image src="/claude-color.svg" alt="Anthropic" width={16} height={16} className="size-4" />,
    available: false,
  },
  perplexity: {
    name: "Perplexity",
    icon: <Image src="/perplexity-color.svg" alt="Perplexity" width={16} height={16} className="size-4" />,
    available: false,
  },
};

function ChatListIcon({
  pinned,
  isStreaming,
}: {
  pinned?: boolean;
  isStreaming: boolean;
}) {
  return (
    <div className="relative size-4 shrink-0">
      {pinned ? (
        <IconPin
          className={`size-4 absolute inset-0 text-primary transition-all duration-200 ${
            isStreaming ? "opacity-0 scale-75 -rotate-90" : "opacity-100 scale-100 rotate-0"
          }`}
        />
      ) : (
        <IconMessage
          className={`size-4 absolute inset-0 transition-all duration-200 ${
            isStreaming ? "opacity-0 scale-75 -rotate-90" : "opacity-100 scale-100 rotate-0"
          }`}
        />
      )}
      <IconLoader2
        className={`size-4 absolute inset-0 text-primary transition-all duration-200 ${
          isStreaming ? "opacity-100 scale-100 rotate-0 animate-spin" : "opacity-0 scale-75 rotate-90"
        }`}
      />
    </div>
  );
}

export function AppSidebar() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false);
  const [selectedProviderType, setSelectedProviderType] =
    useState<ProviderType | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [deleteChatId, setDeleteChatId] = useState<string | null>(null);
  const [deleteProviderId, setDeleteProviderId] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const sidebarContentRef = useRef<HTMLDivElement>(null);
  const [sidebarScrolled, setSidebarScrolled] = useState(false);

  const syncSidebarScrollState = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    setSidebarScrolled(el.scrollTop > 0.5);
  }, []);

  // Focus the edit input when editingChatId changes
  useEffect(() => {
    if (editingChatId) {
      // Use setTimeout to ensure focus happens after context menu closes
      const timer = setTimeout(() => {
        editInputRef.current?.focus();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [editingChatId]);

  // Global keyboard shortcut for search (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const { chats, activeChatId, streamingChats, createChat, setActiveChat, deleteChat, updateChatTitle, togglePinChat, getChatById } =
    useChatStore();
  const { state, openMobile } = useSidebar();
  const { user, loading, signInWithGoogle, signOut } = useAuth();
  const { providers, addProvider, removeProvider, updateProvider, setSelectedModel } =
    useProvidersStore();
  const { theme, setTheme } = useTheme();
  const { fullWidthChat, setFullWidthChat, showEstimatedCost, setShowEstimatedCost } = useLocalSettingsStore();
  const { isElectron, platform } = useElectron();
  const isMacElectron = isElectron && platform === "darwin";
  const isCollapsed = state === "collapsed";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isOnNewChat = pathname === "/" && !searchParams.get("chatId");

  // Handle selecting a chat - also switches to the model used in the last message
  const handleSelectChat = (e: React.MouseEvent, chatId: string) => {
    e.preventDefault();
    e.stopPropagation();
    // Update state immediately
    setActiveChat(chatId);
    // Use setTimeout to ensure clean navigation without batching issues
    setTimeout(() => router.push("/?chatId=" + chatId), 0);
  };

  // Load providers from Firestore when user logs in
  useEffect(() => {
    async function loadProviders() {
      if (!user) return;

      try {
        const storedProviders = await getAllProviders(user.uid);
        for (const stored of storedProviders) {
          // Check if provider already exists in store
          const exists = providers.find((p) => p.id === stored.id);
          if (!exists) {
            // Add provider first
            addProvider({
              id: stored.id,
              type: stored.type as ProviderType,
              name: stored.name,
              verified: stored.verified,
            });

            // Fetch models for OpenRouter providers
            if (stored.type === "openrouter") {
              try {
                const apiKey = await getProviderApiKey(user.uid, stored.id);
                if (apiKey) {
                  const models = await fetchModels(apiKey);
                  updateProvider(stored.id, {
                    models,
                    modelsLastFetched: Date.now(),
                  });
                }
              } catch (error) {
                console.error("Failed to fetch models for provider:", stored.id, error);
              }
            }
          }
        }
      } catch (error) {
        console.error("Failed to load providers:", error);
      }
    }

    loadProviders();
  }, [user]);

  const filteredChats = useMemo(() => {
    // Sort pinned chats first, then by most recent
    return [...chats].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return 0; // Keep original order (already sorted by updatedAt from Firestore)
    });
  }, [chats]);

  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => {
      syncSidebarScrollState(sidebarContentRef.current);
    });
    return () => cancelAnimationFrame(id);
  }, [syncSidebarScrollState, filteredChats.length, state, openMobile]);

  const handleSidebarContentScroll = (e: React.UIEvent<HTMLDivElement>) => {
    syncSidebarScrollState(e.currentTarget);
  };

  const handleNewChat = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveChat(null);
    // Use setTimeout to ensure clean navigation without batching issues
    setTimeout(() => router.push("/"), 0);
  };

  const handlePromptLibrary = () => {
    setTimeout(() => router.push("/prompts"), 0);
  };

  const handleImages = () => {
    setTimeout(() => router.push("/images"), 0);
  };

  const handleHeaderClick = async () => {
    if (user) {
      setSettingsOpen(true);
    } else {
      await signInWithGoogle();
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setSettingsOpen(false);
  };

  const handleAddProvider = (type: ProviderType) => {
    const info = PROVIDER_INFO[type];
    if (!info.available) {
      toast.info("Coming soon", {
        description: `${info.name} integration is coming soon!`,
      });
      return;
    }

    // Check if provider of this type already exists
    const existingProvider = providers.find((p) => p.type === type);
    if (existingProvider) {
      toast.error("Provider already configured", {
        description: `You already have ${info.name} configured. Remove it first to add a new one.`,
      });
      return;
    }

    setSelectedProviderType(type);
    setApiKeyInput("");
    setApiKeyDialogOpen(true);
  };

  const handleValidateAndSave = async () => {
    if (!selectedProviderType || !apiKeyInput.trim() || !user) return;

    setIsValidating(true);

    try {
      // Validate the API key
      const isValid = await validateApiKey(apiKeyInput);

      if (!isValid) {
        toast.error("Invalid API key", {
          description: "Please check your API key and try again.",
        });
        setIsValidating(false);
        return;
      }

      // Fetch models
      const models = await fetchModels(apiKeyInput);

      // Generate provider ID
      const providerId = `${selectedProviderType}-${Date.now()}`;
      const providerName = PROVIDER_INFO[selectedProviderType].name;

      // Save to Firestore (encrypted)
      await saveProviderApiKey(
        user.uid,
        providerId,
        selectedProviderType,
        providerName,
        apiKeyInput
      );

      // Add to local store
      addProvider({
        id: providerId,
        type: selectedProviderType,
        name: providerName,
        verified: true,
        models,
        modelsLastFetched: Date.now(),
      });

      toast.success("Provider added", {
        description: `${providerName} has been configured successfully.`,
      });

      setApiKeyDialogOpen(false);
      setApiKeyInput("");
      setSelectedProviderType(null);
    } catch (error) {
      toast.error("Failed to add provider", {
        description:
          error instanceof Error ? error.message : "An error occurred",
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleRemoveProvider = async (providerId: string) => {
    if (!user) return;

    try {
      await deleteProviderApiKey(user.uid, providerId);
      removeProvider(providerId);
      toast.success("Provider removed");
    } catch (error) {
      toast.error("Failed to remove provider");
    }
  };

  const renderAccountButton = () => (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          onClick={handleHeaderClick}
          tooltip={user ? "Settings" : "Sign In with Google"}
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground rounded-xl border border-sidebar-border/70 bg-sidebar/95 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-sidebar/80"
        >
          {loading ? (
            <>
              <Skeleton className="size-8 rounded-lg" />
              <div className="grid flex-1 gap-1">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3 w-24" />
              </div>
            </>
          ) : user ? (
            <>
              {user.photoURL ? (
                <Image
                  src={user.photoURL}
                  alt={user.displayName || "User"}
                  width={32}
                  height={32}
                  className="size-8 rounded-lg"
                />
              ) : (
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <span className="text-sm font-bold">
                    {user.displayName?.[0] || user.email?.[0] || "U"}
                  </span>
                </div>
              )}
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">
                  {user.displayName || "User"}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {user.email}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <IconLogin className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">
                  Welcome to LocalChat
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  Click to Sign In
                </span>
              </div>
            </>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );

  return (
    <>
      <Sidebar collapsible="offcanvas" onContextMenu={(e) => e.preventDefault()}>
        <div className="relative flex min-h-0 flex-1 flex-col">
          {isMacElectron && (
            <SidebarHeader
              className="px-2 py-1"
              onContextMenu={(e) => e.preventDefault()}
              style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
            >
              {/* Draggable area with window controls for macOS Electron */}
              <div className="flex items-center h-10 pl-[18px] pt-[6px] -mx-2 -mt-1 mb-[-6px]">
                <div
                  className="z-50"
                  style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                >
                  <WindowControls />
                </div>
              </div>
            </SidebarHeader>
          )}

          <SidebarContent
            ref={sidebarContentRef}
            onScroll={handleSidebarContentScroll}
            onContextMenu={(e) => e.preventDefault()}
          >
          {/* Sticky: New Chat + Search Chats */}
          <div
            className={`sticky top-0 z-20 w-full min-w-0 shrink-0 border-b-[0.5px] bg-sidebar pb-1 shadow-header-scroll transition-[box-shadow,border-color] duration-300 ease-out ${
              sidebarScrolled
                ? "border-[oklch(0.86_0_0)] dark:border-sidebar-border shadow-header-scroll-on"
                : "border-transparent"
            }`}
          >
            <SidebarGroup className="px-2 py-0">
              <SidebarGroupContent>
                <SidebarMenu>
                  <h1 className="text-xl font-bold ml-1 ">LocalChat</h1>
                  {/* New Chat Button */}
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={handleNewChat}
                      isActive={isOnNewChat}
                      tooltip="New Chat"
                      className="mb-1 mt-1.5 rounded-lg shadow-none active:scale-[0.98] dark:hover:border-muted-foreground/45 dark:hover:bg-input/30 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                    >
                      <IconPlus className="size-4" />
                      <span className="flex-1">New Chat</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  {/* Search Button */}
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => setSearchOpen(true)}
                      tooltip="Search Chats (⌘K)"
                      className="mb-1 rounded-lg shadow-none active:scale-[0.98] dark:hover:border-muted-foreground/45 dark:hover:bg-input/30 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                    >
                      <IconSearch className="size-4" />
                      <span className="flex-1">Search Chats</span>
                      {!isCollapsed && (
                        <KbdGroup>
                          <Kbd>⌘</Kbd>
                          <Kbd>K</Kbd>
                        </KbdGroup>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup className="px-2 py-0">
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={handleImages}
                      isActive={pathname === "/images"}
                      tooltip="Images"
                      className="mb-1 rounded-lg shadow-none active:scale-[0.98] dark:hover:border-muted-foreground/45 dark:hover:bg-input/30 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                    >
                      <IconPhoto className="size-4" />
                      <span className="flex-1">Images</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={handlePromptLibrary}
                      isActive={pathname === "/prompts"}
                      tooltip="Prompt Library"
                      className="mb-1 rounded-lg shadow-none active:scale-[0.98] dark:hover:border-muted-foreground/45 dark:hover:bg-input/30 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                    >
                      <IconLibrary className="size-4" />
                      <span className="flex-1">Prompt Library</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </div>

          {/* Chat List */}
          <SidebarGroup className="group-data-[collapsible=icon]:hidden flex-1 px-2 py-0 pb-28" onContextMenu={(e) => e.stopPropagation()}>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredChats.length === 0 ? (
                  <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                    No chats yet
                  </p>
                ) : (
                  filteredChats.map((chat) => {
                    const isChatStreaming = !!streamingChats[chat.id];

	                    return (
	                      <ContextMenu key={chat.id}>
	                        <ContextMenuTrigger asChild>
	                          <SidebarMenuItem>
	                            {editingChatId === chat.id ? (
	                              <SidebarMenuButton
	                                isActive={activeChatId === chat.id}
	                                className="cursor-default hover:bg-transparent mb-1"
	                              >
	                                <ChatListIcon pinned={chat.pinned} isStreaming={isChatStreaming} />
	                                <input
	                                  ref={editInputRef}
	                                  value={editingTitle}
                                  onChange={(e) => setEditingTitle(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      updateChatTitle(chat.id, editingTitle);
                                      setEditingChatId(null);
                                    } else if (e.key === "Escape") {
                                      setEditingChatId(null);
                                    }
                                  }}
                                  className="flex-1 bg-transparent border-none outline-none text-sm min-w-0"
                                />
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateChatTitle(chat.id, editingTitle);
                                    setEditingChatId(null);
                                  }}
                                  className="size-5 flex items-center justify-center rounded hover:bg-sidebar-accent shrink-0"
                                >
                                  <IconCheck className="size-4 text-green-600" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingChatId(null);
                                  }}
                                  className="size-5 flex items-center justify-center rounded hover:bg-sidebar-accent shrink-0"
                                >
                                  <IconX className="size-4 text-muted-foreground" />
                                </button>
                              </SidebarMenuButton>
                            ) : (
                              <>
	                                <SidebarMenuButton
	                                  isActive={activeChatId === chat.id}
	                                  onClick={(e) => handleSelectChat(e, chat.id)}
	                                  tooltip={chat.title}
	                                  className="mb-1"
	                                >
	                                  <ChatListIcon pinned={chat.pinned} isStreaming={isChatStreaming} />
	                                  <span className="flex-1 truncate">{chat.title}</span>
	                                </SidebarMenuButton>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <SidebarMenuAction showOnHover>
                                      <IconDotsVertical className="size-4" />
                                    </SidebarMenuAction>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent side="right" align="start" className="min-w-40">
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setEditingChatId(chat.id);
                                        setEditingTitle(chat.title);
                                      }}
                                    >
                                      <IconPencil className="size-4 mr-2" />
                                      Edit chat title
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => togglePinChat(chat.id)}
                                    >
                                      <IconPin className="size-4 mr-2" />
                                      {chat.pinned ? "Unpin chat" : "Pin chat"}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      variant="destructive"
                                      onClick={() => setDeleteChatId(chat.id)}
                                    >
                                      <IconTrash className="size-4 mr-2" />
                                      Delete chat
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </>
                            )}
                          </SidebarMenuItem>
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                          <ContextMenuItem
                            onClick={() => {
                              setEditingChatId(chat.id);
                              setEditingTitle(chat.title);
                            }}
                          >
                            <IconPencil className="size-4 mr-2" />
                            Edit chat title
                          </ContextMenuItem>
                          <ContextMenuItem
                            onClick={() => togglePinChat(chat.id)}
                          >
                            <IconPin className="size-4 mr-2" />
                            {chat.pinned ? "Unpin chat" : "Pin chat"}
                          </ContextMenuItem>
                          <ContextMenuItem
                            variant="destructive"
                            onClick={() => setDeleteChatId(chat.id)}
                          >
                            <IconTrash className="size-4 mr-2" />
                            Delete chat
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    );
                  })
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          </SidebarContent>

          <div className="pointer-events-none absolute inset-x-2 bottom-2 z-30">
            <div className="pointer-events-auto rounded-2xl bg-gradient-to-t from-sidebar via-sidebar/95 to-transparent pt-8">
              {renderAccountButton()}
            </div>
          </div>
        </div>
      </Sidebar>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>
              Manage your account and preferences
            </DialogDescription>
          </DialogHeader>

          {user && (
            <div className="space-y-6">
              {/* User Profile Section */}
              <div className="flex items-center gap-4">
                {user.photoURL ? (
                  <Image
                    src={user.photoURL}
                    alt={user.displayName || "User"}
                    width={48}
                    height={48}
                    className="size-12 rounded-full"
                  />
                ) : (
                  <div className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <span className="text-lg font-bold">
                      {user.displayName?.[0] || user.email?.[0] || "U"}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {user.displayName || "User"}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    {user.email}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Providers Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Providers
                  </h3>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1">
                        <IconPlus className="size-3" />
                        Add
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      {(
                        Object.entries(PROVIDER_INFO) as [
                          ProviderType,
                          (typeof PROVIDER_INFO)[ProviderType]
                        ][]
                      ).map(([type, info]) => {
                        const isConfigured = providers.some((p) => p.type === type);
                        return (
                          <DropdownMenuItem
                            key={type}
                            onClick={() => handleAddProvider(type)}
                            className="gap-2"
                            disabled={isConfigured || !info.available}
                          >
                            {info.icon}
                            {info.name}
                            {isConfigured ? (
                              <Badge variant="secondary" className="ml-auto text-xs">
                                Added
                              </Badge>
                            ) : !info.available ? (
                              <Badge variant="secondary" className="ml-auto text-xs">
                                Soon
                              </Badge>
                            ) : null}
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {providers.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    No providers configured. Add one to start chatting.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {providers.map((provider) => (
                      <div
                        key={provider.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div className="flex items-center gap-2">
                          {PROVIDER_INFO[provider.type]?.icon}
                          <span className="text-sm font-medium">
                            {provider.name}
                          </span>
                          {provider.verified && (
                            <Badge
                              variant="secondary"
                              className="gap-1 bg-primary/10 text-primary"
                            >
                              <IconCheck className="size-3" />
                              Verified
                            </Badge>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setDeleteProviderId(provider.id)}
                        >
                          <IconTrash className="size-4 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Appearance Section */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Appearance
                </h3>
                <div className="relative flex items-center p-1 rounded-lg bg-background border">
                  {/* Sliding indicator */}
                  <div
                    className="absolute top-1 bottom-1 rounded-md bg-primary transition-all duration-300 ease-out"
                    style={{
                      left: theme === "light" ? "4px" : theme === "dark" ? "calc(33.33% + 2px)" : "calc(66.66% + 0px)",
                      width: "calc(33.33% - 4px)",
                    }}
                  />
                  <button
                    onClick={() => setTheme("light")}
                    className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 py-1.5 text-sm font-medium rounded-md transition-colors duration-200 ${
                      theme === "light" ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <IconSun className="size-4" />
                    Light
                  </button>
                  <button
                    onClick={() => setTheme("dark")}
                    className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 py-1.5 text-sm font-medium rounded-md transition-colors duration-200 ${
                      theme === "dark" ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <IconMoon className="size-4" />
                    Dark
                  </button>
                  <button
                    onClick={() => setTheme("system")}
                    className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 py-1.5 text-sm font-medium rounded-md transition-colors duration-200 ${
                      theme === "system" ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <IconDeviceDesktop className="size-4" />
                    System
                  </button>
                </div>

                {/* Full-width Chat Toggle */}
                <div className="flex items-center justify-between py-1">
                  <div className="space-y-0.5">
                    <label htmlFor="full-width-chat" className="text-sm font-medium cursor-pointer">
                      Full-width Chat
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Remove width constraint on chat messages
                    </p>
                  </div>
                  <Switch
                    id="full-width-chat"
                    checked={fullWidthChat}
                    onCheckedChange={setFullWidthChat}
                  />
                </div>

                {/* Show Estimated Cost Toggle */}
                <div className="flex items-center justify-between py-1">
                  <div className="space-y-0.5">
                    <label htmlFor="show-estimated-cost" className="text-sm font-medium cursor-pointer">
                      Show estimated message cost
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Show the estimated cost under each message
                    </p>
                  </div>
                  <Switch
                    id="show-estimated-cost"
                    checked={showEstimatedCost}
                    onCheckedChange={setShowEstimatedCost}
                  />
                </div>
              </div>

              <Separator />

              {/* Account Section */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Account
                </h3>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 text-destructive hover:text-destructive"
                  onClick={handleSignOut}
                >
                  <IconLogout className="size-4" />
                  Sign Out
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* API Key Dialog */}
      <Dialog open={apiKeyDialogOpen} onOpenChange={setApiKeyDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Add {selectedProviderType && PROVIDER_INFO[selectedProviderType]?.name}
            </DialogTitle>
            <DialogDescription>
              Enter your API key to connect this provider.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Input
              type="password"
              placeholder="sk-or-..."
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleValidateAndSave();
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setApiKeyDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleValidateAndSave}
                disabled={!apiKeyInput.trim() || isValidating}
              >
                {isValidating ? (
                  <>
                    <IconLoader2 className="size-4 animate-spin" />
                    Validating...
                  </>
                ) : (
                  "Add Provider"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Chat Confirmation Dialog */}
      <AlertDialog open={!!deleteChatId} onOpenChange={(open) => !open && setDeleteChatId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete chat?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the chat and all its messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                if (deleteChatId) {
                  deleteChat(deleteChatId);
                  if (user) {
                    try {
                      await deleteFirestoreChat(user.uid, deleteChatId);
                    } catch (error) {
                      console.error("Failed to delete chat from Firestore:", error);
                    }
                  }
                  toast.success("Chat deleted", {
                    icon: <IconTrash className="size-4 text-red-500" />,
                  });
                }
                setDeleteChatId(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Provider Confirmation Dialog */}
      <AlertDialog open={!!deleteProviderId} onOpenChange={(open) => !open && setDeleteProviderId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove provider?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the API key and disconnect this provider. You can add it again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                if (deleteProviderId) {
                  await handleRemoveProvider(deleteProviderId);
                }
                setDeleteProviderId(null);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Search Modal */}
      <SearchModal open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
