/**
 * promptier - Trace your prompts
 *
 * Compose, lint, and debug LLM system prompts across multiple agents.
 *
 * @module @promptier/core
 */

// Core classes
export { Fragment } from './fragment.js';
export { Section } from './section.js';
export { Prompt, prompt, PromptBuilder } from './prompt.js';
export { SourceMap } from './source-map.js';

// Config helper
import type { promptierConfig } from './types.js';

/**
 * Define a promptier configuration with type safety.
 * Use this in your promptier.config.ts file.
 *
 * @example
 * ```typescript
 * import { defineConfig } from '@promptier/core';
 *
 * export default defineConfig({
 *   name: 'my-project',
 *   defaultModel: 'claude-sonnet-4-20250514',
 * });
 * ```
 */
export function defineConfig(config: promptierConfig): promptierConfig {
  return config;
}

// Model utilities
export {
  models,
  getModelConfig,
  registerModel,
  supportsCaching,
  getPreferredFormat,
  getContextWindow,
  detectModelFamily,
  isKnownModelFamily,
  isValidModel,
} from './models/index.js';

// Format utilities
export {
  getFormatterForModel,
  formatForModel,
  createFormatter,
  XmlFormatter,
  MarkdownFormatter,
  PlainFormatter,
  createXmlFormatter,
  createMarkdownFormatter,
  createPlainFormatter,
} from './format/index.js';

// Token utilities
export {
  countTokens,
  estimateTokens,
  createTokenCounter,
  exceedsContextWindow,
  truncateToTokenLimit,
} from './tokens.js';

// Types
export type {
  // Model types
  ModelIdentifier,
  ModelConfig,

  // Section types
  SectionType,
  SectionConfig,
  SectionOptions,

  // Fragment types
  FragmentDefinition,
  FragmentMetadata,
  FragmentOptions,

  // Prompt types
  PromptConfig,
  PromptOptions,
  CompiledPrompt,
  PromptMetadata,

  // Render types
  RenderContext,
  DynamicContent,
  RenderedSection,
  ChatMessage,

  // Source map types
  SourceMapData,
  SourceMapping,
  FragmentReference,

  // Lint types
  LintWarning,
  LintSeverity,
  LintCategory,

  // Tool types
  ToolDefinition,
  ToolParameter,

  // Formatter types
  Formatter,

  // Config types
  promptierConfig,
} from './types.js';
