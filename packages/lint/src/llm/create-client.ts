import type { LlmConfig } from '../types.js';
import type { LlmClient } from './client.js';
import { OllamaClient } from './ollama-client.js';

const SUPPORTED_PROVIDERS = ['ollama'] as const;

/**
 * Create an LLM client based on the provider specified in config.
 *
 * To add a new provider:
 * 1. Create a new client class implementing LlmClient
 * 2. Add a case for it here
 * 3. Add the provider name to LlmConfig['provider'] union in types.ts
 */
export function createLlmClient(config: LlmConfig): LlmClient {
  const provider = config.provider ?? 'ollama';

  switch (provider) {
    case 'ollama':
      return new OllamaClient(config);
    case 'openai':
    case 'ai-sdk':
      throw new Error(
        `Provider "${provider}" is not yet built-in. Pass a custom \`client\` in LlmConfig instead. See: https://github.com/DeanShandler123/promptier#custom-llm-client`,
      );
    default:
      throw new Error(
        `Unknown LLM provider: "${provider}". Supported: ${SUPPORTED_PROVIDERS.join(', ')}. Or pass a custom \`client\` in LlmConfig.`,
      );
  }
}
