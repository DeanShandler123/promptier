/* eslint-disable @typescript-eslint/require-await */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { OllamaClient } from '../llm/ollama-client.js';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('OllamaClient', () => {
  describe('generate', () => {
    it('returns response text on 200', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ response: 'Hello from Ollama' }),
      });

      const client = new OllamaClient({ model: 'llama3.2:3b' });
      const result = await client.generate('test prompt');

      expect(result).toBe('Hello from Ollama');
      expect(mockFetch).toHaveBeenCalledOnce();

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('http://localhost:11434/api/generate');
      expect(options.method).toBe('POST');

      const body = JSON.parse(options.body);
      expect(body.model).toBe('llama3.2:3b');
      expect(body.prompt).toBe('test prompt');
      expect(body.stream).toBe(false);
      expect(body.options.temperature).toBe(0.1);
    });

    it('passes system prompt when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ response: '[]' }),
      });

      const client = new OllamaClient();
      await client.generate('user prompt', 'system prompt');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.system).toBe('system prompt');
    });

    it('throws on non-200 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'model not found',
      });

      const client = new OllamaClient();
      await expect(client.generate('test')).rejects.toThrow(
        'Ollama returned 500: model not found',
      );
    });

    it('uses custom host and model from config', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ response: 'ok' }),
      });

      const client = new OllamaClient({
        host: 'http://remote:9999',
        model: 'mistral:7b',
      });
      await client.generate('test');

      expect(mockFetch.mock.calls[0][0]).toBe(
        'http://remote:9999/api/generate',
      );
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model).toBe('mistral:7b');
    });

    it('respects timeout via AbortSignal', async () => {
      mockFetch.mockImplementationOnce(
        async (_url: string, opts: { signal: AbortSignal }) => {
          // Verify an AbortSignal was passed
          expect(opts.signal).toBeInstanceOf(AbortSignal);
          return {
            ok: true,
            json: async () => ({ response: 'ok' }),
          };
        },
      );

      const client = new OllamaClient({ timeout: 5000 });
      await client.generate('test');
    });
  });

  describe('healthCheck', () => {
    it('returns ok when model is found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [{ name: 'llama3.2:3b' }, { name: 'mistral:7b' }],
        }),
      });

      const client = new OllamaClient({ model: 'llama3.2:3b' });
      const result = await client.healthCheck();

      expect(result).toEqual({ ok: true });
    });

    it('matches model with tag suffix', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [{ name: 'llama3.2:3b:latest' }],
        }),
      });

      const client = new OllamaClient({ model: 'llama3.2:3b' });
      const result = await client.healthCheck();

      expect(result).toEqual({ ok: true });
    });

    it('returns error when model not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [{ name: 'mistral:7b' }],
        }),
      });

      const client = new OllamaClient({ model: 'llama3.2:3b' });
      const result = await client.healthCheck();

      expect(result.ok).toBe(false);
      expect(result.error).toContain('Model "llama3.2:3b" not found');
      expect(result.error).toContain('mistral:7b');
      expect(result.error).toContain('ollama pull llama3.2:3b');
    });

    it('returns error when Ollama is unreachable', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));

      const client = new OllamaClient();
      const result = await client.healthCheck();

      expect(result.ok).toBe(false);
      expect(result.error).toContain('Cannot connect to Ollama');
      expect(result.error).toContain('ollama serve');
    });

    it('returns error on non-200 from tags endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const client = new OllamaClient();
      const result = await client.healthCheck();

      expect(result.ok).toBe(false);
      expect(result.error).toContain('Ollama returned 500');
    });
  });

  describe('modelName', () => {
    it('returns the configured model name', () => {
      const client = new OllamaClient({ model: 'phi3:mini' });
      expect(client.modelName).toBe('phi3:mini');
    });

    it('returns default model when not configured', () => {
      const client = new OllamaClient();
      expect(client.modelName).toBe('llama3.2:3b');
    });
  });
});
