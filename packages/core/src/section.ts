import { Fragment } from './fragment.js';
import type {
  SectionType,
  SectionConfig,
  SectionOptions,
  DynamicContent,
  FragmentDefinition,
  ToolDefinition,
} from './types.js';

// Default priorities for each section type
const DEFAULT_PRIORITIES: Record<SectionType, number> = {
  identity: 0,
  capabilities: 10,
  constraints: 20,
  domain: 30,
  tools: 40,
  context: 50,
  examples: 60,
  format: 70,
  custom: 50,
};

// Default cacheability for each section type
const DEFAULT_CACHEABLE: Record<SectionType, boolean> = {
  identity: true,
  capabilities: true,
  constraints: true,
  domain: true,
  tools: true,
  context: false, // Dynamic sections are not cacheable by default
  examples: true,
  format: true,
  custom: true,
};

/**
 * Section - A positioned slot in a prompt with semantic meaning
 *
 * Sections affect rendering order, caching behavior, and linting rules.
 */
export class Section {
  /**
   * Create an identity section - defines who the agent is
   */
  static identity(
    content: Fragment | string,
    options?: SectionOptions,
  ): SectionConfig {
    return Section.create('identity', content, options);
  }

  /**
   * Create a capabilities section - defines what the agent can do
   */
  static capabilities(
    content: Fragment | string | string[],
    options?: SectionOptions,
  ): SectionConfig {
    const normalizedContent = Array.isArray(content)
      ? content.map((c) => `- ${c}`).join('\n')
      : content;
    return Section.create('capabilities', normalizedContent, options);
  }

  /**
   * Create a constraints section - defines what the agent cannot do
   */
  static constraints(
    content: Fragment | string | string[],
    options?: SectionOptions,
  ): SectionConfig {
    const normalizedContent = Array.isArray(content)
      ? content.map((c) => `- ${c}`).join('\n')
      : content;
    return Section.create('constraints', normalizedContent, options);
  }

  /**
   * Create a domain section - domain-specific knowledge
   */
  static domain(
    content: Fragment | string,
    options?: SectionOptions,
  ): SectionConfig {
    return Section.create('domain', content, options);
  }

  /**
   * Create a tools section with special handling for tool definitions
   */
  static tools(
    tools: ToolDefinition[],
    options?: SectionOptions,
  ): SectionConfig {
    const content = formatTools(tools);
    return Section.create('tools', content, {
      ...options,
      cacheable: options?.cacheable ?? true,
    });
  }

  /**
   * Create a dynamic context section
   */
  static context(
    dynamicFn: DynamicContent,
    options?: SectionOptions,
  ): SectionConfig {
    return {
      type: 'context',
      priority: options?.priority ?? DEFAULT_PRIORITIES.context,
      cacheable: options?.cacheable ?? false,
      truncatable: options?.truncatable ?? false,
      maxTokens: options?.maxTokens,
      content: dynamicFn,
    };
  }

  /**
   * Create an examples section - few-shot examples
   */
  static examples(
    content: Fragment | string,
    options?: SectionOptions,
  ): SectionConfig {
    return Section.create('examples', content, options);
  }

  /**
   * Create a format section - output format instructions
   */
  static format(
    content: Fragment | string,
    options?: SectionOptions,
  ): SectionConfig {
    return Section.create('format', content, options);
  }

  /**
   * Create a custom section with user-defined type name
   */
  static custom(
    name: string,
    content: Fragment | string | DynamicContent,
    options?: SectionOptions,
  ): SectionConfig {
    const isDynamic = typeof content === 'function';

    if (isDynamic) {
      return {
        type: 'custom',
        name,
        priority: options?.priority ?? DEFAULT_PRIORITIES.custom,
        cacheable: options?.cacheable ?? false,
        truncatable: options?.truncatable ?? false,
        maxTokens: options?.maxTokens,
        content: content as DynamicContent,
      };
    }

    return {
      type: 'custom',
      name,
      priority: options?.priority ?? DEFAULT_PRIORITIES.custom,
      cacheable: options?.cacheable ?? DEFAULT_CACHEABLE.custom,
      truncatable: options?.truncatable ?? false,
      maxTokens: options?.maxTokens,
      content: normalizeContent(content as Fragment | string),
    };
  }

  /**
   * Create a section with standard settings
   */
  private static create(
    type: SectionType,
    content: Fragment | string,
    options?: SectionOptions,
  ): SectionConfig {
    return {
      type,
      priority: options?.priority ?? DEFAULT_PRIORITIES[type],
      cacheable: options?.cacheable ?? DEFAULT_CACHEABLE[type],
      truncatable: options?.truncatable ?? false,
      maxTokens: options?.maxTokens,
      content: normalizeContent(content),
    };
  }

  /**
   * Check if a section config has dynamic content
   */
  static isDynamic(section: SectionConfig): boolean {
    return typeof section.content === 'function';
  }

  /**
   * Get the fragment definition from a section (if static)
   */
  static getFragment(section: SectionConfig): FragmentDefinition | null {
    if (typeof section.content === 'function') {
      return null;
    }
    if (typeof section.content === 'string') {
      return {
        id: `anonymous-${section.type}`,
        version: '1.0.0',
        content: section.content,
      };
    }
    return section.content;
  }

  /**
   * Get a display name for the section
   */
  static getDisplayName(section: SectionConfig): string {
    if (section.name) {
      return section.name;
    }
    return section.type;
  }
}

/**
 * Normalize content to either a FragmentDefinition or keep as string
 */
function normalizeContent(
  content: Fragment | string,
): FragmentDefinition | string {
  if (content instanceof Fragment) {
    return content.toDefinition();
  }
  return content;
}

/**
 * Format tool definitions into a structured text format
 */
function formatTools(tools: ToolDefinition[]): string {
  const formatted = tools.map((tool) => {
    let text = `### ${tool.name}\n${tool.description}`;

    if (tool.parameters) {
      const params = formatParameters(tool.parameters);
      if (params) {
        text += `\n\nParameters:\n${params}`;
      }
    }

    return text;
  });

  return formatted.join('\n\n');
}

/**
 * Format tool parameters recursively
 */
function formatParameters(
  params: Record<string, unknown> | { parse?: unknown },
): string {
  // Handle Zod-like schemas (they have a parse method)
  if (params && typeof params === 'object' && 'parse' in params) {
    // For Zod schemas, we'd ideally introspect the schema
    // For now, just indicate it's a Zod schema
    return '(Zod schema - see tool documentation)';
  }

  // Handle plain object parameters
  if (typeof params === 'object' && params !== null) {
    const entries = Object.entries(params as Record<string, unknown>);
    if (entries.length === 0) return '';

    return entries
      .map(([key, value]) => {
        let valueStr: string;
        if (
          typeof value === 'string' ||
          typeof value === 'number' ||
          typeof value === 'boolean'
        ) {
          valueStr = String(value);
        } else {
          valueStr = JSON.stringify(value);
        }
        return `- ${key}: ${valueStr}`;
      })
      .join('\n');
  }

  return '';
}
