import { Section } from './section.js';
import { Fragment } from './fragment.js';
import { SourceMap } from './source-map.js';
import { getModelConfig } from './models/index.js';
import { getFormatterForModel, createFormatter } from './format/index.js';
import { countTokens } from './tokens.js';
import type {
  ModelIdentifier,
  PromptConfig,
  PromptOptions,
  SectionConfig,
  SectionType,
  CompiledPrompt,
  PromptMetadata,
  RenderContext,
  FragmentReference,
  FragmentDefinition,
  RenderedSection,
  LintWarning,
  DynamicContent,
} from './types.js';

/**
 * Prompt - A composed collection of sections targeting a specific model
 *
 * Prompts are the unit of deployment - they combine fragments and sections
 * into a complete system prompt that can be rendered for a specific context.
 */
export class Prompt {
  readonly name: string;
  readonly model: ModelIdentifier;
  readonly sections: SectionConfig[];
  readonly options: PromptOptions;

  private constructor(config: PromptConfig) {
    this.name = config.name;
    this.model = config.model;
    this.sections = config.sections;
    this.options = config.options ?? {};
  }

  /**
   * Compose a new prompt from configuration
   */
  static compose(config: PromptConfig): Prompt {
    return new Prompt(config);
  }

  /**
   * Render the prompt to a string with full metadata
   */
  async render(context: RenderContext = {}): Promise<CompiledPrompt> {
    // Enrich context with built-in helpers
    const enrichedContext: RenderContext = {
      ...context,
      $model: this.model,
      $now: new Date(),
      $tokenBudget:
        this.options.maxTokens ?? getModelConfig(this.model).contextWindow,
    };

    // Resolve sections in order
    const resolvedSections = await this.resolveSections(enrichedContext);

    // Optionally reorder for cache optimization
    const orderedSections =
      this.options.cacheOptimize !== false
        ? this.optimizeForCaching(resolvedSections)
        : resolvedSections;

    // Format based on explicit option, model preference, or skip if disabled
    let formatter: { format: (sections: RenderedSection[]) => string };
    if (this.options.formatForModel === false) {
      formatter = {
        format: (sections: RenderedSection[]) =>
          sections.map((s) => s.content).join('\n\n'),
      };
    } else if (this.options.format) {
      // Explicit format override
      formatter = createFormatter(this.options.format);
    } else {
      // Infer from model
      formatter = getFormatterForModel(this.model);
    }

    const text = formatter.format(orderedSections);

    // Build source map
    const sourceMap = this.buildSourceMap(text, orderedSections);

    // Calculate metadata
    const meta = await this.buildMetadata(text, orderedSections, sourceMap);

    return { text, meta };
  }

  /**
   * Extend this prompt with additional sections
   */
  extend(config: {
    name?: string;
    sections?: SectionConfig[];
    options?: Partial<PromptOptions>;
  }): Prompt {
    return new Prompt({
      name: config.name ?? `${this.name}-extended`,
      model: this.model,
      sections: [...this.sections, ...(config.sections ?? [])],
      options: { ...this.options, ...config.options },
    });
  }

  /**
   * Override specific sections by type
   */
  override(overrides: Partial<Record<SectionType, SectionConfig>>): Prompt {
    const newSections = this.sections.map((section) => {
      const override = overrides[section.type];
      return override ?? section;
    });

    return new Prompt({
      name: this.name,
      model: this.model,
      sections: newSections,
      options: this.options,
    });
  }

  /**
   * Lint the prompt without rendering (quick validation)
   */
  lint(): LintWarning[] {
    const warnings: LintWarning[] = [];

    // Check for missing identity
    const hasIdentity = this.sections.some((s) => s.type === 'identity');
    if (!hasIdentity) {
      warnings.push({
        id: 'missing-identity',
        category: 'best-practice',
        severity: 'warning',
        message: 'No identity section. Agent may lack consistent persona.',
      });
    }

    // Check for format not being last
    const formatIndex = this.sections.findIndex((s) => s.type === 'format');
    if (formatIndex !== -1 && formatIndex !== this.sections.length - 1) {
      warnings.push({
        id: 'format-not-last',
        category: 'ordering',
        severity: 'info',
        message: 'Output format instructions work best at the end.',
      });
    }

    // Check for deprecated fragments
    for (const section of this.sections) {
      const fragment = Section.getFragment(section);
      if (fragment?.metadata?.deprecated) {
        warnings.push({
          id: 'deprecated-fragment',
          category: 'deprecated',
          severity: 'warning',
          message: `Fragment '${fragment.id}' is deprecated.`,
          fragments: [fragment.id],
          suggestion: fragment.metadata.supersededBy
            ? `Use '${fragment.metadata.supersededBy}' instead.`
            : undefined,
        });
      }
    }

    // Check for dynamic content before static (cache inefficiency)
    const firstDynamicIdx = this.sections.findIndex((s) => !s.cacheable);
    let lastCacheableIdx = -1;
    for (let i = this.sections.length - 1; i >= 0; i--) {
      if (this.sections[i].cacheable) {
        lastCacheableIdx = i;
        break;
      }
    }
    if (
      firstDynamicIdx !== -1 &&
      lastCacheableIdx !== -1 &&
      firstDynamicIdx < lastCacheableIdx
    ) {
      warnings.push({
        id: 'dynamic-before-static',
        category: 'cache-inefficiency',
        severity: 'warning',
        message:
          'Dynamic content before static content reduces cache efficiency.',
      });
    }

    return warnings;
  }

  /**
   * Get all fragment dependencies
   */
  dependencies(): string[] {
    const deps: string[] = [];

    for (const section of this.sections) {
      const fragment = Section.getFragment(section);
      if (fragment && fragment.id) {
        deps.push(fragment.id);
      }
    }

    return [...new Set(deps)];
  }

  /**
   * Get the prompt configuration
   */
  toConfig(): PromptConfig {
    return {
      name: this.name,
      model: this.model,
      sections: [...this.sections],
      options: { ...this.options },
    };
  }

  /**
   * Resolve all sections, evaluating dynamic content
   */
  private async resolveSections(
    context: RenderContext,
  ): Promise<RenderedSection[]> {
    const resolved: RenderedSection[] = [];

    for (let i = 0; i < this.sections.length; i++) {
      const section = this.sections[i];
      const content = await this.resolveContent(section.content, context);

      const fragment = Section.getFragment(section);
      resolved.push({
        type: section.type,
        name: section.name,
        content,
        priority: section.priority,
        cacheable: section.cacheable,
        sourceMapping: {
          output: { start: 0, end: 0, line: 0, column: 0 },
          source: {
            type: Section.isDynamic(section) ? 'dynamic' : 'fragment',
            sectionType: section.type,
            sectionIndex: i,
            fragmentId: this.getFragmentId(section),
            fragmentVersion: this.getFragmentVersion(section),
            file: fragment?.sourceFile,
            fileLine: fragment?.sourceLine,
          },
        },
      });
    }

    return resolved;
  }

  /**
   * Resolve content from fragment, string, or dynamic function
   */
  private async resolveContent(
    content: FragmentDefinition | DynamicContent | string,
    context: RenderContext,
  ): Promise<string> {
    if (typeof content === 'function') {
      return await content(context);
    }

    if (typeof content === 'string') {
      return this.interpolate(content, context);
    }

    // FragmentDefinition
    return this.interpolate(content.content, context);
  }

  /**
   * Interpolate template variables in content
   */
  private interpolate(content: string, context: RenderContext): string {
    return content.replace(/\{\{(\$?\w+(?:\.\w+)*)\}\}/g, (match, key) => {
      const value = this.getNestedValue(context, key);
      if (value === undefined) return match;
      if (value === null) return 'null';
      if (typeof value === 'object') {
        return JSON.stringify(value);
      }
      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ) {
        return String(value);
      }
      return JSON.stringify(value);
    });
  }

  /**
   * Get a nested value from an object using dot notation
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  /**
   * Optimize section order for prompt caching
   */
  private optimizeForCaching(sections: RenderedSection[]): RenderedSection[] {
    // Separate cacheable and non-cacheable sections
    const cacheable = sections.filter((s) => s.cacheable);
    const nonCacheable = sections.filter((s) => !s.cacheable);

    // Sort each group by priority
    cacheable.sort((a, b) => a.priority - b.priority);
    nonCacheable.sort((a, b) => a.priority - b.priority);

    // Cacheable sections first, then non-cacheable
    return [...cacheable, ...nonCacheable];
  }

  /**
   * Build source map for rendered output
   */
  private buildSourceMap(text: string, sections: RenderedSection[]): SourceMap {
    const sourceMap = new SourceMap(this.name);
    sourceMap.setRenderedText(text);

    let offset = 0;

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];

      // Find the section content in the rendered text
      const sectionStart = text.indexOf(section.content, offset);
      if (sectionStart === -1) continue;

      const sectionEnd = sectionStart + section.content.length;

      // Add mapping based on source type
      if (section.sourceMapping.source.type === 'dynamic') {
        sourceMap.addDynamicMapping({
          outputStart: sectionStart,
          outputEnd: sectionEnd,
          sectionType: section.type,
          sectionIndex: i,
        });
      } else if (section.sourceMapping.source.fragmentId) {
        sourceMap.addFragmentMapping({
          outputStart: sectionStart,
          outputEnd: sectionEnd,
          fragmentId: section.sourceMapping.source.fragmentId,
          fragmentVersion:
            section.sourceMapping.source.fragmentVersion ?? '1.0.0',
          sectionType: section.type,
          sectionIndex: i,
          sourceFile: section.sourceMapping.source.file,
          sourceLine: section.sourceMapping.source.fileLine,
        });
      } else {
        sourceMap.addLiteralMapping(sectionStart, sectionEnd, section.type, i);
      }

      offset = sectionEnd;
    }

    return sourceMap;
  }

  /**
   * Build prompt metadata
   */
  private async buildMetadata(
    text: string,
    sections: RenderedSection[],
    sourceMap: SourceMap,
  ): Promise<PromptMetadata> {
    const tokenCount = await countTokens(text, this.model);

    // Calculate tokens by section
    const tokensBySection: Record<string, number> = {};
    for (const section of sections) {
      const sectionTokens = await countTokens(section.content, this.model);
      const key = section.name ?? section.type;
      tokensBySection[key] = (tokensBySection[key] ?? 0) + sectionTokens;
    }

    // Calculate cacheable prefix length and tokens
    let cacheablePrefix = 0;
    let cacheableTokens = 0;
    for (const section of sections) {
      if (!section.cacheable) break;
      cacheablePrefix += section.content.length + 4; // Approximate character overhead
      const key = section.name ?? section.type;
      cacheableTokens += tokensBySection[key] ?? 0;
    }

    // Collect fragment references
    const fragments: FragmentReference[] = [];
    for (let i = 0; i < this.sections.length; i++) {
      const section = this.sections[i];
      const fragment = Section.getFragment(section);
      if (fragment) {
        fragments.push({
          id: fragment.id,
          version: fragment.version,
          sectionType: section.type,
          sectionIndex: i,
        });
      }
    }

    // Run lint checks
    const warnings = this.lint();

    // Check token limit
    const modelConfig = getModelConfig(this.model);
    if (tokenCount > modelConfig.contextWindow) {
      warnings.push({
        id: 'token-limit-exceeded',
        category: 'token-budget',
        severity: 'error',
        message: `Prompt exceeds context window (${tokenCount.toLocaleString()} > ${modelConfig.contextWindow.toLocaleString()} tokens)`,
      });
    } else if (tokenCount > modelConfig.contextWindow * 0.8) {
      warnings.push({
        id: 'token-limit-warning',
        category: 'token-budget',
        severity: 'warning',
        message: `Prompt approaching context window (${tokenCount.toLocaleString()} tokens, ${Math.round((tokenCount / modelConfig.contextWindow) * 100)}% of limit)`,
      });
    }

    return {
      name: this.name,
      model: this.model,
      tokenCount,
      tokensBySection,
      sourceMap: sourceMap.toJSON(),
      warnings,
      cacheablePrefix,
      cacheableTokens,
      fragments,
    };
  }

  /**
   * Get fragment ID from a section
   */
  private getFragmentId(section: SectionConfig): string | undefined {
    const fragment = Section.getFragment(section);
    return fragment?.id;
  }

  /**
   * Get fragment version from a section
   */
  private getFragmentVersion(section: SectionConfig): string | undefined {
    const fragment = Section.getFragment(section);
    return fragment?.version;
  }
}

/**
 * Fluent builder API for creating prompts
 */
export function prompt(name: string): PromptBuilder {
  return new PromptBuilder(name);
}

/**
 * PromptBuilder - Fluent/chainable interface for building prompts
 */
export class PromptBuilder {
  private _name: string;
  private _model: ModelIdentifier = 'claude-sonnet-4-20250514';
  private _sections: SectionConfig[] = [];
  private _options: PromptOptions = {};

  constructor(name: string) {
    this._name = name;
  }

  model(modelId: ModelIdentifier): this {
    this._model = modelId;
    return this;
  }

  identity(content: Fragment | string): this {
    this._sections.push(Section.identity(content));
    return this;
  }

  capabilities(content: Fragment | string | string[]): this {
    this._sections.push(Section.capabilities(content));
    return this;
  }

  constraints(content: Fragment | string | string[]): this {
    this._sections.push(Section.constraints(content));
    return this;
  }

  domain(content: Fragment | string): this {
    this._sections.push(Section.domain(content));
    return this;
  }

  tools(tools: Parameters<typeof Section.tools>[0]): this {
    this._sections.push(Section.tools(tools));
    return this;
  }

  context(dynamicFn: DynamicContent): this {
    this._sections.push(Section.context(dynamicFn));
    return this;
  }

  examples(content: Fragment | string): this {
    this._sections.push(Section.examples(content));
    return this;
  }

  format(content: Fragment | string): this {
    this._sections.push(Section.format(content));
    return this;
  }

  custom(name: string, content: Fragment | string | DynamicContent): this {
    this._sections.push(Section.custom(name, content));
    return this;
  }

  options(opts: PromptOptions): this {
    this._options = { ...this._options, ...opts };
    return this;
  }

  /**
   * Override the output format (xml, markdown, or plain)
   * By default, format is inferred from model name
   */
  outputFormat(format: 'xml' | 'markdown' | 'plain'): this {
    this._options.format = format;
    return this;
  }

  build(): Prompt {
    return Prompt.compose({
      name: this._name,
      model: this._model,
      sections: this._sections,
      options: this._options,
    });
  }
}
