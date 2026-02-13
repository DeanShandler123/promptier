import type {
  Prompt,
  LintWarning,
  LintSeverity,
  LintCategory,
  SectionConfig,
} from '@promptier/core';

import type { LlmClient } from './llm/client.js';

/**
 * Rule severity level
 */
export type RuleSeverity = 'error' | 'warning' | 'info' | 'off';

/**
 * Rule-specific options (varies by rule)
 */
export interface RuleOptions {
  /** Threshold for token-limit-warning (0-1, default 0.8) */
  threshold?: number;
  /** Generic options for custom rules */
  [key: string]: unknown;
}

/**
 * Lint rule configuration - either just severity or [severity, options]
 */
export type RuleConfig = RuleSeverity | [RuleSeverity, RuleOptions];

/**
 * Lint rule definition
 */
export interface LintRule {
  id: string;
  category: LintCategory;
  defaultSeverity: LintSeverity;
  description: string;
  check: (context: LintContext) => LintWarning[] | Promise<LintWarning[]>;
}

/**
 * Context passed to lint rules
 */
export interface LintContext {
  prompt: Prompt;
  text: string;
  sections: SectionConfig[];
  modelId: string;
  modelConfig: {
    contextWindow: number;
    preferredFormat: 'xml' | 'markdown' | 'plain';
    supportsCaching: boolean;
  };
  tokenCount: number;
  /** Rule-specific options from config */
  options?: RuleOptions;
}

/**
 * Linter configuration
 */
export interface LinterConfig {
  rules?: Record<string, RuleConfig>;
  llm?: LlmConfig;
  custom?: LintRule[];
}

/**
 * LLM configuration for semantic linting
 */
export interface LlmConfig {
  enabled?: boolean;
  provider?: 'ollama' | 'openai' | 'ai-sdk' | (string & {});
  model?: string;
  host?: string;
  timeout?: number;
  /** Pre-built LLM client. When provided, bypasses the built-in provider factory. */
  client?: LlmClient;
}

/**
 * Lint result
 */
export interface LintResult {
  passed: boolean;
  errors: LintWarning[];
  warnings: LintWarning[];
  info: LintWarning[];
  stats: {
    rulesChecked: number;
    timeMs: number;
    llmCalls: number;
  };
}
