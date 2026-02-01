import { Model } from "./providers-store";

const OPENROUTER_API_BASE = "https://openrouter.ai/api/v1";

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

export interface StreamChatParams {
  messages: ChatMessage[];
  model: string;
  apiKey: string;
  onChunk: (content: string) => void;
  onDone: () => void;
  onError: (error: Error) => void;
  signal?: AbortSignal;
}

export async function streamChat({
  messages,
  model,
  apiKey,
  onChunk,
  onDone,
  onError,
  signal,
}: StreamChatParams): Promise<void> {
  try {
    const response = await fetch(`${OPENROUTER_API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "https://localchat.app",
        "X-Title": "LocalChat",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
      }),
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

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete lines from buffer
        while (true) {
          const lineEnd = buffer.indexOf("\n");
          if (lineEnd === -1) break;

          const line = buffer.slice(0, lineEnd).trim();
          buffer = buffer.slice(lineEnd + 1);

          // Skip empty lines and comments
          if (!line || line.startsWith(":")) continue;

          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              onDone();
              return;
            }

            try {
              const parsed = JSON.parse(data);
              
              // Check for errors
              if (parsed.error) {
                throw new Error(parsed.error.message || "Stream error");
              }

              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                onChunk(content);
              }
            } catch (e) {
              // Ignore JSON parse errors for malformed chunks
              if (e instanceof SyntaxError) continue;
              throw e;
            }
          }
        }
      }
    } finally {
      reader.cancel();
    }

    onDone();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
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
