"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Image from "next/image";
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
import { WindowControls } from "@/components/window-controls";
import { useChatStore } from "@/lib/chat-store";
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

  const { chats, activeChatId, createChat, setActiveChat, deleteChat, updateChatTitle, togglePinChat, getChatById } =
    useChatStore();
  const { state } = useSidebar();
  const { user, loading, signInWithGoogle, signOut } = useAuth();
  const { providers, addProvider, removeProvider, updateProvider, setSelectedModel } =
    useProvidersStore();
  const { theme, setTheme } = useTheme();
  const { fullWidthChat, setFullWidthChat } = useLocalSettingsStore();
  const { isElectron, platform } = useElectron();
  const isMacElectron = isElectron && platform === "darwin";
  const isCollapsed = state === "collapsed";

  // Handle selecting a chat - also switches to the model used in the last message
  const handleSelectChat = (chatId: string) => {
    const chat = getChatById(chatId);
    if (chat) {
      // Find the last assistant message with a modelId
      const lastAssistantMessage = [...chat.messages]
        .reverse()
        .find((m) => m.role === "assistant" && m.modelId);

      if (lastAssistantMessage?.modelId) {
        // Find the provider that has this model
        const provider = providers.find((p) =>
          p.models?.some((m) => m.id === lastAssistantMessage.modelId)
        );
        if (provider) {
          setSelectedModel(provider.id, lastAssistantMessage.modelId);
        }
      }
    }
    setActiveChat(chatId);
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

  const handleNewChat = () => {
    // Just navigate to empty state (no active chat)
    // A new chat will be created when the first message is sent
    setActiveChat(null);
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

  return (
    <>
      <Sidebar collapsible="offcanvas" onContextMenu={(e) => e.preventDefault()}>
        <SidebarHeader
          className="px-2 py-1"
          onContextMenu={(e) => e.preventDefault()}
          style={{ WebkitAppRegion: isMacElectron ? "drag" : undefined } as React.CSSProperties}
        >
          {/* Draggable area with window controls for macOS Electron */}
          {isMacElectron && (
            <div className="flex items-center h-10 pl-[18px] pt-[6px] -mx-2 -mt-1 mb-[-6px]">
              <div
                className="z-50"
                style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
              >
                <WindowControls />
              </div>
            </div>
          )}
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                onClick={handleHeaderClick}
                tooltip={user ? "Settings" : "Sign In with Google"}
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
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
        </SidebarHeader>

        <SidebarContent onContextMenu={(e) => e.preventDefault()}>
          <SidebarGroup className="px-2 py-0">
            <SidebarGroupContent>
              <SidebarMenu>
                {/* New Chat Button */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={handleNewChat}
                    tooltip="New Chat"
                    className={"bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground mb-1"}
                  >
                    <IconPlus className="size-4" />
                    <span>New Chat</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup className="px-2 py-0">
            <SidebarGroupContent>
              <SidebarMenu>
                {/* Search Button */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => setSearchOpen(true)}
                    tooltip="Search Chats (⌘K)"
                    className="text-muted-foreground hover:text-foreground mb-1"
                  >
                    <IconSearch className="size-4" />
                    <span className="flex-1">Search Chats</span>
                    {!isCollapsed && (
                      <kbd className="hidden sm:inline-flex px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono text-muted-foreground">
                        ⌘K
                      </kbd>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Chat List */}
          <SidebarGroup className="group-data-[collapsible=icon]:hidden flex-1 px-2 py-0" onContextMenu={(e) => e.stopPropagation()}>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredChats.length === 0 ? (
                  <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                    No chats yet
                  </p>
                ) : (
                  filteredChats.map((chat) => (
                    <ContextMenu key={chat.id}>
                      <ContextMenuTrigger asChild>
                        <SidebarMenuItem>
                          {editingChatId === chat.id ? (
                            <SidebarMenuButton
                              isActive={activeChatId === chat.id}
                              className="cursor-default hover:bg-transparent mb-1"
                            >
                              {chat.pinned ? (
                                <IconPin className="size-4 text-primary shrink-0" />
                              ) : (
                                <IconMessage className="size-4 shrink-0" />
                              )}
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
                                onClick={() => handleSelectChat(chat.id)}
                                tooltip={chat.title}
                                className="mb-1"
                              >
                                {chat.pinned ? (
                                  <IconPin className="size-4 text-primary" />
                                ) : (
                                  <IconMessage className="size-4" />
                                )}
                                <span>{chat.title}</span>
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
                  ))
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
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
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Appearance
                </h3>
                <div className="flex items-center gap-1 p-1 rounded-lg bg-muted">
                  <Button
                    variant={theme === "light" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setTheme("light")}
                    className="flex-1 gap-1.5"
                  >
                    <IconSun className="size-4" />
                    Light
                  </Button>
                  <Button
                    variant={theme === "dark" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setTheme("dark")}
                    className="flex-1 gap-1.5"
                  >
                    <IconMoon className="size-4" />
                    Dark
                  </Button>
                  <Button
                    variant={theme === "system" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setTheme("system")}
                    className="flex-1 gap-1.5"
                  >
                    <IconDeviceDesktop className="size-4" />
                    System
                  </Button>
                </div>

                {/* Full-width Chat Toggle */}
                <div className="flex items-center justify-between rounded-lg border p-3">
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
