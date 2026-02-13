/* eslint-disable @typescript-eslint/require-await */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { prompt } from '@promptier/core';

import { Linter } from '../linter.js';

// Mock global fetch for Ollama calls
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Linter with semantic rules', () => {
  it('does not call Ollama when llm is not configured', async () => {
    const linter = new Linter();
    const testPrompt = prompt('test')
      .model('claude-sonnet-4-20250514')
      .identity('You are a helpful assistant.')
      .format('Respond clearly.')
      .build();

    await linter.lint(testPrompt);

    // No fetch calls should be made to Ollama
    const ollamaCalls = mockFetch.mock.calls.filter(
      (call) =>
        typeof call[0] === 'string' && call[0].includes('/api/generate'),
    );
    expect(ollamaCalls).toHaveLength(0);
  });

  it('calls Ollama when llm is enabled', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ response: '[]' }),
    });

    const linter = new Linter({
      llm: {
        enabled: true,
        model: 'llama3.2:3b',
        host: 'http://localhost:11434',
      },
    });

    const testPrompt = prompt('test')
      .model('claude-sonnet-4-20250514')
      .identity('You are a helpful assistant.')
      .format('Respond clearly.')
      .build();

    const result = await linter.lint(testPrompt);

    // Should have made a call to Ollama
    const ollamaCalls = mockFetch.mock.calls.filter(
      (call) =>
        typeof call[0] === 'string' && call[0].includes('/api/generate'),
    );
    expect(ollamaCalls).toHaveLength(1);
    expect(result.stats.llmCalls).toBe(1);
  });

  it('increments llmCalls stat', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ response: '[]' }),
    });

    const linter = new Linter({
      llm: { enabled: true },
    });

    const testPrompt = prompt('test')
      .model('claude-sonnet-4-20250514')
      .identity('You are a helpful assistant.')
      .format('Respond clearly.')
      .build();

    const result = await linter.lint(testPrompt);
    expect(result.stats.llmCalls).toBe(1);
  });

  it('merges semantic warnings into results', async () => {
    const semanticFindings = [
      {
        id: 'semantic-verbosity',
        severity: 'info',
        message: 'Redundant phrasing detected',
        suggestion: 'Simplify the instruction',
      },
    ];

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ response: JSON.stringify(semanticFindings) }),
    });

    const linter = new Linter({
      llm: { enabled: true },
    });

    const testPrompt = prompt('test')
      .model('claude-sonnet-4-20250514')
      .identity('You are a helpful assistant.')
      .format('Respond clearly.')
      .build();

    const result = await linter.lint(testPrompt);

    const semanticWarnings = result.info.filter((w) =>
      w.id.startsWith('semantic-'),
    );
    expect(semanticWarnings.length).toBeGreaterThan(0);
    expect(semanticWarnings[0].message).toBe('Redundant phrasing detected');
  });

  it('degrades gracefully when Ollama is unreachable', async () => {
    mockFetch.mockRejectedValue(new TypeError('fetch failed'));

    const linter = new Linter({
      llm: { enabled: true },
    });

    const testPrompt = prompt('test')
      .model('claude-sonnet-4-20250514')
      .identity('You are a helpful assistant.')
      .format('Respond clearly.')
      .build();

    // Should not throw
    const result = await linter.lint(testPrompt);

    // Should still pass (no hard errors from connectivity issues)
    expect(result.passed).toBe(true);

    // Should include an unavailable info message
    const unavailable = [...result.info].filter(
      (w) => w.id === 'semantic-unavailable',
    );
    expect(unavailable).toHaveLength(1);
    expect(unavailable[0].severity).toBe('info');
  });

  it('skips semantic rules when heuristic rules found errors', async () => {
    const linter = new Linter({
      llm: { enabled: true },
      rules: {
        // user-input-in-system produces errors
        'user-input-in-system': 'error',
      },
    });

    // This prompt has user input markers which trigger a heuristic error
    const testPrompt = prompt('test')
      .model('claude-sonnet-4-20250514')
      .identity('You are a helper. Use {{user.name}} to greet.')
      .build();

    const result = await linter.lint(testPrompt);

    // Heuristic error should be present
    expect(result.errors.length).toBeGreaterThan(0);

    // No Ollama call should have been made
    const ollamaCalls = mockFetch.mock.calls.filter(
      (call) =>
        typeof call[0] === 'string' && call[0].includes('/api/generate'),
    );
    expect(ollamaCalls).toHaveLength(0);
    expect(result.stats.llmCalls).toBe(0);
  });
});
