import type { ModelConfig, ModelIdentifier } from '../types.js';

/**
 * Model family detection patterns
 */
const MODEL_PATTERNS = {
  claude: /claude|anthropic/i,
  gpt: /gpt|openai|o1-|o3-/i,
  gemini: /gemini|google/i,
} as const;

type ModelFamily = keyof typeof MODEL_PATTERNS | 'unknown';

/**
 * Detect the model family from the model identifier string
 */
export function detectModelFamily(modelId: string): ModelFamily {
  for (const [family, pattern] of Object.entries(MODEL_PATTERNS)) {
    if (pattern.test(modelId)) {
      return family as ModelFamily;
    }
  }
  return 'unknown';
}

/**
 * Default configurations by model family
 */
const familyDefaults: Record<ModelFamily, Omit<ModelConfig, 'id'>> = {
  claude: {
    contextWindow: 200000,
    preferredFormat: 'xml',
    supportsSystemPrompt: true,
    supportsCaching: true,
    cacheConfig: {
      minPrefixTokens: 1024,
      costMultiplier: 0.1,
    },
    tokenizer: 'cl100k_base',
  },
  gpt: {
    contextWindow: 128000,
    preferredFormat: 'markdown',
    supportsSystemPrompt: true,
    supportsCaching: false,
    tokenizer: 'o200k_base',
  },
  gemini: {
    contextWindow: 1000000,
    preferredFormat: 'markdown',
    supportsSystemPrompt: true,
    supportsCaching: false,
    tokenizer: 'cl100k_base',
  },
  unknown: {
    contextWindow: 8192,
    preferredFormat: 'plain',
    supportsSystemPrompt: true,
    supportsCaching: false,
    tokenizer: 'cl100k_base',
  },
};

/**
 * Built-in model configurations (for exact matches)
 */
export const models: Record<string, ModelConfig> = {
  // Anthropic Claude models
  'claude-opus-4-20250514': {
    id: 'claude-opus-4-20250514',
    ...familyDefaults.claude,
  },
  'claude-sonnet-4-20250514': {
    id: 'claude-sonnet-4-20250514',
    ...familyDefaults.claude,
  },
  'claude-haiku-3-20250514': {
    id: 'claude-haiku-3-20250514',
    ...familyDefaults.claude,
  },

  // OpenAI GPT models
  'gpt-4o': {
    id: 'gpt-4o',
    ...familyDefaults.gpt,
  },
  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    ...familyDefaults.gpt,
  },
  'gpt-4-turbo': {
    id: 'gpt-4-turbo',
    ...familyDefaults.gpt,
    tokenizer: 'cl100k_base',
  },

  // Google Gemini models
  'gemini-1.5-pro': {
    id: 'gemini-1.5-pro',
    ...familyDefaults.gemini,
    contextWindow: 2000000,
  },
  'gemini-1.5-flash': {
    id: 'gemini-1.5-flash',
    ...familyDefaults.gemini,
  },
};

// Registry for custom models
const customModels: Map<string, ModelConfig> = new Map();

/**
 * Get configuration for a model
 *
 * Resolution order:
 * 1. Exact match in built-in models
 * 2. Custom registered model
 * 3. Infer from model family patterns
 */
export function getModelConfig(modelId: ModelIdentifier): ModelConfig {
  // Check built-in models first (exact match)
  if (modelId in models) {
    return models[modelId];
  }

  // Check custom registered models
  const customConfig = customModels.get(modelId);
  if (customConfig) {
    return customConfig;
  }

  // Infer from model family
  const family = detectModelFamily(modelId);
  return {
    id: modelId,
    ...familyDefaults[family],
  };
}

/**
 * Register a custom model configuration
 *
 * @example
 * ```typescript
 * // Register with full config
 * registerModel('my-local-llama', {
 *   contextWindow: 8192,
 *   preferredFormat: 'plain',
 *   supportsSystemPrompt: true,
 *   supportsCaching: false,
 *   tokenizer: 'cl100k_base',
 * });
 *
 * // Or extend a family's defaults
 * registerModel('anthropic.claude-custom-v1:0', {
 *   ...getModelConfig('claude-sonnet-4-20250514'),
 *   contextWindow: 100000, // Override specific values
 * });
 * ```
 */
export function registerModel(
  modelId: string,
  config: Omit<ModelConfig, 'id'>,
): void {
  customModels.set(modelId, { ...config, id: modelId });
}

/**
 * Check if a model supports prompt caching
 */
export function supportsCaching(modelId: ModelIdentifier): boolean {
  return getModelConfig(modelId).supportsCaching;
}

/**
 * Get the preferred format for a model
 */
export function getPreferredFormat(
  modelId: ModelIdentifier,
): 'xml' | 'markdown' | 'plain' {
  return getModelConfig(modelId).preferredFormat;
}

/**
 * Get the context window size for a model
 */
export function getContextWindow(modelId: ModelIdentifier): number {
  return getModelConfig(modelId).contextWindow;
}

/**
 * Check if a model identifier matches a known pattern
 */
export function isKnownModelFamily(modelId: string): boolean {
  return detectModelFamily(modelId) !== 'unknown';
}

/**
 * @deprecated Use any string as model identifier - validation is no longer needed
 */
export function isValidModel(_modelId: string): boolean {
  return true; // All model identifiers are now valid
}
