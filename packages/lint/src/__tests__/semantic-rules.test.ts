import { describe, it, expect, vi } from 'vitest';
import { getModelConfig } from '@promptier/core';

import { createSemanticRule } from '../rules/semantic/semantic-rules.js';
import { renderLinterPrompt } from '../rules/semantic/system-prompt.js';
import type { LlmClient } from '../llm/client.js';
import type { LintContext } from '../types.js';

function createMockClient(overrides: Partial<LlmClient> = {}): LlmClient {
  return {
    modelName: 'test-model',
    generate: vi.fn().mockResolvedValue('[]'),
    healthCheck: vi.fn().mockResolvedValue({ ok: true }),
    ...overrides,
  };
}

// Helper to create a lint context
function createLintContext(overrides: Partial<LintContext> = {}): LintContext {
  const defaultModel = 'claude-sonnet-4-20250514';
  return {
    text: 'You are a helpful assistant.',
    modelId: defaultModel,
    modelConfig: getModelConfig(defaultModel),
    sections: [],
    tokenCount: 500,
    ...overrides,
  } as LintContext;
}

describe('createSemanticRule', () => {
  it('returns a valid LintRule', () => {
    const client = createMockClient();
    const rule = createSemanticRule(client);

    expect(rule.id).toBe('semantic-analysis');
    expect(rule.category).toBe('best-practice');
    expect(rule.defaultSeverity).toBe('warning');
    expect(rule.description).toBeTruthy();
    expect(typeof rule.check).toBe('function');
  });

  it('calls client.generate with prompt text', async () => {
    const generate = vi.fn().mockResolvedValueOnce('[]');
    const client = createMockClient({ generate });

    const rule = createSemanticRule(client);
    const ctx = createLintContext({ text: 'You are a test agent.' });
    await rule.check(ctx);

    expect(generate).toHaveBeenCalledOnce();
    const [userPrompt, systemPrompt] = generate.mock.calls[0];
    expect(userPrompt).toContain('You are a test agent.');
    expect(userPrompt).toContain('=== SYSTEM PROMPT TO ANALYZE ===');
    expect(userPrompt).toContain('=== END ===');
    const expectedSystem = await renderLinterPrompt();
    expect(systemPrompt).toBe(expectedSystem);
  });

  it('includes model and section info in user prompt', async () => {
    const generate = vi.fn().mockResolvedValueOnce('[]');
    const client = createMockClient({ generate });

    const rule = createSemanticRule(client);
    const ctx = createLintContext({
      modelId: 'gpt-4o',
      sections: [
        { type: 'identity' },
        { type: 'constraints' },
      ] as LintContext['sections'],
      tokenCount: 1247,
    });
    await rule.check(ctx);

    const userPrompt = generate.mock.calls[0][0];
    expect(userPrompt).toContain('Target model: gpt-4o');
    expect(userPrompt).toContain('identity, constraints');
    expect(userPrompt).toContain('1247');
  });

  it('returns parsed LintWarning array', async () => {
    const client = createMockClient({
      generate: vi.fn().mockResolvedValueOnce(
        JSON.stringify([
          {
            id: 'semantic-contradiction',
            severity: 'warning',
            message: 'Conflicting instructions',
            suggestion: 'Fix it',
          },
        ]),
      ),
    });

    const rule = createSemanticRule(client);
    const ctx = createLintContext();
    const warnings = await rule.check(ctx);

    expect(warnings).toHaveLength(1);
    expect(warnings[0].id).toBe('semantic-contradiction');
    expect(warnings[0].severity).toBe('warning');
    expect(warnings[0].category).toBe('contradiction');
  });

  it('propagates generate errors to the caller', async () => {
    const client = createMockClient({
      generate: vi.fn().mockRejectedValueOnce(new Error('Connection refused')),
    });

    const rule = createSemanticRule(client);
    const ctx = createLintContext();

    // Errors propagate so the linter can handle them with semantic-unavailable
    await expect(rule.check(ctx)).rejects.toThrow('Connection refused');
  });

  it('handles malformed LLM output gracefully', async () => {
    const client = createMockClient({
      generate: vi
        .fn()
        .mockResolvedValueOnce('Sorry, I cannot analyze this prompt.'),
    });

    const rule = createSemanticRule(client);
    const ctx = createLintContext();
    const warnings = await rule.check(ctx);

    // Should return parse-error warning, not throw
    expect(warnings).toHaveLength(1);
    expect(warnings[0].id).toBe('semantic-parse-error');
  });
});
