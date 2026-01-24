import { describe, it, expect } from 'vitest';
import { prompt } from '@promptier/core';

import { Linter, createLinter, lint, defineRule } from '../index.js';
import type { LintRule } from '../types.js';

describe('Linter', () => {
  describe('constructor', () => {
    it('initializes with default rules', () => {
      const linter = new Linter();
      const ruleIds = linter.getRuleIds();

      expect(ruleIds).toContain('token-limit-exceeded');
      expect(ruleIds).toContain('missing-identity');
      expect(ruleIds).toContain('empty-sections');
      expect(ruleIds.length).toBeGreaterThan(5);
    });

    it('accepts custom rule configuration', () => {
      const linter = new Linter({
        rules: {
          'token-limit-exceeded': 'warning',
          'missing-identity': 'off',
        },
      });

      expect(linter.getRuleConfig('token-limit-exceeded')).toBe('warning');
      expect(linter.getRuleConfig('missing-identity')).toBe('off');
    });

    it('registers custom rules', () => {
      const customRule: LintRule = {
        id: 'custom-test-rule',
        category: 'best-practice',
        defaultSeverity: 'info',
        description: 'Test rule',
        check: () => [],
      };

      const linter = new Linter({ custom: [customRule] });
      expect(linter.getRuleIds()).toContain('custom-test-rule');
    });
  });

  describe('lint', () => {
    it('lints a valid prompt without errors', async () => {
      const testPrompt = prompt('test-agent')
        .model('claude-sonnet-4-20250514')
        .identity('You are a helpful assistant.')
        .format('Respond clearly.')
        .build();

      const linter = new Linter();
      const result = await linter.lint(testPrompt);

      expect(result.passed).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.stats.rulesChecked).toBeGreaterThan(0);
    });

    it('detects missing identity', async () => {
      const testPrompt = prompt('test-agent')
        .model('claude-sonnet-4-20250514')
        .format('Respond in JSON.')
        .build();

      const linter = new Linter();
      const result = await linter.lint(testPrompt);

      const missingIdentityWarning = result.warnings.find(
        (w) => w.id === 'missing-identity',
      );
      expect(missingIdentityWarning).toBeDefined();
    });

    it('returns timing stats', async () => {
      const testPrompt = prompt('test-agent')
        .model('claude-sonnet-4-20250514')
        .identity('You are helpful.')
        .build();

      const linter = new Linter();
      const result = await linter.lint(testPrompt);

      expect(result.stats.timeMs).toBeGreaterThanOrEqual(0);
      expect(result.stats.rulesChecked).toBeGreaterThan(0);
    });

    it('respects disabled rules', async () => {
      const testPrompt = prompt('test-agent')
        .model('claude-sonnet-4-20250514')
        .format('Respond in JSON.')
        .build();

      const linter = new Linter({
        rules: { 'missing-identity': 'off' },
      });
      const result = await linter.lint(testPrompt);

      const missingIdentityWarning = result.warnings.find(
        (w) => w.id === 'missing-identity',
      );
      expect(missingIdentityWarning).toBeUndefined();
    });

    it('applies configured severity', async () => {
      const testPrompt = prompt('test-agent')
        .model('claude-sonnet-4-20250514')
        .format('Respond in JSON.')
        .build();

      const linter = new Linter({
        rules: { 'missing-identity': 'error' },
      });
      const result = await linter.lint(testPrompt);

      expect(result.passed).toBe(false);
      const missingIdentityError = result.errors.find(
        (w) => w.id === 'missing-identity',
      );
      expect(missingIdentityError).toBeDefined();
    });
  });

  describe('addRule', () => {
    it('adds a custom rule', async () => {
      const customRule: LintRule = {
        id: 'no-shouting',
        category: 'best-practice',
        defaultSeverity: 'warning',
        description: 'Warns about ALL CAPS text',
        check: (ctx) => {
          if (/[A-Z]{5,}/.test(ctx.text)) {
            return [
              {
                id: 'no-shouting',
                category: 'best-practice',
                severity: 'warning',
                message: 'Avoid excessive capitalization',
              },
            ];
          }
          return [];
        },
      };

      const linter = new Linter();
      linter.addRule(customRule);

      const testPrompt = prompt('test-agent')
        .model('claude-sonnet-4-20250514')
        .identity('You are EXTREMELY HELPFUL!')
        .build();

      const result = await linter.lint(testPrompt);
      const shoutingWarning = result.warnings.find(
        (w) => w.id === 'no-shouting',
      );
      expect(shoutingWarning).toBeDefined();
    });
  });

  describe('configureRule', () => {
    it('changes rule severity', () => {
      const linter = new Linter();
      linter.configureRule('token-limit-exceeded', 'warning');
      expect(linter.getRuleConfig('token-limit-exceeded')).toBe('warning');
    });
  });

  describe('disableRule', () => {
    it('disables a rule', () => {
      const linter = new Linter();
      linter.disableRule('missing-identity');
      expect(linter.getRuleConfig('missing-identity')).toBe('off');
    });
  });
});

describe('createLinter', () => {
  it('creates a configured linter', () => {
    const linter = createLinter({
      rules: { 'token-limit-exceeded': 'warning' },
    });

    expect(linter).toBeInstanceOf(Linter);
    expect(linter.getRuleConfig('token-limit-exceeded')).toBe('warning');
  });
});

describe('lint function', () => {
  it('provides quick linting', async () => {
    const testPrompt = prompt('test-agent')
      .model('claude-sonnet-4-20250514')
      .identity('You are helpful.')
      .format('Respond clearly.')
      .build();

    const warnings = await lint(testPrompt);
    expect(Array.isArray(warnings)).toBe(true);
  });
});

describe('defineRule', () => {
  it('returns the rule unchanged (type helper)', () => {
    const rule = defineRule({
      id: 'test-rule',
      category: 'best-practice',
      defaultSeverity: 'warning',
      description: 'A test rule',
      check: () => [],
    });

    expect(rule.id).toBe('test-rule');
    expect(rule.category).toBe('best-practice');
    expect(rule.defaultSeverity).toBe('warning');
    expect(typeof rule.check).toBe('function');
  });

  it('works with Linter constructor', async () => {
    const customRule = defineRule({
      id: 'no-placeholder',
      category: 'best-practice',
      defaultSeverity: 'error',
      description: 'No placeholder text',
      check: (ctx) => {
        if (/\[placeholder\]/i.test(ctx.text)) {
          return [
            {
              id: 'no-placeholder',
              category: 'best-practice',
              severity: 'error',
              message: 'Remove placeholder text',
            },
          ];
        }
        return [];
      },
    });

    const linter = new Linter({ custom: [customRule] });
    expect(linter.getRuleIds()).toContain('no-placeholder');

    const testPrompt = prompt('test-agent')
      .model('claude-sonnet-4-20250514')
      .identity('You are a [placeholder] assistant.')
      .build();

    const result = await linter.lint(testPrompt);
    expect(result.errors.some((e) => e.id === 'no-placeholder')).toBe(true);
  });

  it('respects severity override from config', async () => {
    const customRule = defineRule({
      id: 'custom-check',
      category: 'best-practice',
      defaultSeverity: 'error',
      description: 'Custom check',
      check: () => [
        {
          id: 'custom-check',
          category: 'best-practice',
          severity: 'error',
          message: 'Custom check triggered',
        },
      ],
    });

    const linter = new Linter({
      custom: [customRule],
      rules: { 'custom-check': 'warning' },
    });

    const testPrompt = prompt('test-agent')
      .model('claude-sonnet-4-20250514')
      .identity('Test')
      .build();

    const result = await linter.lint(testPrompt);

    // Should be in warnings, not errors, due to override
    expect(result.warnings.some((w) => w.id === 'custom-check')).toBe(true);
    expect(result.errors.some((e) => e.id === 'custom-check')).toBe(false);
  });

  it('can be disabled via config', async () => {
    const customRule = defineRule({
      id: 'always-fires',
      category: 'best-practice',
      defaultSeverity: 'warning',
      description: 'Always fires',
      check: () => [
        {
          id: 'always-fires',
          category: 'best-practice',
          severity: 'warning',
          message: 'This always fires',
        },
      ],
    });

    const linter = new Linter({
      custom: [customRule],
      rules: { 'always-fires': 'off' },
    });

    const testPrompt = prompt('test-agent')
      .model('claude-sonnet-4-20250514')
      .identity('Test')
      .build();

    const result = await linter.lint(testPrompt);
    expect(result.warnings.some((w) => w.id === 'always-fires')).toBe(false);
  });
});

describe('inline ignore directives', () => {
  it('ignores specific rule with XML comment', async () => {
    const testPrompt = prompt('test-agent')
      .model('claude-sonnet-4-20250514')
      .identity('<!-- promptier-ignore missing-identity -->')
      .build();

    const linter = new Linter();
    const result = await linter.lint(testPrompt);

    // missing-identity should not fire because of inline ignore
    // (even though identity section exists, we're testing the ignore mechanism)
    expect(result.warnings.some((w) => w.id === 'missing-identity')).toBe(
      false,
    );
  });

  it('ignores specific rule with bracket syntax', async () => {
    const testPrompt = prompt('test-agent')
      .model('claude-sonnet-4-20250514')
      .format('[promptier-ignore: missing-identity]')
      .build();

    const linter = new Linter();
    const result = await linter.lint(testPrompt);

    expect(result.warnings.some((w) => w.id === 'missing-identity')).toBe(
      false,
    );
  });

  it('ignores multiple rules with comma separation', async () => {
    const testPrompt = prompt('test-agent')
      .model('claude-sonnet-4-20250514')
      .format('<!-- promptier-ignore missing-identity, format-not-last -->')
      .build();

    const linter = new Linter();
    const result = await linter.lint(testPrompt);

    expect(result.warnings.some((w) => w.id === 'missing-identity')).toBe(
      false,
    );
    expect(result.info.some((w) => w.id === 'format-not-last')).toBe(false);
  });

  it('ignores all rules with ignore-all directive', async () => {
    const testPrompt = prompt('test-agent')
      .model('claude-sonnet-4-20250514')
      .format('<!-- promptier-ignore-all -->')
      .build();

    const linter = new Linter();
    const result = await linter.lint(testPrompt);

    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.info).toHaveLength(0);
  });

  it('ignores all rules with bracket ignore-all', async () => {
    const testPrompt = prompt('test-agent')
      .model('claude-sonnet-4-20250514')
      .format('[promptier-ignore-all]')
      .build();

    const linter = new Linter();
    const result = await linter.lint(testPrompt);

    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.info).toHaveLength(0);
  });

  it('is case insensitive', async () => {
    const testPrompt = prompt('test-agent')
      .model('claude-sonnet-4-20250514')
      .format('<!-- PROMPTIER-IGNORE missing-identity -->')
      .build();

    const linter = new Linter();
    const result = await linter.lint(testPrompt);

    expect(result.warnings.some((w) => w.id === 'missing-identity')).toBe(
      false,
    );
  });
});

describe('rule options', () => {
  it('supports tuple config with options', () => {
    const linter = new Linter({
      rules: {
        'token-limit-warning': ['warning', { threshold: 0.7 }],
      },
    });

    const config = linter.getRuleConfig('token-limit-warning');
    expect(Array.isArray(config)).toBe(true);
    if (Array.isArray(config)) {
      expect(config[0]).toBe('warning');
      expect(config[1]).toEqual({ threshold: 0.7 });
    }
  });

  it('token-limit-warning uses custom threshold', async () => {
    // Use a small model context to test threshold behavior
    // We'll just verify the config is parsed and passed correctly
    const testPrompt = prompt('test-agent')
      .model('claude-sonnet-4-20250514')
      .identity('You are helpful.')
      .build();

    // Default threshold (80%)
    const linterDefault = new Linter({
      rules: { 'missing-identity': 'off' },
    });
    const resultDefault = await linterDefault.lint(testPrompt);

    // Custom threshold (70%) - verifies tuple config works
    const linterCustom = new Linter({
      rules: {
        'missing-identity': 'off',
        'token-limit-warning': ['warning', { threshold: 0.7 }],
      },
    });
    const resultCustom = await linterCustom.lint(testPrompt);

    // Both should complete without error
    expect(resultDefault).toBeDefined();
    expect(resultCustom).toBeDefined();

    // Verify the tuple config was stored correctly
    const config = linterCustom.getRuleConfig('token-limit-warning');
    expect(Array.isArray(config)).toBe(true);
    if (Array.isArray(config)) {
      expect(config[1]?.threshold).toBe(0.7);
    }
  });

  it('passes options to custom rules', async () => {
    const customRule = defineRule({
      id: 'custom-with-options',
      category: 'best-practice',
      defaultSeverity: 'warning',
      description: 'Test rule with options',
      check: (ctx) => {
        const minLength = (ctx.options?.minLength as number) ?? 100;
        if (ctx.text.length < minLength) {
          return [
            {
              id: 'custom-with-options',
              category: 'best-practice',
              severity: 'warning',
              message: `Text too short (min: ${minLength})`,
            },
          ];
        }
        return [];
      },
    });

    const testPrompt = prompt('test-agent')
      .model('claude-sonnet-4-20250514')
      .identity('Short')
      .build();

    // With default (100 chars) - should warn
    const linterDefault = new Linter({
      custom: [customRule],
      rules: { 'missing-identity': 'off' },
    });
    const resultDefault = await linterDefault.lint(testPrompt);
    expect(
      resultDefault.warnings.some((w) => w.id === 'custom-with-options'),
    ).toBe(true);

    // With low threshold (10 chars) - should not warn
    const linterLow = new Linter({
      custom: [customRule],
      rules: {
        'missing-identity': 'off',
        'custom-with-options': ['warning', { minLength: 10 }],
      },
    });
    const resultLow = await linterLow.lint(testPrompt);
    expect(resultLow.warnings.some((w) => w.id === 'custom-with-options')).toBe(
      false,
    );
  });
});
