import type { ModelIdentifier } from './types.js';
import { getModelConfig } from './models/index.js';

// Encoding interface that works with tiktoken's return types
interface Encoding {
  encode: (text: string) => { length: number };
}

// Lazy-loaded tiktoken encoding
let cl100kEncoding: Encoding | null = null;
let o200kEncoding: Encoding | null = null;

/**
 * Initialize tiktoken encoding lazily
 */
async function getEncoding(
  tokenizer: 'cl100k_base' | 'o200k_base' | 'custom',
): Promise<Encoding> {
  try {
    // Dynamic import to avoid loading tiktoken at startup
    const tiktoken = await import('tiktoken');

    if (tokenizer === 'cl100k_base') {
      if (!cl100kEncoding) {
        cl100kEncoding = tiktoken.get_encoding('cl100k_base') as Encoding;
      }
      return cl100kEncoding;
    }

    if (tokenizer === 'o200k_base') {
      if (!o200kEncoding) {
        o200kEncoding = tiktoken.get_encoding('o200k_base') as Encoding;
      }
      return o200kEncoding;
    }

    // Default to cl100k for unknown tokenizers
    if (!cl100kEncoding) {
      cl100kEncoding = tiktoken.get_encoding('cl100k_base') as Encoding;
    }
    return cl100kEncoding;
  } catch {
    // Fallback to simple estimation if tiktoken is not available
    return {
      encode: (text: string) => {
        // Rough estimation: ~4 characters per token on average
        const estimated = Math.ceil(text.length / 4);
        return { length: estimated };
      },
    };
  }
}

/**
 * Count tokens in text for a specific model
 */
export async function countTokens(
  text: string,
  modelId: ModelIdentifier,
): Promise<number> {
  const config = getModelConfig(modelId);

  // Use custom tokenizer if provided
  if (config.tokenizer === 'custom' && config.customTokenizer) {
    return config.customTokenizer(text);
  }

  const encoding = await getEncoding(config.tokenizer);
  return encoding.encode(text).length;
}

/**
 * Synchronous token counting with fallback estimation
 * Use this when async is not possible, but prefer countTokens() for accuracy
 */
export function estimateTokens(text: string): number {
  // Rough estimation based on GPT tokenization patterns:
  // - Average of ~4 characters per token for English
  // - Whitespace and punctuation tend to be their own tokens
  // - Code tends to have more tokens per character

  const whitespaceCount = (text.match(/\s+/g) || []).length;
  const codeIndicators = (text.match(/[<>\/={}()\[\]]/g) || []).length;

  // Base estimation
  let tokens = Math.ceil(text.length / 4);

  // Adjust for whitespace (usually separate tokens)
  tokens += Math.floor(whitespaceCount * 0.3);

  // Adjust for code-like content
  if (codeIndicators > text.length * 0.05) {
    tokens = Math.ceil(tokens * 1.2);
  }

  return tokens;
}

/**
 * Create a token counter function for a specific model
 */
export function createTokenCounter(
  modelId: ModelIdentifier,
): (text: string) => Promise<number> {
  return async (text: string) => await countTokens(text, modelId);
}

/**
 * Check if token count exceeds a model's context window
 */
export async function exceedsContextWindow(
  text: string,
  modelId: ModelIdentifier,
  bufferPercentage: number = 0,
): Promise<boolean> {
  const config = getModelConfig(modelId);
  const tokens = await countTokens(text, modelId);
  const effectiveWindow = config.contextWindow * (1 - bufferPercentage / 100);
  return tokens > effectiveWindow;
}

/**
 * Truncate text to fit within token limit
 */
export async function truncateToTokenLimit(
  text: string,
  maxTokens: number,
  modelId: ModelIdentifier,
): Promise<string> {
  const config = getModelConfig(modelId);
  const encoding = await getEncoding(config.tokenizer);

  const tokens = encoding.encode(text);
  if (tokens.length <= maxTokens) {
    return text;
  }

  // Binary search for the right truncation point
  let low = 0;
  let high = text.length;

  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2);
    const truncated = text.slice(0, mid);
    const truncatedTokens = encoding.encode(truncated).length;

    if (truncatedTokens <= maxTokens) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  // Find a clean break point (newline or space)
  let breakPoint = low;
  for (let i = low; i >= Math.max(0, low - 100); i--) {
    if (text[i] === '\n') {
      breakPoint = i;
      break;
    }
    if (text[i] === ' ' && breakPoint === low) {
      breakPoint = i;
    }
  }

  return text.slice(0, breakPoint).trim() + '\n[truncated]';
}
