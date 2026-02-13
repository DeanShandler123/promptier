/**
 * Core types for promptier SDK
 */

/**
 * Model identifier - accepts any string
 *
 * The SDK will infer the model family from patterns in the string:
 * - Contains "claude" → Anthropic (XML format)
 * - Contains "gpt" or "openai" → OpenAI (Markdown format)
 * - Contains "gemini" → Google (Markdown format)
 *
 * Works with any provider naming convention:
 * - Direct API: "claude-sonnet-4-20250514"
 * - Vertex AI: "claude-sonnet-4-5@20250929"
 * - Bedrock: "anthropic.claude-sonnet-4-5-20250929-v1:0"
 * - Azure: "my-gpt4-deployment"
 * - Custom: "my-local-model"
 */
export type ModelIdentifier = string;

// Section types with semantic meaning
export type SectionType =
  | 'identity' // Who the agent is
  | 'capabilities' // What it can do
  | 'constraints' // What it cannot do
  | 'context' // Dynamic runtime context
  | 'domain' // Domain-specific knowledge
  | 'tools' // Tool definitions
  | 'format' // Output format instructions
  | 'examples' // Few-shot examples
  | 'custom'; // User-defined

// Fragment metadata
export interface FragmentMetadata {
  description?: string;
  author?: string;
  tags?: string[];
  deprecated?: boolean;
  supersededBy?: string;
}

// Fragment definition
export interface FragmentDefinition {
  id: string;
  version: string;
  content: string;
  metadata?: FragmentMetadata;
  sourceFile?: string;
  sourceLine?: number;
}

// Fragment content options for define()
export interface FragmentOptions {
  content: string;
  version?: string;
  description?: string;
  author?: string;
  tags?: string[];
  deprecated?: boolean;
  supersededBy?: string;
}

// Render context passed to dynamic sections
export interface RenderContext {
  [key: string]: unknown;
  $model?: ModelIdentifier;
  $now?: Date;
  $tokenBudget?: number;
}

// Dynamic content function type
export type DynamicContent = (ctx: RenderContext) => string | Promise<string>;

// Section options
export interface SectionOptions {
  priority?: number;
  cacheable?: boolean;
  truncatable?: boolean;
  maxTokens?: number;
}

// Section configuration
export interface SectionConfig {
  type: SectionType;
  name?: string;
  priority: number;
  cacheable: boolean;
  truncatable: boolean;
  maxTokens?: number;
  content: FragmentDefinition | DynamicContent | string;
}

// Tool parameter definition (compatible with Zod-like schemas)
export interface ToolParameter {
  type: string;
  description?: string;
  required?: boolean;
  enum?: string[];
  properties?: Record<string, ToolParameter>;
}

// Tool definition
export interface ToolDefinition {
  name: string;
  description: string;
  parameters?:
    | Record<string, unknown>
    | { parse?: (input: unknown) => unknown };
}

// Prompt configuration
export interface PromptConfig {
  name: string;
  model: ModelIdentifier;
  sections: SectionConfig[];
  options?: PromptOptions;
}

// Prompt options
export interface PromptOptions {
  maxTokens?: number;
  cacheOptimize?: boolean;
  formatForModel?: boolean;
  /**
   * Override the inferred format. By default, format is inferred from model name:
   * - "claude" in name → xml
   * - "gpt"/"openai" in name → markdown
   * - "gemini" in name → markdown
   * - unknown → plain
   */
  format?: 'xml' | 'markdown' | 'plain';
}

// Source mapping for tracing
export interface SourceMapping {
  output: {
    start: number;
    end: number;
    line: number;
    column: number;
  };
  source: {
    type: 'fragment' | 'dynamic' | 'literal' | 'generated';
    fragmentId?: string;
    fragmentVersion?: string;
    sectionType?: SectionType;
    sectionIndex?: number;
    file?: string;
    fileLine?: number;
    fileColumn?: number;
    dynamicKey?: string;
  };
}

// Source map structure
export interface SourceMapData {
  version: 1;
  prompt: string;
  mappings: SourceMapping[];
}

// Fragment reference in metadata
export interface FragmentReference {
  id: string;
  version: string;
  sectionType: SectionType;
  sectionIndex: number;
}

// Lint warning
export interface LintWarning {
  id: string;
  category: LintCategory;
  severity: LintSeverity;
  message: string;
  position?: {
    start: number;
    end: number;
    line: number;
    column: number;
  };
  fragments?: string[];
  suggestion?: string;
  evidence?: string;
}

export type LintSeverity = 'error' | 'warning' | 'info';

export type LintCategory =
  | 'contradiction'
  | 'ambiguity'
  | 'model-mismatch'
  | 'cache-inefficiency'
  | 'token-budget'
  | 'ordering'
  | 'duplication'
  | 'deprecated'
  | 'security'
  | 'best-practice';

// Prompt metadata returned after rendering
export interface PromptMetadata {
  name: string;
  model: ModelIdentifier;
  tokenCount: number;
  tokensBySection: Record<string, number>;
  sourceMap: SourceMapData;
  warnings: LintWarning[];
  cacheablePrefix: number; // Characters (deprecated, use cacheableTokens)
  cacheableTokens: number; // Actual token count for cacheable sections
  fragments: FragmentReference[];
}

// Compiled prompt result
export interface CompiledPrompt {
  text: string;
  messages?: ChatMessage[];
  meta: PromptMetadata;
}

// Chat message format (basic)
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Model configuration
export interface ModelConfig {
  id: ModelIdentifier;
  contextWindow: number;
  preferredFormat: 'xml' | 'markdown' | 'plain';
  supportsSystemPrompt: boolean;
  supportsCaching: boolean;
  cacheConfig?: {
    minPrefixTokens: number;
    costMultiplier: number;
  };
  tokenizer: 'cl100k_base' | 'o200k_base' | 'custom';
  customTokenizer?: (text: string) => number;
}

// Formatter interface
export interface Formatter {
  format(sections: RenderedSection[]): string;
  formatSection(section: RenderedSection): string;
}

// Rendered section (after content resolution)
export interface RenderedSection {
  type: SectionType;
  name?: string;
  content: string;
  priority: number;
  cacheable: boolean;
  sourceMapping: SourceMapping;
}

// Config file structure
export interface promptierConfig {
  name?: string;
  root?: string;
  fragments?: {
    dirs?: string[];
    pattern?: string;
  };
  prompts?: {
    dirs?: string[];
    pattern?: string;
  };
  defaultModel?: ModelIdentifier;
  lint?: {
    rules?: Record<string, 'error' | 'warning' | 'info' | 'off'>;
    /** Custom lint rules - use defineRule() from @promptier/lint */
    custom?: unknown[];
    llm?: {
      enabled?: boolean;
      provider?: 'ollama' | 'openai' | 'ai-sdk' | (string & {});
      model?: string;
      host?: string;
      timeout?: number;
    };
  };
  output?: {
    formatForModel?: boolean;
    cacheOptimize?: boolean;
    includeSourceMap?: boolean;
  };
}
