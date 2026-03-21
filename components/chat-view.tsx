"use client";

import { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback, memo, createContext, useContext, FormEvent, KeyboardEvent, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Kbd } from "@/components/ui/kbd";
import { TitleBar } from "@/components/title-bar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChatStore, Message, UrlCitation, StreamingStatus } from "@/lib/chat-store";
import { useProvidersStore } from "@/lib/providers-store";
import { parseModelName, ProviderIcon, ModelProvider } from "@/components/model-picker";
import { ModelPicker } from "@/components/model-picker";
import { useAuth } from "@/lib/auth-context";
import { getProviderApiKey } from "@/lib/firestore-providers";
import { streamChat, ChatMessage } from "@/lib/openrouter";
import { useScroll } from "@/lib/scroll-context";
import { useLocalSettingsStore } from "@/lib/local-settings-store";
import { toast } from "sonner";
import ReactMarkdown, { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  IconArrowUp,
  IconMessagePlus,
  IconPlus,
  IconWorld,
  IconBulb,
  IconSparkles,
  IconPhoto,
  IconDots,
  IconCopy,
  IconCut,
  IconClipboard,
  IconCheck,
  IconRefresh,
  IconTrash,
  IconPencil,
  IconQuote,
  IconChevronDown,
  IconChevronRight,
  IconSearch,
  IconAlertTriangle,
  IconPlayerStopFilled,
  IconInfoCircle,
  IconCoins,
  IconExternalLink,
} from "@tabler/icons-react";
import {
  estimateTokenCount,
  calculateCost,
  formatCost,
} from "@/lib/token-utils";
import { MessageInfoDialog } from "@/components/message-info-dialog";

// Wrapper that runs fade-in-up animation on mount (Web Animations API so it always runs)
const MessageEnterWrapper = memo(function MessageEnterWrapper({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const anim = el.animate(
      [
        { opacity: 0, transform: "translateY(16px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      {
        duration: 400,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "forwards",
      }
    );
    // Clear inline style after animation so it doesn't override final state
    anim.finished.then(() => {
      el.style.opacity = "";
      el.style.transform = "";
    });
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{ opacity: 0, transform: "translateY(16px)" }}
    >
      {children}
    </div>
  );
});

// Code block component with copy button and syntax highlighting
const CodeBlock = memo(function CodeBlock({ children, className, ...props }: { children?: ReactNode; className?: string }) {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLDivElement>(null);

  // Extract language from className (format: "language-xxx")
  const match = /language-(\w+)/.exec(className || "");
  const language = match ? match[1] : "";

  // Get the code content as string
  const codeString = String(children).replace(/\n$/, "");

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(codeString);
    setCopied(true);
    toast.success("Code copied successfully", {
      icon: <IconCopy className="size-4 text-green-500" />,
    });
    setTimeout(() => setCopied(false), 2000);
  }, [codeString]);

  return (
    <div className="group relative my-4 min-w-0 max-w-full w-full" ref={codeRef}>
      {/* Sticky copy button - visible on hover, sticks to top when scrolling */}
      <div className="sticky top-[-2px] z-10 flex justify-end pointer-events-none h-0">
        <button
          onClick={handleCopy}
          className="pointer-events-auto size-8 flex items-center justify-center rounded-md bg-background/90 border border-border opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100 transition-all duration-300 ease-out hover:bg-muted mt-2 mr-2"
          aria-label="Copy code"
        >
          <div className="relative size-4">
            <IconCopy
              className={`size-4 absolute inset-0 transition-all duration-200 ease-out ${copied ? "opacity-0 scale-50 rotate-90" : "opacity-100 scale-100 rotate-0"
                }`}
            />
            <IconCheck
              className={`size-4 absolute inset-0 transition-all duration-200 ease-out ${copied ? "opacity-100 scale-100 rotate-0 text-primary" : "opacity-0 scale-50 -rotate-90"
                }`}
            />
          </div>
        </button>
      </div>

      {/* Code block with inline language label */}
      <div className="relative rounded-lg border border-border overflow-hidden">
        {/* Inline language label - positioned inside the code block */}
        {language && (
          <span className="absolute top-2 left-3 text-[11px] text-muted-foreground/60 font-mono select-none z-10">
            {language}
          </span>
        )}
        <div className="overflow-x-auto">
          <SyntaxHighlighter
            style={oneDark}
            language={language || "text"}
            PreTag="div"
            customStyle={{
              margin: 0,
              borderRadius: 0,
              border: "none",
              fontSize: "0.875rem",
              paddingTop: language ? "2rem" : "0.65rem",
              paddingBottom: "0.75rem",
              minWidth: "100%",
              width: "fit-content",
            }}
            {...props}
          >
            {codeString}
          </SyntaxHighlighter>
        </div>
      </div>
    </div>
  );
});

// Citation context for passing annotation data to markdown link components
const CitationContext = createContext<Map<string, { index: number; citation: UrlCitation }>>(new Map());

function getFaviconUrl(url: string): string {
  try {
    const domain = new URL(url).hostname.replace("www.", "");
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return "";
  }
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

// Small numbered circle for inline citations
const CitationBadge = memo(function CitationBadge({ index, citation }: { index: number; citation: UrlCitation }) {
  const domain = getDomain(citation.url);
  const faviconUrl = getFaviconUrl(citation.url);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <a
          href={citation.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center size-[18px] rounded-full bg-primary/10 text-primary text-[10px] font-semibold hover:bg-primary/20 transition-colors cursor-pointer align-super ml-0.5 no-underline"
          onClick={(e) => e.stopPropagation()}
        >
          {index}
        </a>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs p-2.5">
        <div className="flex items-start gap-2.5">
          <img src={faviconUrl} alt="" className="size-4 rounded-sm mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="font-medium text-xs truncate">{citation.title || domain}</p>
            <p className="text-[10px] opacity-70 truncate">{domain}</p>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
});

// Stacked favicon sources button for AI messages
const SourcesButton = memo(function SourcesButton({
  annotations,
  onOpen,
}: {
  annotations: UrlCitation[];
  onOpen: () => void;
}) {
  const uniqueCitations = useMemo(() => {
    const seen = new Set<string>();
    return annotations.filter((a) => {
      if (seen.has(a.url)) return false;
      seen.add(a.url);
      return true;
    });
  }, [annotations]);

  const displayCitations = uniqueCitations.slice(0, 3);

  if (displayCitations.length === 0) return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onOpen}
      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground rounded-xl active:scale-95 transition-all duration-200 gap-1.5"
    >
      <div className="flex items-center -space-x-1.5">
        {displayCitations.map((citation, i) => (
          <div
            key={citation.url}
            className="size-[18px] rounded-full border-2 border-background bg-muted overflow-hidden"
            style={{ zIndex: displayCitations.length - i }}
          >
            <img src={getFaviconUrl(citation.url)} alt="" className="size-full object-cover" />
          </div>
        ))}
      </div>
      Sources
    </Button>
  );
});

// Modal listing all sources
function SourcesModal({
  open,
  onOpenChange,
  annotations,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  annotations: UrlCitation[];
}) {
  const uniqueCitations = useMemo(() => {
    const seen = new Set<string>();
    const result: (UrlCitation & { index: number })[] = [];
    annotations.forEach((a) => {
      if (!seen.has(a.url)) {
        seen.add(a.url);
        result.push({ ...a, index: result.length + 1 });
      }
    });
    return result;
  }, [annotations]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sources</DialogTitle>
          <DialogDescription>
            {uniqueCitations.length} source{uniqueCitations.length !== 1 ? "s" : ""} referenced in this response
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1 max-h-80 overflow-y-auto -mx-1">
          {uniqueCitations.map((citation) => {
            const domain = getDomain(citation.url);
            const faviconUrl = getFaviconUrl(citation.url);
            return (
              <a
                key={citation.url}
                href={citation.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors group"
              >
                <span className="flex items-center justify-center size-6 rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0">
                  {citation.index}
                </span>
                <img src={faviconUrl} alt="" className="size-4 rounded-sm shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                    {citation.title || domain}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{domain}</p>
                </div>
                <IconExternalLink className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </a>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Expandable thinking/reasoning block with live timer
const ENTER_KEYFRAMES: Keyframe[] = [
  { opacity: 0, filter: 'blur(5px)', transform: 'translateY(6px)' },
  { opacity: 1, filter: 'blur(0px)', transform: 'translateY(0)' },
];
const ENTER_OPTIONS: KeyframeAnimationOptions = {
  duration: 260,
  easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
  fill: 'forwards',
};
// Exit: fade + blur in place, no positional movement
const EXIT_KEYFRAMES: Keyframe[] = [
  { opacity: 1, filter: 'blur(0px)' },
  { opacity: 0, filter: 'blur(4px)' },
];
const EXIT_OPTIONS: KeyframeAnimationOptions = {
  duration: 140,
  easing: 'ease-in',
  fill: 'forwards',
};

/**
 * useLayoutEffect runs synchronously after React commits to the DOM but BEFORE
 * the browser paints. This means setting opacity: 0 here never causes a visible
 * flash — unlike useEffect which runs after paint.
 */
function useEnterAnimation(animate: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!animate) return; // historical message — appear instantly, no animation
    const el = ref.current;
    if (!el) return;
    el.style.opacity = '0';
    const anim = el.animate(ENTER_KEYFRAMES, ENTER_OPTIONS);
    anim.finished.then(() => {
      el.style.opacity = '';
      el.style.filter = '';
      el.style.transform = '';
    }).catch(() => {});
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps
  return ref;
}

/**
 * Manages enter/exit animations for mutually-exclusive status slots.
 *
 * - First appearance (null → key): shown instantly, no animation, because
 *   the containing message bubble already slides in.
 * - Transition (key → key): old content blurs up & out, new content blurs in.
 * - Disappear (key → null): content blurs up & out, then unmounts.
 *
 * Uses useLayoutEffect for the enter so opacity is forced to 0 before the
 * browser paints, eliminating the "flash then animate" artifact.
 */
function FadeSlot({ slotKey, children }: { slotKey: string | null; children: ReactNode }) {
  // Initialize immediately from slotKey so first appearance needs no animation
  const [shown, setShown] = useState<{ key: string; content: ReactNode } | null>(
    slotKey ? { key: slotKey, content: children } : null
  );
  const ref = useRef<HTMLDivElement>(null);
  const activeAnim = useRef<Animation | null>(null);
  // Initialized to slotKey so the layoutEffect skips animating the first render
  const prevSlotKey = useRef<string | null>(slotKey);
  // Signal from the regular effect to the layout effect: "play enter on next commit"
  const pendingEnter = useRef(false);

  // Respond to slotKey changes: play exit on old content, then swap content.
  // useLayoutEffect so height collapse happens before the browser paints —
  // this prevents the sibling ThinkingBlock from starting its enter animation
  // at the wrong Y position and then jumping when FadeSlot unmounts.
  useLayoutEffect(() => {
    if (slotKey === prevSlotKey.current) return;
    const prev = prevSlotKey.current;
    prevSlotKey.current = slotKey;
    const el = ref.current;

    const swap = (withEnter: boolean) => {
      pendingEnter.current = withEnter && !!slotKey;
      // Restore height so the new content renders normally
      if (el) { el.style.height = ''; el.style.overflow = ''; }
      if (!slotKey) { setShown(null); return; }
      setShown({ key: slotKey, content: children });
    };

    if (prev && el) {
      // Collapse layout height to 0 immediately (before paint) so the next
      // sibling (ThinkingBlock) renders at the correct Y position right away.
      // overflow:visible lets the content still be seen fading out as an overlay.
      el.style.height = '0';
      el.style.overflow = 'visible';

      activeAnim.current?.cancel();
      activeAnim.current = el.animate(EXIT_KEYFRAMES, EXIT_OPTIONS);
      activeAnim.current.finished.then(() => swap(true)).catch(() => swap(true));
    } else {
      // First appearance: show instantly (slides in with the message bubble)
      swap(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotKey]);

  // Play enter animation synchronously before the browser paints the new content
  useLayoutEffect(() => {
    if (!shown || !pendingEnter.current) return;
    pendingEnter.current = false;
    const el = ref.current;
    if (!el) return;
    activeAnim.current?.cancel();
    el.style.opacity = '0'; // hide before first paint — no flash
    activeAnim.current = el.animate(ENTER_KEYFRAMES, ENTER_OPTIONS);
    activeAnim.current.finished
      .then(() => { if (el) { el.style.opacity = ''; el.style.filter = ''; el.style.transform = ''; } })
      .catch(() => {});
  }, [shown?.key]);

  if (!shown) return null;

  return <div ref={ref}>{shown.content}</div>;
}

const ThinkingBlock = memo(function ThinkingBlock({
  reasoning,
  isThinking,
  thinkingDuration,
  thinkingStartTime,
  animateIn,
}: {
  reasoning: string;
  isThinking: boolean;
  thinkingDuration?: number;
  thinkingStartTime: number | null;
  animateIn: boolean;
}) {
  const containerRef = useEnterAnimation(animateIn);
  const [expanded, setExpanded] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isThinking || !thinkingStartTime) return;
    const update = () => setElapsed(Math.floor((Date.now() - thinkingStartTime) / 1000));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [isThinking, thinkingStartTime]);

  const seconds = isThinking ? elapsed : (thinkingDuration ?? 0);

  const formatTime = (s: number) => {
    if (s < 1) return '';
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const rem = s % 60;
    if (rem === 0) return `${m}min`;
    return `${m}min and ${rem}s`;
  };

  const timeStr = formatTime(seconds);
  const label = isThinking
    ? timeStr ? `Thinking for ${timeStr}...` : 'Thinking...'
    : `Thought for ${timeStr || '< 1s'}`;

  return (
    <div ref={containerRef} className="mb-2">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="group/think flex h-6 items-center gap-1.5 cursor-pointer select-none bg-transparent p-0 border-0"
      >
        {isThinking ? (
          <span className="unified-shimmer-text text-sm">{label}</span>
        ) : (
          <span className="text-sm text-muted-foreground">{label}</span>
        )}
        <IconChevronRight
          className={`size-3.5 transition-all duration-200 ${
            expanded ? 'rotate-90 opacity-100' : 'opacity-0 group-hover/think:opacity-100'
          } ${isThinking ? 'shimmer-icon' : 'text-muted-foreground'}`}
        />
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <div className="mt-2 ml-5 text-sm text-muted-foreground/80 border-l-2 border-border pl-3 whitespace-pre-wrap select-text max-h-96 overflow-y-auto">
            {reasoning || (isThinking ? '' : 'No reasoning content available.')}
          </div>
        </div>
      </div>
    </div>
  );
});

// Status line for connecting/searching phases — animation is owned by FadeSlot wrapper
function StreamingStatusLine({ status }: { status: StreamingStatus }) {
  const text =
    status === 'connecting' ? 'Connecting to OpenRouter...'
    : status === 'searching' ? 'Searching the web...'
    : null;

  if (!text) return null;

  return (
    <div className="mb-2 select-none flex h-6 items-center">
      <span className="unified-shimmer-text text-sm">{text}</span>
    </div>
  );
}

// Custom markdown components with shadcn styling
const markdownComponents: Components = {
  // Heading components
  h1: ({ children, ...props }) => (
    <h1 className="text-2xl font-bold mt-6 mb-4 first:mt-0" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="text-xl font-bold mt-5 mb-3 first:mt-0" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="text-lg font-semibold mt-4 mb-2 first:mt-0" {...props}>
      {children}
    </h3>
  ),
  h4: ({ children, ...props }) => (
    <h4 className="text-base font-semibold mt-4 mb-2 first:mt-0" {...props}>
      {children}
    </h4>
  ),
  h5: ({ children, ...props }) => (
    <h5 className="text-sm font-semibold mt-3 mb-1 first:mt-0" {...props}>
      {children}
    </h5>
  ),
  h6: ({ children, ...props }) => (
    <h6 className="text-sm font-medium mt-3 mb-1 first:mt-0" {...props}>
      {children}
    </h6>
  ),
  // Paragraph component
  p: ({ children, ...props }) => (
    <p className="my-3 first:mt-0 last:mb-0" {...props}>
      {children}
    </p>
  ),
  // List components
  ul: ({ children, ...props }) => (
    <ul className="my-3 ml-6 list-disc first:mt-0 last:mb-0" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="my-3 ml-6 list-decimal first:mt-0 last:mb-0" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li className="mt-1" {...props}>
      {children}
    </li>
  ),
  // Blockquote component
  blockquote: ({ children, ...props }) => (
    <blockquote className="my-3 border-l-4 border-muted-foreground/30 pl-4 italic first:mt-0 last:mb-0" {...props}>
      {children}
    </blockquote>
  ),
  // Horizontal rule
  hr: ({ ...props }) => (
    <hr className="my-4 border-border" {...props} />
  ),
  // Table components
  table: ({ children, ...props }) => (
    <div className="my-4 w-full overflow-auto rounded-lg border border-border">
      <table className="w-full caption-bottom text-sm" {...props}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }) => (
    <thead className="bg-muted/50 [&_tr]:border-b" {...props}>
      {children}
    </thead>
  ),
  tbody: ({ children, ...props }) => (
    <tbody className="[&_tr:last-child]:border-0" {...props}>
      {children}
    </tbody>
  ),
  tr: ({ children, ...props }) => (
    <tr className="border-b border-border transition-colors hover:bg-muted/50" {...props}>
      {children}
    </tr>
  ),
  th: ({ children, ...props }) => (
    <th className="h-10 px-3 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0" {...props}>
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td className="p-3 align-middle [&:has([role=checkbox])]:pr-0" {...props}>
      {children}
    </td>
  ),
  // Code block - just pass through, the code component handles syntax highlighting
  pre: ({ children }) => <>{children}</>,
  // Code component - handles both inline code and code blocks with syntax highlighting
  code: ({ children, className, ...props }) => {
    // Check if this is a code block (has language class) or inline code
    const isCodeBlock = className?.includes("language-") || (props.node?.position && String(children).includes('\n'));

    if (isCodeBlock) {
      return (
        <CodeBlock className={className} {...props}>
          {children}
        </CodeBlock>
      );
    }

    // Inline code styling
    return (
      <code className="rounded-md bg-muted px-1.5 py-0.5 text-sm font-mono text-foreground" {...props}>
        {children}
      </code>
    );
  },
  // Link component - handle anchor links, citations, and external links
  a: ({ children, href, ...props }) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const citationMap = useContext(CitationContext);

    // Check if this link matches a citation
    if (href && citationMap.size > 0) {
      const citation = citationMap.get(href);
      if (citation) {
        return <CitationBadge index={citation.index} citation={citation.citation} />;
      }
    }

    // Check if this is an anchor link (footnote)
    if (href?.startsWith("#")) {
      return (
        <a
          href={href}
          className="text-primary underline underline-offset-2 hover:text-primary/80"
          onClick={(e) => {
            e.preventDefault();
            const targetId = href.slice(1);
            const targetElement = document.getElementById(targetId);
            if (targetElement) {
              const scrollContainer = targetElement.closest('.flex-1.overflow-y-auto');
              if (scrollContainer) {
                const containerRect = scrollContainer.getBoundingClientRect();
                const targetRect = targetElement.getBoundingClientRect();
                const inputOffset = 120;
                const relativeTop = targetRect.top - containerRect.top + scrollContainer.scrollTop;
                const scrollTo = relativeTop - containerRect.height + inputOffset + targetRect.height;
                scrollContainer.scrollTo({ top: Math.max(0, scrollTo), behavior: "smooth" });
              } else {
                targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
              }
            }
          }}
          {...props}
        >
          {children}
        </a>
      );
    }

    // External links - open in new tab
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline underline-offset-2 hover:text-primary/80"
        {...props}
      >
        {children}
      </a>
    );
  },
};

// Props interface for MessageBubble (defined separately for memo)
interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
  streamingStatus?: StreamingStatus;
  thinkingStartTime?: number | null;
  isEditing?: boolean;
  editingContent?: string;
  onEditStart?: () => void;
  onEditChange?: (content: string) => void;
  onEditSave?: () => void;
  onEditCancel?: () => void;
  onDelete?: () => void;
  onRegenerate?: () => void;
  onRegenerateWithModel?: (modelId: string) => void;
  onReference?: (text: string) => void;
  previousMessages?: Message[];
}

const MessageBubble = memo(function MessageBubble({
  message,
  isStreaming,
  streamingStatus,
  thinkingStartTime,
  isEditing,
  editingContent,
  onEditStart,
  onEditChange,
  onEditSave,
  onEditCancel,
  onDelete,
  onRegenerate,
  onRegenerateWithModel,
  onReference,
  previousMessages,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const [selectedText, setSelectedText] = useState("");
  const [copied, setCopied] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [showSourcesModal, setShowSourcesModal] = useState(false);
  const modelSearchRef = useRef<HTMLInputElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  const { providers } = useProvidersStore();
  const { showEstimatedCost } = useLocalSettingsStore();

  // Focus search input when dropdown opens
  useEffect(() => {
    if (modelDropdownOpen) {
      // Small delay to ensure dropdown is rendered
      setTimeout(() => {
        modelSearchRef.current?.focus();
      }, 0);
    } else {
      setModelSearch("");
    }
  }, [modelDropdownOpen]);

  // Get model info for this message
  const modelInfo = useMemo(() => {
    if (!message.modelId) return null;

    for (const provider of providers) {
      const model = provider.models?.find(m => m.id === message.modelId);
      if (model) {
        const { provider: modelProvider, cleanName } = parseModelName(model.id, model.name);
        return { model, provider: modelProvider, cleanName };
      }
    }
    return null;
  }, [message.modelId, providers]);

  // Calculate estimated cost for this message
  const estimatedCost = useMemo(() => {
    if (!modelInfo?.model?.pricing || !previousMessages) return null;
    
    const promptContent = previousMessages.map(m => m.content).join("\n");
    const promptTokens = estimateTokenCount(promptContent);
    const completionTokens = estimateTokenCount(message.content);
    
    return calculateCost(promptTokens, completionTokens, modelInfo.model.pricing);
  }, [modelInfo?.model?.pricing, message.content, previousMessages]);

  // Build citation map from annotations
  const citationMap = useMemo(() => {
    const map = new Map<string, { index: number; citation: UrlCitation }>();
    if (!message.annotations?.length) return map;
    let idx = 1;
    for (const annotation of message.annotations) {
      if (!map.has(annotation.url)) {
        map.set(annotation.url, { index: idx++, citation: annotation });
      }
    }
    return map;
  }, [message.annotations]);

  // Get all available models for the dropdown
  const availableModels = useMemo(() => {
    const models: { id: string; name: string; cleanName: string; provider: ModelProvider }[] = [];
    for (const provider of providers) {
      for (const model of provider.models || []) {
        const { provider: modelProvider, cleanName } = parseModelName(model.id, model.name);
        models.push({ id: model.id, name: model.name, cleanName, provider: modelProvider });
      }
    }
    return models;
  }, [providers]);

  // Filter models based on search
  const filteredModels = useMemo(() => {
    if (!modelSearch.trim()) return availableModels;
    const searchLower = modelSearch.toLowerCase();
    return availableModels.filter(
      (model) =>
        model.cleanName.toLowerCase().includes(searchLower) ||
        model.id.toLowerCase().includes(searchLower) ||
        model.provider.toLowerCase().includes(searchLower)
    );
  }, [availableModels, modelSearch]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      toast.success("Copied to clipboard", {
        icon: <IconCopy className="size-4 text-green-500" />,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleContextMenu = () => {
    // Capture selected text when context menu opens
    const selection = window.getSelection();
    setSelectedText(selection?.toString().trim() || "");
  };

  // Auto-resize and focus when editing starts
  useEffect(() => {
    if (isEditing && editTextareaRef.current) {
      editTextareaRef.current.focus();
      // Set cursor at end
      editTextareaRef.current.selectionStart = editTextareaRef.current.value.length;
      editTextareaRef.current.selectionEnd = editTextareaRef.current.value.length;
      // Auto-resize
      editTextareaRef.current.style.height = "auto";
      editTextareaRef.current.style.height = `${editTextareaRef.current.scrollHeight}px`;
    }
  }, [isEditing]);

  // Auto-resize on content change
  useEffect(() => {
    if (isEditing && editTextareaRef.current) {
      editTextareaRef.current.style.height = "auto";
      editTextareaRef.current.style.height = `${editTextareaRef.current.scrollHeight}px`;
    }
  }, [editingContent, isEditing]);

  const handleEditKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onEditSave?.();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onEditCancel?.();
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={`flex w-full min-w-0 ${isUser ? "justify-end" : "justify-start"} mb-4`}
          onContextMenu={handleContextMenu}
        >
          <div
            className={`min-w-0 ${isUser
              ? "select-text max-w-[80%] rounded-2xl rounded-br-md bg-muted px-4 py-2.5"
              : "group/message w-full px-1"
              }`}
          >
            {isUser ? (
              isEditing ? (
                <div className="space-y-2">
                  <textarea
                    ref={editTextareaRef}
                    value={editingContent}
                    onChange={(e) => onEditChange?.(e.target.value)}
                    onKeyDown={handleEditKeyDown}
                    className="w-full min-w-[200px] bg-background text-sm leading-relaxed text-foreground resize-none rounded-lg border border-border p-2 outline-none focus:ring-1 focus:ring-primary"
                    rows={1}
                  />
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={onEditCancel}
                      className="h-7 px-2 text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={onEditSave}
                      disabled={!editingContent?.trim()}
                      className="h-7 px-2 text-xs"
                    >
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground select-text cursor-text">
                  {message.content}
                </p>
              )
            ) : (
              <>
                {/* Error state */}
                {message.error ? (
                  <>
                    <div className="flex items-center gap-2 text-sm text-destructive select-text cursor-text">
                      <IconAlertTriangle className="size-4 shrink-0" />
                      <span>{message.error}</span>
                    </div>
                    {/* Action buttons for error state - same layout as normal messages */}
                    <div className={`flex items-center gap-1 mt-2 select-none h-7 transition-opacity duration-200 ${modelDropdownOpen ? "opacity-100" : "opacity-0 group-hover/message:opacity-100"}`}>
                      {/* Copy button - disabled for errors */}
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled
                        className="h-7 px-2 text-xs text-muted-foreground opacity-50 rounded-xl active:scale-95 transition-all duration-200"
                      >
                        <IconCopy className="size-3.5 mr-1" />
                        Copy
                      </Button>

                      {/* Model picker dropdown to retry */}
                      {modelInfo && (
                        <DropdownMenu open={modelDropdownOpen} onOpenChange={setModelDropdownOpen}>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground select-none rounded-xl active:scale-95 transition-all duration-200"
                            >
                              <ProviderIcon provider={modelInfo.provider} className="size-3.5 mr-1" />
                              {modelInfo.cleanName.length > 50
                                ? modelInfo.cleanName.slice(0, 50) + "..."
                                : modelInfo.cleanName}
                              <IconChevronDown className="size-3 ml-1" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-56">
                            {/* Search input */}
                            <div
                              className="flex items-center gap-2 px-2 pt-1.5 pb-2 border-b mx-0 cursor-text"
                              onClick={() => modelSearchRef.current?.focus()}
                            >
                              <IconSearch className="size-3.5 text-muted-foreground shrink-0" />
                              <input
                                ref={modelSearchRef}
                                placeholder="Regenerate with..."
                                value={modelSearch}
                                onChange={(e) => setModelSearch(e.target.value)}
                                className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                                onKeyDown={(e) => {
                                  e.stopPropagation();
                                }}
                              />
                            </div>
                            <ScrollArea className="h-52">
                              {filteredModels.length === 0 ? (
                                <div className="p-4 text-center text-sm text-muted-foreground">
                                  No models found
                                </div>
                              ) : (
                                filteredModels.map((model) => (
                                  <DropdownMenuItem
                                    key={model.id}
                                    onClick={() => onRegenerateWithModel?.(model.id)}
                                    className="flex items-center gap-2"
                                  >
                                    <ProviderIcon provider={model.provider} className="size-4" />
                                    <span className="truncate flex-1">{model.cleanName}</span>
                                    {model.id === message.modelId && (
                                      <IconCheck className="size-4 text-primary" />
                                    )}
                                  </DropdownMenuItem>
                                ))
                              )}
                            </ScrollArea>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}

                      {/* Delete button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={onDelete}
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive rounded-xl active:scale-95 transition-all duration-200"
                      >
                        <IconTrash className="size-3.5 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <CitationContext.Provider value={citationMap}>
                      {/* Thinking block - shown during reasoning and persists after */}
                      {(message.reasoning || (isStreaming && streamingStatus === 'thinking')) && (
                        <ThinkingBlock
                          reasoning={message.reasoning || ''}
                          isThinking={!!isStreaming && streamingStatus === 'thinking'}
                          thinkingDuration={message.thinkingDuration}
                          thinkingStartTime={thinkingStartTime ?? null}
                          animateIn={!!isStreaming}
                        />
                      )}

                      {/* Status line for connecting/searching phases */}
                      <FadeSlot
                        slotKey={isStreaming && !message.content && streamingStatus !== 'thinking' ? (streamingStatus ?? null) : null}
                      >
                        <StreamingStatusLine status={streamingStatus ?? null} />
                      </FadeSlot>

                      <div className="prose prose-sm dark:prose-invert max-w-none min-w-0 prose-p:leading-relaxed prose-code:before:content-none prose-code:after:content-none select-text cursor-text">
                        {message.content ? (
                          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={markdownComponents}>
                            {message.content}
                          </ReactMarkdown>
                        ) : null}
                      </div>
                    </CitationContext.Provider>
                    {/* Action buttons for AI messages */}
                    {!isStreaming && message.content && (
                      <div className={`flex items-center gap-1 mt-2 select-none h-7 transition-opacity duration-200 ${modelDropdownOpen ? "opacity-100" : "opacity-0 group-hover/message:opacity-100"}`}>
                        {/* Copy button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCopy}
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground rounded-xl active:scale-95 transition-all duration-200"
                        >
                          {copied ? (
                            <IconCheck className="size-3.5 mr-1" />
                          ) : (
                            <IconCopy className="size-3.5 mr-1" />
                          )}
                          {copied ? "Copied" : "Copy"}
                        </Button>

                        {/* Model picker dropdown */}
                        {modelInfo && (
                          <DropdownMenu open={modelDropdownOpen} onOpenChange={setModelDropdownOpen}>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground select-none rounded-xl active:scale-95 transition-all duration-200"
                              >
                                <ProviderIcon provider={modelInfo.provider} className="size-3.5 mr-1" />
                                {modelInfo.cleanName.length > 50
                                  ? modelInfo.cleanName.slice(0, 50) + "..."
                                  : modelInfo.cleanName}
                                <IconChevronDown className="size-3 ml-1" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-56">
                              {/* Search input */}
                              <div
                                className="flex items-center gap-2 px-2 pt-1.5 pb-2 border-b mx-0 cursor-text"
                                onClick={() => modelSearchRef.current?.focus()}
                              >
                                <IconSearch className="size-3.5 text-muted-foreground shrink-0" />
                                <input
                                  ref={modelSearchRef}
                                  placeholder="Regenerate with..."
                                  value={modelSearch}
                                  onChange={(e) => setModelSearch(e.target.value)}
                                  className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                                  onKeyDown={(e) => {
                                    // Prevent dropdown from closing on key presses
                                    e.stopPropagation();
                                  }}
                                />
                              </div>
                              <ScrollArea className="h-52">
                                {filteredModels.length === 0 ? (
                                  <div className="p-4 text-center text-sm text-muted-foreground">
                                    No models found
                                  </div>
                                ) : (
                                  filteredModels.map((model) => (
                                    <DropdownMenuItem
                                      key={model.id}
                                      onClick={() => onRegenerateWithModel?.(model.id)}
                                      className="flex items-center gap-2"
                                    >
                                      <ProviderIcon provider={model.provider} className="size-4" />
                                      <span className="truncate flex-1">{model.cleanName}</span>
                                      {model.id === message.modelId && (
                                        <IconCheck className="size-4 text-primary" />
                                      )}
                                    </DropdownMenuItem>
                                  ))
                                )}
                              </ScrollArea>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}

                        {/* Cost/Context button */}
                        {modelInfo && estimatedCost !== null && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowInfoDialog(true)}
                            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground rounded-xl active:scale-95 transition-all duration-200"
                          >
                            {showEstimatedCost ? (
                              <>
                                <IconCoins className="size-3.5 mr-1" />
                                {formatCost(estimatedCost)}
                              </>
                            ) : (
                              <>
                                <IconInfoCircle className="size-3.5 mr-1" />
                                Information
                              </>
                            )}
                          </Button>
                        )}

                        {/* Sources button */}
                        {message.annotations && message.annotations.length > 0 && (
                          <SourcesButton
                            annotations={message.annotations}
                            onOpen={() => setShowSourcesModal(true)}
                          />
                        )}

                        {/* Delete button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={onDelete}
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive rounded-xl active:scale-95 transition-all duration-200"
                        >
                          <IconTrash className="size-3.5 mr-1" />
                          Delete
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {isUser ? (
          <>
            {selectedText && (
              <ContextMenuItem
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(selectedText);
                    toast.success("Copied to clipboard", {
                      icon: <IconCopy className="size-4 text-green-500" />,
                    });
                  } catch {
                    toast.error("Failed to copy");
                  }
                }}
              >
                <IconCopy className="size-4 mr-2" />
                Copy selected
              </ContextMenuItem>
            )}
            <ContextMenuItem onClick={onEditStart} disabled={isEditing}>
              <IconPencil className="size-4 mr-2" />
              Edit message
            </ContextMenuItem>
            <ContextMenuItem onClick={() => setShowInfoDialog(true)}>
              <IconInfoCircle className="size-4 mr-2" />
              Message information
            </ContextMenuItem>
            <ContextMenuItem
              variant="destructive"
              onClick={onDelete}
            >
              <IconTrash className="size-4 mr-2" />
              Delete message
            </ContextMenuItem>
          </>
        ) : (
          <>
            {selectedText && (
              <>
                <ContextMenuItem
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(selectedText);
                      toast.success("Copied to clipboard", {
                        icon: <IconCopy className="size-4 text-green-500" />,
                      });
                    } catch {
                      toast.error("Failed to copy");
                    }
                  }}
                >
                  <IconCopy className="size-4 mr-2" />
                  Copy selected
                </ContextMenuItem>
                <ContextMenuItem onClick={() => onReference?.(selectedText)}>
                  <IconQuote className="size-4 mr-2" />
                  Reference selected
                </ContextMenuItem>
              </>
            )}
            <ContextMenuItem onClick={onRegenerate}>
              <IconRefresh className="size-4 mr-2" />
              Regenerate message
            </ContextMenuItem>
            <ContextMenuItem onClick={() => setShowInfoDialog(true)}>
              <IconInfoCircle className="size-4 mr-2" />
              Message information
            </ContextMenuItem>
            <ContextMenuItem
              variant="destructive"
              onClick={onDelete}
            >
              <IconTrash className="size-4 mr-2" />
              Delete message
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
      <MessageInfoDialog
        open={showInfoDialog}
        onOpenChange={setShowInfoDialog}
        message={message}
        model={modelInfo?.model || null}
        modelProvider={modelInfo?.provider || null}
        modelCleanName={modelInfo?.cleanName || null}
        previousMessages={previousMessages}
      />
      {message.annotations && message.annotations.length > 0 && (
        <SourcesModal
          open={showSourcesModal}
          onOpenChange={setShowSourcesModal}
          annotations={message.annotations}
        />
      )}
    </ContextMenu>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.error === nextProps.message.error &&
    prevProps.message.annotations === nextProps.message.annotations &&
    prevProps.message.reasoning === nextProps.message.reasoning &&
    prevProps.message.thinkingDuration === nextProps.message.thinkingDuration &&
    prevProps.isStreaming === nextProps.isStreaming &&
    prevProps.streamingStatus === nextProps.streamingStatus &&
    prevProps.thinkingStartTime === nextProps.thinkingStartTime &&
    prevProps.isEditing === nextProps.isEditing &&
    prevProps.editingContent === nextProps.editingContent
  );
});

function EmptyState() {
  return (
    <>
      <TitleBar />
      <div className="flex flex-1 flex-col items-center justify-center text-center pb-32">
        <div className="rounded-full bg-muted p-4 mb-4">
          <IconMessagePlus className="size-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold mb-4">Start a new conversation with</h2>
        <ModelPicker showTooltip={false} size="large" />
        <p className="text-muted-foreground max-w-lg mt-4 flex items-center gap-1">
          Press <Kbd className="text-[10px] px-1.5 py-0.5">⌘</Kbd><Kbd className="text-[10px] px-1.5 py-0.5">⇧</Kbd><Kbd className="text-[10px] px-1.5 py-0.5">M</Kbd> to open Model Picker
        </p>
      </div>
    </>
  );
}

// Props interface for FloatingInput
interface FloatingInputProps {
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  onSubmit: (e: FormEvent) => void;
  onStop: () => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  fullWidth?: boolean;
}

const FloatingInput = memo(function FloatingInput({
  input,
  setInput,
  isLoading,
  onSubmit,
  onStop,
  textareaRef,
  fullWidth,
}: FloatingInputProps) {
  const LINE_HEIGHT = 20;
  const MAX_LINES = 8;
  const MAX_HEIGHT = LINE_HEIGHT * MAX_LINES;
  const { state, isMobile } = useSidebar();
  const { webSearchEnabled, setWebSearchEnabled } = useLocalSettingsStore();

  // Calculate left position based on sidebar state (offcanvas mode)
  const getLeftPosition = () => {
    if (isMobile) return "0px";
    if (state === "collapsed") return "0px";
    return "var(--sidebar-width)";
  };

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = "auto";
      // Set new height, capped at max
      const newHeight = Math.min(textarea.scrollHeight, MAX_HEIGHT);
      textarea.style.height = `${newHeight}px`;
    }
  }, [input, textareaRef]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter without Shift, but only if not loading
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && input.trim()) {
        onSubmit(e as unknown as FormEvent);
      }
    }
  };

  const handleCut = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const { value, selectionStart, selectionEnd } = ta;
    const selected = value.slice(selectionStart, selectionEnd);
    if (selected) {
      void navigator.clipboard.writeText(selected);
      setInput(value.slice(0, selectionStart) + value.slice(selectionEnd));
      ta.selectionStart = ta.selectionEnd = selectionStart;
    }
  }, []);
  const handleCopy = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const selected = ta.value.slice(ta.selectionStart, ta.selectionEnd);
    if (selected) void navigator.clipboard.writeText(selected);
  }, []);
  const handlePaste = useCallback(() => {
    void navigator.clipboard.readText().then((text) => {
      const ta = textareaRef.current;
      if (!ta) return;
      const { value, selectionStart, selectionEnd } = ta;
      const newValue = value.slice(0, selectionStart) + text + value.slice(selectionEnd);
      setInput(newValue);
      const newPos = selectionStart + text.length;
      ta.selectionStart = ta.selectionEnd = newPos;
    });
  }, []);
  const savedSelectionRef = useRef<{ start: number; end: number } | null>(null);
  const [contextMenuSelection, setContextMenuSelection] = useState<{ start: number; end: number } | null>(null);

  const handlePromptContextMenu = useCallback(() => {
    const ta = textareaRef.current;
    if (ta) {
      const sel = { start: ta.selectionStart, end: ta.selectionEnd };
      savedSelectionRef.current = sel;
      setContextMenuSelection(sel);
    }
  }, []);

  const handleContextMenuOpenChange = useCallback((open: boolean) => {
    if (!open) {
      const ta = textareaRef.current;
      const saved = savedSelectionRef.current;
      if (ta && saved) {
        ta.focus();
        ta.selectionStart = saved.start;
        ta.selectionEnd = saved.end;
      }
      savedSelectionRef.current = null;
      setContextMenuSelection(null);
    }
  }, []);

  const hasSelection = contextMenuSelection != null && contextMenuSelection.start < contextMenuSelection.end;

  const handlePromptRightMouseDown = useCallback((e: React.MouseEvent<HTMLTextAreaElement>) => {
    if (e.button === 2) e.preventDefault();
  }, []);

  return (
    <div
      className="fixed bottom-0 right-0 z-50 pb-4 sm:pb-6 px-2 sm:px-4 pointer-events-none transition-[left] duration-200 ease-linear"
      style={{ left: getLeftPosition() }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!isLoading && input.trim()) {
            onSubmit(e);
          }
        }}
        className={`mx-auto pointer-events-auto ${fullWidth ? "px-2" : "max-w-3xl"}`}
      >
        <div className="rounded-2xl border border-border bg-background/80 backdrop-blur-xl shadow-lg">
          {/* Input Row with context menu for copy/cut/paste */}
          <ContextMenu onOpenChange={handleContextMenuOpenChange}>
            <ContextMenuTrigger asChild>
              <div className="p-3" onContextMenu={handlePromptContextMenu}>
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onMouseDown={handlePromptRightMouseDown}
                  placeholder="Ask anything"
                  rows={1}
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground resize-none leading-5 max-h-40 overflow-y-auto"
                />
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onClick={handleCut} disabled={!hasSelection}>
                <IconCut className="size-4" />
                Cut
                <ContextMenuShortcut>⌘X</ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuItem onClick={handleCopy} disabled={!hasSelection}>
                <IconCopy className="size-4" />
                Copy
                <ContextMenuShortcut>⌘C</ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuItem onClick={handlePaste}>
                <IconClipboard className="size-4" />
                Paste
                <ContextMenuShortcut>⌘V</ContextMenuShortcut>
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>

          {/* Actions Row */}
          <div className="flex items-center justify-between px-2 pb-2">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-foreground rounded-xl"
              >
                <IconPlus className="size-4" />
              </Button>

              {/* Hide extended actions on mobile */}
              <div className="hidden sm:flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setWebSearchEnabled(!webSearchEnabled)}
                  className={`gap-1.5 rounded-xl transition-all duration-200 ${
                    webSearchEnabled
                      ? "bg-primary/10 text-primary hover:bg-primary/15 border border-primary/20"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <IconWorld className="size-4" />
                  Search
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground gap-1.5 rounded-xl"
                >
                  <IconBulb className="size-4" />
                  Reason
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground gap-1.5 rounded-xl hidden md:flex"
                >
                  <IconSparkles className="size-4" />
                  Deep research
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground gap-1.5 rounded-xl hidden lg:flex"
                >
                  <IconPhoto className="size-4" />
                  Create image
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-foreground rounded-xl active:scale-95 transition-all duration-200"
                >
                  <IconDots className="size-4" />
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                type={isLoading ? "button" : "submit"}
                size="icon-sm"
                disabled={!isLoading && !input.trim()}
                onClick={isLoading ? onStop : undefined}
                className={`rounded-xl transition-all duration-200 ${isLoading
                  ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                  : ""
                  }`}
              >
                <div className="relative size-4">
                  <IconArrowUp
                    className={`size-4 absolute inset-0 transition-all duration-200 ${isLoading ? "opacity-0 scale-50 rotate-180" : "opacity-100 scale-100 rotate-0"
                      }`}
                  />
                  <IconPlayerStopFilled
                    className={`size-4 absolute inset-0 transition-all duration-200 text-white ${isLoading ? "opacity-100 scale-100 rotate-0" : "opacity-0 scale-50 -rotate-180"
                      }`}
                  />
                </div>
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
});

export function ChatView() {
  const [input, setInput] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [deleteMessageId, setDeleteMessageId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  /** Message IDs present when this chat was opened; only animate user messages not in this set (i.e. sent this session) */
  const initialMessageIdsRef = useRef<Set<string>>(new Set());
  /** Track last seen chatId so we can update the snapshot synchronously during render */
  const lastSnapshotChatIdRef = useRef<string | null>(null);

  const { user } = useAuth();
  const { setIsScrolled } = useScroll();
  const { fullWidthChat, showEstimatedCost, webSearchEnabled } = useLocalSettingsStore();

  // Use separate selectors for better performance - only subscribe to what we need
  const activeChatId = useChatStore((state) => state.activeChatId);
  const activeStream = useChatStore(
    useCallback((state) => {
      if (!state.activeChatId) return null;
      return state.streamingChats[state.activeChatId] ?? null;
    }, [])
  );

  // Use a memoized selector for activeChat to prevent unnecessary re-renders
  const activeChat = useChatStore(
    useCallback((state) => state.chats.find((c) => c.id === state.activeChatId), [])
  );

  // Snapshot message IDs synchronously during render (not in useEffect) so that
  // the very first render of a newly-opened chat already has all existing IDs
  // in the set, preventing them from being mistaken as "just sent" and animated.
  if (activeChatId !== lastSnapshotChatIdRef.current) {
    lastSnapshotChatIdRef.current = activeChatId ?? null;
    initialMessageIdsRef.current = new Set(activeChat?.messages.map((m) => m.id) ?? []);
  }

  // Get store actions (these are stable references)
  const {
    createChat,
    addMessage,
    addMessageWithId,
    appendToMessage,
    appendToMessageReasoning,
    setMessageThinkingDuration,
    deleteMessage,
    updateMessageContent,
    updateMessageModel,
    setMessageError,
    setMessageAnnotations,
    setChatStreaming,
    updateChatStreaming,
    clearChatStreaming,
  } = useChatStore();

  const { selectedModel, providers, setSelectedModel } = useProvidersStore();
  const isActiveChatStreaming = !!activeStream;
  const activeStreamingMessageId = activeStream?.messageId ?? null;
  const activeStreamingStatus = activeStream?.status ?? null;
  const activeThinkingStartTime = activeStream?.thinkingStartTime ?? null;

  // Memoize message count and last message content for scroll effect
  const messageCount = activeChat?.messages.length ?? 0;
  const lastMessageContent = activeChat?.messages[messageCount - 1]?.content ?? "";

  // Auto-scroll to bottom when new messages arrive or content changes (streaming)
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messageCount, lastMessageContent]);

  // Focus input when chat changes
  useEffect(() => {
    textareaRef.current?.focus();
  }, [activeChatId]);

  // Track scroll position for header border
  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) {
      // No scroll element means we're in empty state - reset scroll state
      setIsScrolled(false);
      return;
    }

    const handleScroll = () => {
      setIsScrolled(scrollElement.scrollTop > 0);
    };

    scrollElement.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Check initial state

    return () => scrollElement.removeEventListener("scroll", handleScroll);
  }, [setIsScrolled, activeChatId]);

  useEffect(() => {
    return () => {
      abortControllersRef.current.forEach((controller) => controller.abort());
      abortControllersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (user) return;

    abortControllersRef.current.forEach((controller) => controller.abort());
    abortControllersRef.current.clear();
  }, [user]);

  const isCurrentStream = useCallback((chatId: string, messageId: string) => {
    return useChatStore.getState().streamingChats[chatId]?.messageId === messageId;
  }, []);

  const finalizeThinkingPhase = useCallback(
    (chatId: string, messageId: string) => {
      const currentStream = useChatStore.getState().streamingChats[chatId];
      if (!currentStream || currentStream.messageId !== messageId || !currentStream.thinkingStartTime) {
        return;
      }

      const duration = Math.floor((Date.now() - currentStream.thinkingStartTime) / 1000);
      setMessageThinkingDuration(chatId, messageId, duration);
      updateChatStreaming(chatId, { thinkingStartTime: null });
    },
    [setMessageThinkingDuration, updateChatStreaming]
  );

  const finishStream = useCallback(
    (chatId: string, messageId: string) => {
      if (!isCurrentStream(chatId, messageId)) return;
      abortControllersRef.current.delete(chatId);
      clearChatStreaming(chatId);
    },
    [clearChatStreaming, isCurrentStream]
  );

  const startAssistantStream = useCallback(
    async ({
      chatId,
      assistantMessageId,
      messages,
      modelId,
      providerId,
      requestedModelId,
    }: {
      chatId: string;
      assistantMessageId: string;
      messages: ChatMessage[];
      modelId: string;
      providerId: string;
      requestedModelId?: string;
    }) => {
      if (!user) return;

      const abortController = new AbortController();
      abortControllersRef.current.set(chatId, abortController);
      setChatStreaming(chatId, {
        messageId: assistantMessageId,
        status: "connecting",
        thinkingStartTime: null,
      });

      try {
        const apiKey = await getProviderApiKey(user.uid, providerId);

        if (!isCurrentStream(chatId, assistantMessageId) || abortController.signal.aborted) {
          return;
        }

        if (!apiKey) {
          const message = "API key not found. Please reconfigure your provider.";
          toast.error(message);
          setMessageError(chatId, assistantMessageId, message);
          finishStream(chatId, assistantMessageId);
          return;
        }

        const plugins = webSearchEnabled ? [{ id: "web" }] : undefined;

        await streamChat({
          messages,
          model: modelId,
          apiKey,
          plugins,
          onChunk: (chunk) => {
            if (!isCurrentStream(chatId, assistantMessageId)) return;
            appendToMessage(chatId, assistantMessageId, chunk);
          },
          onModel: (actualModel) => {
            if (!isCurrentStream(chatId, assistantMessageId)) return;
            if (requestedModelId && actualModel !== requestedModelId) {
              updateMessageModel(chatId, assistantMessageId, actualModel);
            }
          },
          onAnnotations: (annotations) => {
            if (!isCurrentStream(chatId, assistantMessageId)) return;
            setMessageAnnotations(chatId, assistantMessageId, annotations);
          },
          onStatusChange: (status) => {
            if (!isCurrentStream(chatId, assistantMessageId)) return;

            const currentStream = useChatStore.getState().streamingChats[chatId];
            if (!currentStream) return;

            if (status === "thinking" && !currentStream.thinkingStartTime) {
              updateChatStreaming(chatId, {
                status,
                thinkingStartTime: Date.now(),
              });
              return;
            }

            if (currentStream.status === "thinking" && status !== "thinking") {
              finalizeThinkingPhase(chatId, assistantMessageId);
              updateChatStreaming(chatId, {
                status,
                thinkingStartTime: null,
              });
              return;
            }

            updateChatStreaming(chatId, { status });
          },
          onReasoning: (chunk) => {
            if (!isCurrentStream(chatId, assistantMessageId)) return;
            appendToMessageReasoning(chatId, assistantMessageId, chunk);
          },
          onDone: () => {
            if (!isCurrentStream(chatId, assistantMessageId)) return;
            finalizeThinkingPhase(chatId, assistantMessageId);
            finishStream(chatId, assistantMessageId);
          },
          onError: (error) => {
            if (!isCurrentStream(chatId, assistantMessageId)) return;
            finalizeThinkingPhase(chatId, assistantMessageId);
            setMessageError(chatId, assistantMessageId, error.message);
            finishStream(chatId, assistantMessageId);
          },
          signal: abortController.signal,
        });
      } catch (error) {
        if (!isCurrentStream(chatId, assistantMessageId)) return;

        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        finalizeThinkingPhase(chatId, assistantMessageId);
        setMessageError(chatId, assistantMessageId, errorMessage);
        finishStream(chatId, assistantMessageId);
      }
    },
    [
      user,
      webSearchEnabled,
      appendToMessage,
      appendToMessageReasoning,
      finishStream,
      finalizeThinkingPhase,
      isCurrentStream,
      setChatStreaming,
      setMessageAnnotations,
      setMessageError,
      updateChatStreaming,
      updateMessageModel,
    ]
  );

  const handleStop = useCallback(() => {
    if (!activeChatId || !activeStream) return;

    const controller = abortControllersRef.current.get(activeChatId);
    if (controller) {
      controller.abort();
      abortControllersRef.current.delete(activeChatId);
    }

    if (activeStream.thinkingStartTime) {
      const duration = Math.floor((Date.now() - activeStream.thinkingStartTime) / 1000);
      setMessageThinkingDuration(activeChatId, activeStream.messageId, duration);
    }

    clearChatStreaming(activeChatId);
  }, [activeChatId, activeStream, clearChatStreaming, setMessageThinkingDuration]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!input.trim() || isActiveChatStreaming) return;

    // Check if user is logged in
    if (!user) {
      toast.error("Please sign in to send messages");
      return;
    }

    // Check if a model is selected
    if (!selectedModel) {
      toast.error("Please configure a provider and select a model");
      return;
    }

    let chatId = activeChatId;

    // Create a new chat if there's no active chat
    if (!chatId) {
      chatId = createChat();
    }

    const userMessage = input.trim();
    setInput("");

    // Add user message
    addMessage(chatId, { role: "user", content: userMessage });

    // Create placeholder and show loading dots immediately (before async API key fetch)
    const assistantMessageId = Math.random().toString(36).substring(2, 15);
    const modelId = selectedModel.modelId;
    const providerId = selectedModel.providerId;
    const isAutoRouter = modelId === "openrouter/auto";
    addMessageWithId(chatId, {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      modelId,
      ...(isAutoRouter && { requestedModelId: modelId }),
    });

    // Build message history for context, excluding the placeholder assistant message.
    const currentChat = useChatStore.getState().chats.find((c) => c.id === chatId);
    const messageHistory: ChatMessage[] =
      currentChat?.messages
        .filter((message) => message.id !== assistantMessageId)
        .map((message) => ({
          role: message.role,
          content: message.content,
        })) || [];

    await startAssistantStream({
      chatId,
      assistantMessageId,
      messages: messageHistory,
      modelId,
      providerId,
      requestedModelId: isAutoRouter ? modelId : undefined,
    });
  };

  // Memoized callbacks for MessageBubble to prevent unnecessary re-renders
  const handleEditChange = useCallback((content: string) => {
    setEditingContent(content);
  }, []);

  const handleEditCancel = useCallback(() => {
    setEditingMessageId(null);
    setEditingContent("");
  }, []);

  const handleReference = useCallback((text: string) => {
    const quotedText = text.split('\n').map(line => `> ${line}`).join('\n');
    setInput(prev => prev ? `${prev}\n\n${quotedText}\n\n` : `${quotedText}\n\n`);
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  }, []);

  if (!activeChatId) {
    return (
      <div className="relative flex flex-1 flex-col bg-background overflow-hidden">
        <EmptyState />
        {/* Bottom gradient overlay for smooth transition to input */}
        <div
          className="absolute bottom-0 left-0 right-0 h-36 bg-gradient-to-t from-background/90 via-background/50 to-transparent backdrop-blur-[2px]"
          style={{
            maskImage: 'linear-gradient(to top, black 40%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to top, black 40%, transparent 100%)'
          }}
        />
        <FloatingInput
          input={input}
          setInput={setInput}
          isLoading={isActiveChatStreaming}
          onSubmit={handleSubmit}
          onStop={handleStop}
          textareaRef={textareaRef}
          fullWidth={fullWidthChat}
        />
      </div>
    );
  }

  return (
    <div className="relative flex flex-1 flex-col bg-background overflow-hidden">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden pt-12" ref={scrollRef}>
        <div className={`mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-28 sm:pb-32 min-w-0 ${fullWidthChat ? "" : "max-w-3xl"}`}>
          {activeChat?.messages.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              {/* Chat Header with ModelPicker */}
              <TitleBar>
                <ModelPicker />
              </TitleBar>
              {activeChat?.messages.map((message, index) => {
              const isNewest = index === (activeChat?.messages.length ?? 0) - 1;
              const wasJustSent =
                message.role === "user" && !initialMessageIdsRef.current.has(message.id);
              const isStreamingPlaceholder =
                isNewest &&
                message.role === "assistant" &&
                activeStreamingMessageId === message.id &&
                !message.content;
              const shouldAnimateIn = wasJustSent || isStreamingPlaceholder;
              const isThisStreaming = activeStreamingMessageId === message.id;
              const bubble = (
                <MessageBubble
                message={message}
                isStreaming={isThisStreaming}
                streamingStatus={isThisStreaming ? activeStreamingStatus : undefined}
                thinkingStartTime={isThisStreaming ? activeThinkingStartTime : null}
                isEditing={editingMessageId === message.id}
                editingContent={editingMessageId === message.id ? editingContent : undefined}
                onEditStart={() => {
                  setEditingMessageId(message.id);
                  setEditingContent(message.content);
                }}
                onEditChange={handleEditChange}
                onEditSave={() => {
                  if (activeChatId && editingContent.trim()) {
                    updateMessageContent(activeChatId, message.id, editingContent.trim());
                    toast.success("Message updated");
                  }
                  setEditingMessageId(null);
                  setEditingContent("");
                }}
                onEditCancel={handleEditCancel}
                onDelete={() => {
                  setDeleteMessageId(message.id);
                }}
                onRegenerate={() => {
                  // Find the last user message before this AI message and regenerate
                  if (activeChatId && message.role === "assistant") {
                    if (activeStream) {
                      toast.info("Stop the current response before regenerating this chat.");
                      return;
                    }

                    // Delete this message and all messages after it
                    const messageIndex = activeChat.messages.findIndex(m => m.id === message.id);
                    const messagesToDelete = activeChat.messages.slice(messageIndex);
                    messagesToDelete.forEach(m => deleteMessage(activeChatId, m.id));

                    // Find the last user message
                    const lastUserMessage = activeChat.messages.slice(0, messageIndex).reverse().find(m => m.role === "user");
                    if (lastUserMessage) {
                      // Trigger regeneration by setting input and submitting
                      setInput(lastUserMessage.content);
                      deleteMessage(activeChatId, lastUserMessage.id);
                      toast.info("Regenerating response...");
                      // The user will need to click send, or we can auto-submit
                      setTimeout(() => {
                        textareaRef.current?.form?.requestSubmit();
                      }, 100);
                    }
                  }
                }}
                onReference={handleReference}
                onRegenerateWithModel={async (modelId) => {
                  // Regenerate this message with the selected model
                  if (activeChatId && message.role === "assistant") {
                    if (activeStream) {
                      toast.info("Stop the current response before regenerating this chat.");
                      return;
                    }

                    // Find the provider for this model
                    const provider = providers.find(p =>
                      p.models?.some(m => m.id === modelId)
                    );
                    if (!provider) {
                      toast.error("Model not found");
                      return;
                    }

                    // Get the API key
                    if (!user) {
                      toast.error("Please sign in");
                      return;
                    }

                    // Delete this message and all messages after it
                    const messageIndex = activeChat.messages.findIndex(m => m.id === message.id);
                    const messagesToDelete = activeChat.messages.slice(messageIndex);
                    messagesToDelete.forEach(m => deleteMessage(activeChatId, m.id));

                    // Find the last user message
                    const lastUserMessage = activeChat.messages.slice(0, messageIndex).reverse().find(m => m.role === "user");
                    if (!lastUserMessage) {
                      toast.error("No user message found");
                      return;
                    }

                    // Set the selected model
                    setSelectedModel(provider.id, modelId);

                    // Build messages for API
                    const remainingMessages = activeChat.messages.slice(0, messageIndex);
                    const apiMessages: ChatMessage[] = remainingMessages.map(m => ({
                      role: m.role,
                      content: m.content,
                    }));

                    // Create new assistant message
                    const newAssistantMessageId = crypto.randomUUID();
                    const isAutoRouter = modelId === "openrouter/auto";
                    addMessageWithId(activeChatId, {
                      id: newAssistantMessageId,
                      role: "assistant",
                      content: "",
                      modelId,
                      // If using autorouter, store it as requestedModelId so it shows as recently used
                      ...(isAutoRouter && { requestedModelId: modelId }),
                    });

                    await startAssistantStream({
                      chatId: activeChatId,
                      assistantMessageId: newAssistantMessageId,
                      messages: apiMessages,
                      modelId,
                      providerId: provider.id,
                      requestedModelId: isAutoRouter ? modelId : undefined,
                    });
                  }
                }}
                previousMessages={activeChat?.messages.slice(0, index)}
              />
              );
              return shouldAnimateIn ? (
                <MessageEnterWrapper key={message.id}>{bubble}</MessageEnterWrapper>
              ) : (
                <div key={message.id}>{bubble}</div>
              );
            })}
            </>
          )}
        </div>
      </div>

      {/* Bottom gradient overlay for smooth transition to input */}
      <div
        className="absolute bottom-0 left-0 right-0 h-36 bg-gradient-to-t from-background/90 via-background/50 to-transparent backdrop-blur-[2px]"
        style={{
          maskImage: 'linear-gradient(to top, black 40%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to top, black 40%, transparent 100%)'
        }}
      />

      {/* Floating Input */}
      <FloatingInput
        input={input}
        setInput={setInput}
        isLoading={isActiveChatStreaming}
        onSubmit={handleSubmit}
        onStop={handleStop}
        textareaRef={textareaRef}
        fullWidth={fullWidthChat}
      />

      {/* Delete Message Confirmation Dialog */}
      <AlertDialog open={!!deleteMessageId} onOpenChange={(open) => !open && setDeleteMessageId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete message?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the message.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (activeChatId && deleteMessageId) {
                  deleteMessage(activeChatId, deleteMessageId);
                  toast.success("Message deleted", {
                    icon: <IconTrash className="size-4 text-red-500" />,
                  });
                }
                setDeleteMessageId(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
