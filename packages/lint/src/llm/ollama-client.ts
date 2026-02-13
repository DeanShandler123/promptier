import type { LlmConfig } from '../types.js';
import type { LlmClient } from './client.js';

const DEFAULT_HOST = 'http://localhost:11434';
const DEFAULT_MODEL = 'llama3.2:3b';
const DEFAULT_TIMEOUT = 60_000;
const HEALTH_CHECK_TIMEOUT = 5_000;

interface OllamaGenerateResponse {
  response: string;
}

interface OllamaTagsResponse {
  models: Array<{ name: string }>;
}

/**
 * Minimal HTTP client for Ollama's /api/generate endpoint.
 * Uses native fetch — no external dependencies.
 */
export class OllamaClient implements LlmClient {
  private host: string;
  private model: string;
  private timeout: number;

  constructor(config: LlmConfig = {}) {
    this.host = config.host ?? DEFAULT_HOST;
    this.model = config.model ?? DEFAULT_MODEL;
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
  }

  /**
   * Generate a completion from Ollama.
   */
  async generate(prompt: string, system?: string): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const body: Record<string, unknown> = {
        model: this.model,
        prompt,
        stream: false,
        options: {
          temperature: 0.1,
          num_predict: 2048,
        },
      };

      if (system) {
        body.system = system;
      }

      const response = await fetch(`${this.host}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(
          `Ollama returned ${response.status}: ${text || response.statusText}`,
        );
      }

      const data = (await response.json()) as OllamaGenerateResponse;
      return data.response;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Check if Ollama is running and the configured model is available.
   */
  async healthCheck(): Promise<{ ok: boolean; error?: string }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);

    try {
      const response = await fetch(`${this.host}/api/tags`, {
        signal: controller.signal,
      });

      if (!response.ok) {
        return {
          ok: false,
          error: `Ollama returned ${response.status} from ${this.host}/api/tags`,
        };
      }

      const data = (await response.json()) as OllamaTagsResponse;
      const available = data.models?.map((m) => m.name) ?? [];

      // Check exact match or match with any tag suffix (e.g. "llama3.2:3b:latest")
      const found = available.some(
        (name) => name === this.model || name.startsWith(`${this.model}:`),
      );

      if (!found) {
        const list = available.length > 0 ? available.join(', ') : '(none)';
        return {
          ok: false,
          error: `Model "${this.model}" not found. Available: ${list}. Run: ollama pull ${this.model}`,
        };
      }

      return { ok: true };
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === 'AbortError' || error.message.includes('fetch'))
      ) {
        return {
          ok: false,
          error: `Cannot connect to Ollama at ${this.host}. Is it running? Start with: ollama serve`,
        };
      }

      return {
        ok: false,
        error: `Ollama health check failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /** The configured model name, for display purposes. */
  get modelName(): string {
    return this.model;
  }
}
