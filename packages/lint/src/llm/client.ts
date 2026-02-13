/**
 * Common interface for LLM clients used in semantic linting.
 *
 * Implement this interface to add a new LLM provider.
 * Register new providers in create-client.ts.
 */
export interface LlmClient {
  /** Generate a completion given a user prompt and optional system prompt. */
  generate(prompt: string, system?: string): Promise<string>;

  /** Check if the provider is reachable and the configured model is available. */
  healthCheck(): Promise<{ ok: boolean; error?: string }>;

  /** The configured model name, for display purposes. */
  readonly modelName: string;
}
