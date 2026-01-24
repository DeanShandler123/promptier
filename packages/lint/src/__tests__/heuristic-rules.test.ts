import { describe, it, expect } from 'vitest';
import { prompt, getModelConfig, type LintWarning } from '@promptier/core';

import {
  tokenLimitExceeded,
  tokenLimitWarning,
  xmlTagsWithGpt,
  markdownWithClaude,
  dynamicBeforeStatic,
  missingIdentity,
  formatNotLast,
  duplicateInstructions,
  userInputInSystem,
  emptySections,
  conflictingPatterns,
} from '../rules/heuristic/index.js';
import type { LintContext } from '../types.js';

// Heuristic rules are always synchronous, this helper casts the result
function checkSync(
  rule: { check: (ctx: LintContext) => LintWarning[] | Promise<LintWarning[]> },
  ctx: LintContext,
): LintWarning[] {
  return rule.check(ctx) as LintWarning[];
}

// Helper to create a lint context
function createLintContext(overrides: any): LintContext {
  const defaultModel = 'claude-sonnet-4-20250514';
  return {
    text: '',
    modelId: defaultModel,
    modelConfig: getModelConfig(defaultModel),
    sections: [],
    tokenCount: 1000,
    ...overrides,
  };
}

describe('Heuristic Lint Rules', () => {
  describe('tokenLimitExceeded', () => {
    it('returns error when tokens exceed context window', () => {
      const ctx = createLintContext({
        tokenCount: 250000,
        modelConfig: getModelConfig('claude-sonnet-4-20250514'),
      });

      const warnings = checkSync(tokenLimitExceeded, ctx);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].severity).toBe('error');
      expect(warnings[0].category).toBe('token-budget');
    });

    it('returns no warnings when under limit', () => {
      const ctx = createLintContext({
        tokenCount: 5000,
      });

      const warnings = checkSync(tokenLimitExceeded, ctx);
      expect(warnings).toHaveLength(0);
    });
  });

  describe('tokenLimitWarning', () => {
    it('warns when approaching limit (>80%)', () => {
      const ctx = createLintContext({
        tokenCount: 170000, // 85% of 200K
      });

      const warnings = checkSync(tokenLimitWarning, ctx);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].severity).toBe('warning');
    });

    it('does not warn when under 80%', () => {
      const ctx = createLintContext({
        tokenCount: 100000, // 50% of 200K
      });

      const warnings = checkSync(tokenLimitWarning, ctx);
      expect(warnings).toHaveLength(0);
    });

    it('does not warn when over 100% (error rule handles that)', () => {
      const ctx = createLintContext({
        tokenCount: 250000,
      });

      const warnings = checkSync(tokenLimitWarning, ctx);
      expect(warnings).toHaveLength(0);
    });
  });

  describe('xmlTagsWithGpt', () => {
    it('warns when using XML tags with GPT model', () => {
      const ctx = createLintContext({
        modelId: 'gpt-4o',
        modelConfig: getModelConfig('gpt-4o'),
        text: '<identity>You are a helpful assistant.</identity>',
      });

      const warnings = checkSync(xmlTagsWithGpt, ctx);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].category).toBe('model-mismatch');
    });

    it('does not warn for Claude with XML', () => {
      const ctx = createLintContext({
        text: '<identity>You are a helpful assistant.</identity>',
      });

      const warnings = checkSync(xmlTagsWithGpt, ctx);
      expect(warnings).toHaveLength(0);
    });

    it('does not warn for GPT without XML', () => {
      const ctx = createLintContext({
        modelId: 'gpt-4o',
        modelConfig: getModelConfig('gpt-4o'),
        text: 'You are a helpful assistant.',
      });

      const warnings = checkSync(xmlTagsWithGpt, ctx);
      expect(warnings).toHaveLength(0);
    });
  });

  describe('markdownWithClaude', () => {
    it('suggests XML when using markdown headers with Claude', () => {
      const ctx = createLintContext({
        text: '## Identity\n\nYou are a helpful assistant.',
      });

      const warnings = checkSync(markdownWithClaude, ctx);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].severity).toBe('info');
    });

    it('does not warn when Claude uses XML', () => {
      const ctx = createLintContext({
        text: '<identity>You are a helpful assistant.</identity>',
      });

      const warnings = checkSync(markdownWithClaude, ctx);
      expect(warnings).toHaveLength(0);
    });

    it('does not warn for GPT with markdown', () => {
      const ctx = createLintContext({
        modelId: 'gpt-4o',
        modelConfig: getModelConfig('gpt-4o'),
        text: '## Identity\n\nYou are a helpful assistant.',
      });

      const warnings = checkSync(markdownWithClaude, ctx);
      expect(warnings).toHaveLength(0);
    });
  });

  describe('dynamicBeforeStatic', () => {
    it('warns when dynamic content appears before static', () => {
      const ctx = createLintContext({
        sections: [
          { type: 'context', cacheable: false, priority: 0, content: '' },
          { type: 'identity', cacheable: true, priority: 1, content: 'static' },
        ],
      });

      const warnings = checkSync(dynamicBeforeStatic, ctx);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].category).toBe('cache-inefficiency');
    });

    it('does not warn when static comes first', () => {
      const ctx = createLintContext({
        sections: [
          { type: 'identity', cacheable: true, priority: 0, content: 'static' },
          { type: 'context', cacheable: false, priority: 1, content: '' },
        ],
      });

      const warnings = checkSync(dynamicBeforeStatic, ctx);
      expect(warnings).toHaveLength(0);
    });

    it('does not warn when all sections are cacheable', () => {
      const ctx = createLintContext({
        sections: [
          { type: 'identity', cacheable: true, priority: 0, content: 'a' },
          { type: 'format', cacheable: true, priority: 1, content: 'b' },
        ],
      });

      const warnings = checkSync(dynamicBeforeStatic, ctx);
      expect(warnings).toHaveLength(0);
    });
  });

  describe('missingIdentity', () => {
    it('warns when no identity section exists', () => {
      const ctx = createLintContext({
        sections: [
          { type: 'format', cacheable: true, priority: 0, content: 'format' },
        ],
      });

      const warnings = checkSync(missingIdentity, ctx);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].category).toBe('best-practice');
    });

    it('does not warn when identity exists', () => {
      const ctx = createLintContext({
        sections: [
          {
            type: 'identity',
            cacheable: true,
            priority: 0,
            content: 'identity',
          },
        ],
      });

      const warnings = checkSync(missingIdentity, ctx);
      expect(warnings).toHaveLength(0);
    });
  });

  describe('formatNotLast', () => {
    it('suggests moving format to end', () => {
      const ctx = createLintContext({
        sections: [
          { type: 'format', cacheable: true, priority: 0, content: 'format' },
          {
            type: 'identity',
            cacheable: true,
            priority: 1,
            content: 'identity',
          },
        ],
      });

      const warnings = checkSync(formatNotLast, ctx);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].category).toBe('ordering');
    });

    it('does not warn when format is last', () => {
      const ctx = createLintContext({
        sections: [
          {
            type: 'identity',
            cacheable: true,
            priority: 0,
            content: 'identity',
          },
          { type: 'format', cacheable: true, priority: 1, content: 'format' },
        ],
      });

      const warnings = checkSync(formatNotLast, ctx);
      expect(warnings).toHaveLength(0);
    });

    it('does not warn when no format section', () => {
      const ctx = createLintContext({
        sections: [
          {
            type: 'identity',
            cacheable: true,
            priority: 0,
            content: 'identity',
          },
        ],
      });

      const warnings = checkSync(formatNotLast, ctx);
      expect(warnings).toHaveLength(0);
    });
  });

  describe('duplicateInstructions', () => {
    it('detects duplicate sentences', () => {
      const ctx = createLintContext({
        text: 'You must always be helpful and respond clearly. Some other text here. You must always be helpful and respond clearly.',
      });

      const warnings = checkSync(duplicateInstructions, ctx);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].category).toBe('duplication');
    });

    it('includes position data for duplicates', () => {
      const text =
        'You must always be helpful and respond clearly. Some other text here. You must always be helpful and respond clearly.';
      const ctx = createLintContext({ text });

      const warnings = checkSync(duplicateInstructions, ctx);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].position).toBeDefined();
      expect(warnings[0].position?.line).toBe(1);
      expect(warnings[0].position?.column).toBeGreaterThan(1);
      expect(warnings[0].position?.start).toBeGreaterThan(0);
      expect(warnings[0].position?.end).toBeGreaterThan(
        warnings[0].position!.start,
      );
    });

    it('ignores short sentences', () => {
      const ctx = createLintContext({
        text: 'Be helpful. Be helpful.',
      });

      const warnings = checkSync(duplicateInstructions, ctx);
      expect(warnings).toHaveLength(0);
    });

    it('does not warn for unique sentences', () => {
      const ctx = createLintContext({
        text: 'You must always be helpful. You should respond clearly.',
      });

      const warnings = checkSync(duplicateInstructions, ctx);
      expect(warnings).toHaveLength(0);
    });
  });

  describe('userInputInSystem', () => {
    it('detects user input markers in non-context sections', () => {
      const ctx = createLintContext({
        sections: [
          {
            type: 'identity',
            cacheable: true,
            priority: 0,
            content: 'You are {{user.name}} assistant',
          },
        ],
      });

      const warnings = checkSync(userInputInSystem, ctx);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].severity).toBe('error');
      expect(warnings[0].category).toBe('security');
    });

    it('includes position data for user input markers', () => {
      const content = 'You are {{user.name}} assistant';
      const ctx = createLintContext({
        text: content,
        sections: [
          {
            type: 'identity',
            cacheable: true,
            priority: 0,
            content,
          },
        ],
      });

      const warnings = checkSync(userInputInSystem, ctx);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].position).toBeDefined();
      expect(warnings[0].position?.line).toBe(1);
      expect(warnings[0].position?.column).toBeGreaterThan(1);
    });

    it('allows user input markers in context sections', () => {
      const ctx = createLintContext({
        sections: [
          {
            type: 'context',
            cacheable: false,
            priority: 0,
            content: 'User: {{user.message}}',
          },
        ],
      });

      const warnings = checkSync(userInputInSystem, ctx);
      expect(warnings).toHaveLength(0);
    });

    it('detects various user input patterns', () => {
      const patterns = [
        '{{user.input}}',
        '$user.message',
        'user_input here',
        '<user_input>test</user_input>',
        '[USER INPUT]',
      ];

      for (const pattern of patterns) {
        const ctx = createLintContext({
          sections: [
            {
              type: 'identity',
              cacheable: true,
              priority: 0,
              content: pattern,
            },
          ],
        });

        const warnings = checkSync(userInputInSystem, ctx);
        expect(warnings.length).toBeGreaterThan(0);
      }
    });
  });

  describe('emptySections', () => {
    it('warns about empty sections', () => {
      const ctx = createLintContext({
        sections: [
          { type: 'identity', cacheable: true, priority: 0, content: '' },
          { type: 'format', cacheable: true, priority: 1, content: '   ' },
        ],
      });

      const warnings = checkSync(emptySections, ctx);
      expect(warnings).toHaveLength(2);
      expect(warnings[0].category).toBe('best-practice');
    });

    it('does not warn about sections with content', () => {
      const ctx = createLintContext({
        sections: [
          {
            type: 'identity',
            cacheable: true,
            priority: 0,
            content: 'You are helpful',
          },
        ],
      });

      const warnings = checkSync(emptySections, ctx);
      expect(warnings).toHaveLength(0);
    });

    it('does not warn about dynamic sections', () => {
      const ctx = createLintContext({
        sections: [
          {
            type: 'context',
            cacheable: false,
            priority: 0,
            content: () => 'dynamic',
          },
        ],
      });

      const warnings = checkSync(emptySections, ctx);
      expect(warnings).toHaveLength(0);
    });
  });

  describe('conflictingPatterns', () => {
    it('detects always/never conflicts', () => {
      const ctx = createLintContext({
        text: 'Always respond in English. Never respond in English.',
      });

      const warnings = checkSync(conflictingPatterns, ctx);
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].category).toBe('contradiction');
    });

    it('detects concise vs detailed conflict', () => {
      const ctx = createLintContext({
        text: 'Be concise in your responses. Provide detailed explanations.',
      });

      const warnings = checkSync(conflictingPatterns, ctx);
      expect(warnings.length).toBeGreaterThan(0);
    });

    it('does not warn for non-conflicting instructions', () => {
      const ctx = createLintContext({
        text: 'Always be helpful. Never be rude.',
      });

      const warnings = checkSync(conflictingPatterns, ctx);
      expect(warnings).toHaveLength(0);
    });
  });
});

describe('Linter Integration', () => {
  it('can lint a real prompt', async () => {
    const testPrompt = prompt('test-agent')
      .model('claude-sonnet-4-20250514')
      .identity('You are a helpful assistant.')
      .constraints(['Be concise', 'Be accurate'])
      .format('Respond in JSON format.')
      .build();

    const { text, meta } = await testPrompt.render();

    const ctx = createLintContext({
      text,
      sections: testPrompt.sections,
      tokenCount: meta.tokenCount,
    });

    // Run all rules (using checkSync since heuristic rules are synchronous)
    const allWarnings = [
      ...checkSync(tokenLimitExceeded, ctx),
      ...checkSync(tokenLimitWarning, ctx),
      ...checkSync(xmlTagsWithGpt, ctx),
      ...checkSync(markdownWithClaude, ctx),
      ...checkSync(dynamicBeforeStatic, ctx),
      ...checkSync(missingIdentity, ctx),
      ...checkSync(formatNotLast, ctx),
      ...checkSync(duplicateInstructions, ctx),
      ...checkSync(userInputInSystem, ctx),
      ...checkSync(emptySections, ctx),
      ...checkSync(conflictingPatterns, ctx),
    ];

    // Should pass without errors for a well-formed prompt
    const errors = allWarnings.filter((w) => w.severity === 'error');
    expect(errors).toHaveLength(0);
  });
});
