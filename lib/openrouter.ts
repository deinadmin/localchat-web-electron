import { Model } from "./providers-store";

const OPENROUTER_API_BASE = "https://openrouter.ai/api/v1";

export interface UrlCitation {
  url: string;
  title?: string;
  content?: string;
  start_index?: number;
  end_index?: number;
}

export interface OpenRouterModel {
  id: string;
  name: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
  };
}

export interface OpenRouterModelsResponse {
  data: OpenRouterModel[];
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export async function validateApiKey(apiKey: string): Promise<boolean> {
  if (!apiKey || !apiKey.trim()) {
    return false;
  }
  
  try {
    // Use the /auth/key endpoint which requires a valid API key
    const response = await fetch(`${OPENROUTER_API_BASE}/auth/key`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    
    if (!response.ok) {
      return false;
    }
    
    // Verify the response contains valid key data
    const data = await response.json();
    return data.data && typeof data.data.label !== 'undefined';
  } catch {
    return false;
  }
}

export async function fetchModels(apiKey: string): Promise<Model[]> {
  const response = await fetch(`${OPENROUTER_API_BASE}/models`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch models");
  }

  const data: OpenRouterModelsResponse = await response.json();

  // Transform to our Model format and sort by name
  return data.data
    .map((model) => ({
      id: model.id,
      name: model.name,
      contextLength: model.context_length,
      pricing: {
        prompt: parseFloat(model.pricing.prompt),
        completion: parseFloat(model.pricing.completion),
      },
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type StreamingPhase = 'connecting' | 'searching' | 'thinking' | 'generating';

export interface StreamChatParams {
  messages: ChatMessage[];
  model: string;
  apiKey: string;
  plugins?: Array<{ id: string; [key: string]: unknown }>;
  onChunk: (content: string) => void;
  onDone: () => void;
  onError: (error: Error) => void;
  onModel?: (model: string) => void;
  onAnnotations?: (annotations: UrlCitation[]) => void;
  onStatusChange?: (status: StreamingPhase) => void;
  onReasoning?: (chunk: string) => void;
  signal?: AbortSignal;
}

export async function streamChat({
  messages,
  model,
  apiKey,
  plugins,
  onChunk,
  onDone,
  onError,
  onModel,
  onAnnotations,
  onStatusChange,
  onReasoning,
  signal,
}: StreamChatParams): Promise<void> {
  try {
    onStatusChange?.('connecting');

    const body: Record<string, unknown> = {
      model,
      messages,
      stream: true,
    };
    if (plugins?.length) {
      body.plugins = plugins;
    }

    const response = await fetch(`${OPENROUTER_API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "https://localchat.app",
        "X-Title": "LocalChat",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "Failed to get response");
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Response body is not readable");
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let modelReported = false;
    let allAnnotations: UrlCitation[] = [];
    let hasReportedSearching = false;
    let hasReportedThinking = false;
    let hasReportedGenerating = false;
    // Some models/providers may stream "reasoning" as either incremental deltas or
    // as a cumulative string. Track the latest full reasoning we saw so we only
    // forward the new suffix to the UI.
    let lastReasoning = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        while (true) {
          const lineEnd = buffer.indexOf("\n");
          if (lineEnd === -1) break;

          const line = buffer.slice(0, lineEnd).trim();
          buffer = buffer.slice(lineEnd + 1);

          if (!line || line.startsWith(":")) continue;

          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              onDone();
              return;
            }

            try {
              const parsed = JSON.parse(data);
              
              if (parsed.error) {
                throw new Error(parsed.error.message || "Stream error");
              }

              if (!modelReported && parsed.model && onModel) {
                onModel(parsed.model);
                modelReported = true;
              }

              // Extract reasoning tokens (delta.reasoning string or delta.reasoning_details array)
              const deltaReasoning = parsed.choices?.[0]?.delta?.reasoning;
              const deltaReasoningDetails = parsed.choices?.[0]?.delta?.reasoning_details;

              // Prefer reasoning_details.text when present, because for some models
              // OpenRouter includes both `delta.reasoning` and `delta.reasoning_details`
              // for the same chunk (which would otherwise double the output).
              let reasoningTextFromDetails = "";
              if (deltaReasoningDetails && Array.isArray(deltaReasoningDetails)) {
                for (const detail of deltaReasoningDetails) {
                  if (detail?.type === "reasoning.text" && typeof detail.text === "string") {
                    reasoningTextFromDetails += detail.text;
                  }
                }
              }

              const reasoningTextCandidate =
                reasoningTextFromDetails ||
                (typeof deltaReasoning === "string" ? deltaReasoning : "");

              if (reasoningTextCandidate) {
                if (!hasReportedThinking) {
                  hasReportedThinking = true;
                  onStatusChange?.('thinking');
                }

                // De-dup in case the stream sends cumulative reasoning.
                let newSuffix = reasoningTextCandidate;
                if (lastReasoning && reasoningTextCandidate.startsWith(lastReasoning)) {
                  newSuffix = reasoningTextCandidate.slice(lastReasoning.length);
                  lastReasoning = reasoningTextCandidate;
                } else {
                  lastReasoning = lastReasoning + newSuffix;
                }

                if (newSuffix) {
                  onReasoning?.(newSuffix);
                }
              }

              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                if (!hasReportedGenerating) {
                  hasReportedGenerating = true;
                  onStatusChange?.('generating');
                }
                onChunk(content);
              }

              // Collect annotations from delta or message
              const deltaAnnotations =
                parsed.choices?.[0]?.delta?.annotations ||
                parsed.choices?.[0]?.message?.annotations;
              if (deltaAnnotations && Array.isArray(deltaAnnotations)) {
                const newCitations = deltaAnnotations
                  .filter((a: Record<string, unknown>) => a.type === "url_citation" && a.url_citation)
                  .map((a: Record<string, unknown>) => {
                    const c = a.url_citation as Record<string, unknown>;
                    return {
                      url: c.url as string,
                      title: c.title as string | undefined,
                      content: c.content as string | undefined,
                      start_index: c.start_index as number | undefined,
                      end_index: c.end_index as number | undefined,
                    };
                  });
                if (newCitations.length > 0) {
                  if (!hasReportedSearching) {
                    hasReportedSearching = true;
                    onStatusChange?.('searching');
                  }
                  allAnnotations = [...allAnnotations, ...newCitations];
                  onAnnotations?.(allAnnotations);
                }
              }
            } catch (e) {
              if (e instanceof SyntaxError) continue;
              throw e;
            }
          }
        }
      }
    } finally {
      try {
        await reader.cancel();
      } catch {
        // Swallow cancellation errors (expected on user abort).
      }
    }

    onDone();
  } catch (error) {
    const maybeAny = error as any;
    const name = typeof maybeAny?.name === "string" ? maybeAny.name : undefined;
    const message =
      typeof maybeAny?.message === "string"
        ? maybeAny.message
        : typeof maybeAny === "string"
          ? maybeAny
          : undefined;

    const isAbort =
      name === "AbortError" ||
      (typeof message === "string" && /aborted|aborterror/i.test(message));

    if (isAbort) {
      onDone();
      return;
    }

    onError(error instanceof Error ? error : new Error("Unknown error"));
  }
}

// Popular models to show at the top
export const POPULAR_MODELS = [
  "google/gemini-3-flash-preview",
  "google/gemini-2.5-flash-preview",
  "google/gemini-2.5-pro-preview",
  "anthropic/claude-sonnet-4",
  "anthropic/claude-3.5-haiku",
  "openai/gpt-4o",
  "openai/gpt-4o-mini",
  "meta-llama/llama-3.3-70b-instruct",
  "deepseek/deepseek-chat-v3-0324",
];
