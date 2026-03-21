import type { Message } from "./chat-store";

/**
 * Model id to apply in the global picker when opening a chat.
 * Prefers `requestedModelId` (user intent, e.g. Auto Router) over `modelId`
 * (actual model used after routing).
 */
export function getPickerModelIdFromLastAssistant(
  messages: Message[]
): string | undefined {
  const last = [...messages]
    .reverse()
    .find(
      (m) =>
        m.role === "assistant" && (m.modelId != null || m.requestedModelId != null)
    );
  if (!last) return undefined;
  return last.requestedModelId ?? last.modelId;
}
