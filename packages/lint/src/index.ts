/**
 * @promptier/lint - Linting engine for promptier
 *
 * Catch common issues in LLM prompts before runtime.
 *
 * @module @promptier/lint
 */

export { Linter, createLinter, lint } from './linter.js';
export { heuristicRules } from './rules/heuristic/index.js';
export type { LlmClient } from './llm/client.js';
export { OllamaClient } from './llm/ollama-client.js';
export { createLlmClient } from './llm/create-client.js';
export { createSemanticRule } from './llm/semantic-rules.js';
export { linterPrompt, renderLinterPrompt } from './llm/system-prompt.js';
export { parseSemanticResponse } from './llm/parser.js';

import type { LintRule } from './types.js';

export type {
  LintRule,
  LintContext,
  LinterConfig,
  LlmConfig,
  LintResult,
  RuleConfig,
  RuleSeverity,
  RuleOptions,
} from './types.js';

// Re-export core lint types for convenience
export type { LintWarning, LintSeverity, LintCategory } from '@promptier/core';

/**
 * Define a custom lint rule with type safety.
 * Use this in your promptier.config.ts file.
 *
 * @example
 * ```typescript
 * import { defineRule } from '@promptier/lint';
 *
 * export default defineConfig({
 *   lint: {
 *     custom: [
 *       defineRule({
 *         id: 'no-todos',
 *         category: 'best-practice',
 *         defaultSeverity: 'warning',
 *         description: 'No TODO comments in prompts',
 *         check: (ctx) => {
 *           if (/TODO/i.test(ctx.text)) {
 *             return [{
 *               id: 'no-todos',
 *               category: 'best-practice',
 *               severity: 'warning',
 *               message: 'Remove TODO comments before deployment',
 *             }];
 *           }
 *           return [];
 *         },
 *       }),
 *     ],
 *   },
 * });
 * ```
 */
export function defineRule(rule: LintRule): LintRule {
  return rule;
}
