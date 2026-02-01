/**
 * Token estimation utilities for estimating cost of messages.
 * 
 * This uses a simple character-based estimation since we don't have
 * access to the actual tokenizer. A rough estimate is ~4 characters per token
 * for English text, which is consistent with OpenAI's guidelines.
 */

// Average characters per token (rough estimate for most models)
const CHARS_PER_TOKEN = 4;

/**
 * Estimate the number of tokens in a text string.
 * This is an approximation - actual token counts vary by model.
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  
  // Basic estimation: ~4 characters per token for English text
  // This accounts for the fact that:
  // - Common words are typically 1 token
  // - Whitespace and punctuation are often separate tokens
  // - Code and special characters may tokenize differently
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Calculate the estimated cost in USD for a message.
 * 
 * @param promptTokens - Number of tokens in the prompt/input
 * @param completionTokens - Number of tokens in the completion/output
 * @param pricing - Pricing object with prompt and completion rates per token
 * @returns Estimated cost in USD
 */
export function calculateCost(
  promptTokens: number,
  completionTokens: number,
  pricing: { prompt: number; completion: number }
): number {
  // OpenRouter pricing is per token (already in dollars)
  const promptCost = promptTokens * pricing.prompt;
  const completionCost = completionTokens * pricing.completion;
  return promptCost + completionCost;
}

/**
 * Format a cost value to a human-readable string.
 * Shows different precision based on the magnitude.
 */
export function formatCost(cost: number): string {
  if (cost === 0) return "$0.00";
  
  // For very small costs, show more decimal places
  if (cost < 0.0001) {
    return `$${cost.toFixed(6)}`;
  }
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`;
  }
  if (cost < 1) {
    return `$${cost.toFixed(3)}`;
  }
  return `$${cost.toFixed(2)}`;
}

/**
 * Format a token count with thousands separators.
 */
export function formatTokenCount(tokens: number): string {
  return tokens.toLocaleString();
}
