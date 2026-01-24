import { Prompt, getModelConfig, type LintWarning } from '@promptier/core';

import type {
  LinterConfig,
  LintResult,
  LintContext,
  LintRule,
  RuleConfig,
  RuleSeverity,
  RuleOptions,
} from './types.js';
import { heuristicRules } from './rules/heuristic/index.js';

/**
 * Parse rule config into severity and options
 */
function parseRuleConfig(config: RuleConfig): {
  severity: RuleSeverity;
  options?: RuleOptions;
} {
  if (Array.isArray(config)) {
    return { severity: config[0], options: config[1] };
  }
  return { severity: config };
}

/**
 * Parse inline ignore directives from text
 *
 * Supported formats:
 * - <!-- promptier-ignore rule-id --> or <!-- promptier-ignore rule-id, other-rule -->
 * - <!-- promptier-ignore-all -->
 * - [promptier-ignore: rule-id] or [promptier-ignore: rule-id, other-rule]
 * - [promptier-ignore-all]
 */
function parseIgnoredRules(text: string): Set<string> {
  const ignored = new Set<string>();

  // Check for ignore-all
  if (
    /<!--\s*promptier-ignore-all\s*-->/i.test(text) ||
    /\[promptier-ignore-all\]/i.test(text)
  ) {
    ignored.add('*');
    return ignored;
  }

  // Parse XML-style: <!-- promptier-ignore rule-id, rule-id2 -->
  const xmlMatches = text.matchAll(
    /<!--\s*promptier-ignore\s+([\w-]+(?:\s*,\s*[\w-]+)*)\s*-->/gi,
  );
  for (const match of xmlMatches) {
    const rules = match[1].split(/\s*,\s*/);
    for (const rule of rules) {
      ignored.add(rule.trim());
    }
  }

  // Parse bracket-style: [promptier-ignore: rule-id, rule-id2]
  const bracketMatches = text.matchAll(
    /\[promptier-ignore:\s*([\w-]+(?:\s*,\s*[\w-]+)*)\]/gi,
  );
  for (const match of bracketMatches) {
    const rules = match[1].split(/\s*,\s*/);
    for (const rule of rules) {
      ignored.add(rule.trim());
    }
  }

  return ignored;
}

/**
 * Linter - Main class for running lint rules on prompts
 */
export class Linter {
  private rules: Map<string, LintRule> = new Map();
  private ruleConfig: Map<string, RuleConfig> = new Map();

  constructor(config: LinterConfig = {}) {
    // Register all heuristic rules
    for (const rule of heuristicRules) {
      this.rules.set(rule.id, rule);
      this.ruleConfig.set(
        rule.id,
        config.rules?.[rule.id] ?? rule.defaultSeverity,
      );
    }

    // Register custom rules
    if (config.custom) {
      for (const rule of config.custom) {
        this.rules.set(rule.id, rule);
        this.ruleConfig.set(
          rule.id,
          config.rules?.[rule.id] ?? rule.defaultSeverity,
        );
      }
    }

    // Apply rule configuration
    if (config.rules) {
      for (const [ruleId, severity] of Object.entries(config.rules)) {
        this.ruleConfig.set(ruleId, severity);
      }
    }

    // LLM config reserved for future semantic linting
    // this.llmConfig = config.llm;
  }

  /**
   * Lint a prompt and return all warnings
   */
  async lint(prompt: Prompt): Promise<LintResult> {
    const startTime = Date.now();
    let llmCalls = 0;

    // Render the prompt to get the full text
    const { text, meta } = await prompt.render();

    // Parse inline ignore directives
    const ignoredRules = parseIgnoredRules(text);
    const ignoreAll = ignoredRules.has('*');

    // Build lint context
    const modelConfig = getModelConfig(prompt.model);
    const context: LintContext = {
      prompt,
      text,
      sections: prompt.sections,
      modelId: prompt.model,
      modelConfig: {
        contextWindow: modelConfig.contextWindow,
        preferredFormat: modelConfig.preferredFormat,
        supportsCaching: modelConfig.supportsCaching,
      },
      tokenCount: meta.tokenCount,
    };

    // Run all enabled rules
    const allWarnings: LintWarning[] = [];
    let rulesChecked = 0;

    for (const [ruleId, rule] of this.rules) {
      const ruleConfig = this.ruleConfig.get(ruleId);
      if (!ruleConfig) continue;

      const { severity, options } = parseRuleConfig(ruleConfig);
      if (severity === 'off') continue;

      // Skip if ignored via inline directive
      if (ignoreAll || ignoredRules.has(ruleId)) continue;

      rulesChecked++;

      try {
        // Create context with rule-specific options
        const ruleContext: LintContext = options
          ? { ...context, options }
          : context;

        const warnings = await rule.check(ruleContext);

        // Apply configured severity
        for (const warning of warnings) {
          if (
            severity === 'error' ||
            severity === 'warning' ||
            severity === 'info'
          ) {
            warning.severity = severity;
          }
          allWarnings.push(warning);
        }
      } catch (error) {
        // Log rule error but continue
        console.warn(`Lint rule '${ruleId}' failed:`, error);
      }
    }

    // Separate by severity
    const errors = allWarnings.filter((w) => w.severity === 'error');
    const warnings = allWarnings.filter((w) => w.severity === 'warning');
    const info = allWarnings.filter((w) => w.severity === 'info');

    return {
      passed: errors.length === 0,
      errors,
      warnings,
      info,
      stats: {
        rulesChecked,
        timeMs: Date.now() - startTime,
        llmCalls,
      },
    };
  }

  /**
   * Add a custom lint rule
   */
  addRule(rule: LintRule, severity?: RuleConfig): void {
    this.rules.set(rule.id, rule);
    this.ruleConfig.set(rule.id, severity ?? rule.defaultSeverity);
  }

  /**
   * Configure a rule's severity
   */
  configureRule(ruleId: string, severity: RuleConfig): void {
    this.ruleConfig.set(ruleId, severity);
  }

  /**
   * Disable a rule
   */
  disableRule(ruleId: string): void {
    this.ruleConfig.set(ruleId, 'off');
  }

  /**
   * Get all registered rule IDs
   */
  getRuleIds(): string[] {
    return [...this.rules.keys()];
  }

  /**
   * Get rule configuration
   */
  getRuleConfig(ruleId: string): RuleConfig | undefined {
    return this.ruleConfig.get(ruleId);
  }
}

/**
 * Create a configured linter instance
 */
export function createLinter(config: LinterConfig = {}): Linter {
  return new Linter(config);
}

/**
 * Quick lint function for simple use cases
 */
export async function lint(prompt: Prompt): Promise<LintWarning[]> {
  const linter = new Linter();
  const result = await linter.lint(prompt);
  return [...result.errors, ...result.warnings, ...result.info];
}
