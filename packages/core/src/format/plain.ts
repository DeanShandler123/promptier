import type { Formatter, RenderedSection, SectionType } from '../types.js';

/**
 * Plain text labels for different section types
 */
const SECTION_LABELS: Record<SectionType, string> = {
  identity: 'IDENTITY',
  capabilities: 'CAPABILITIES',
  constraints: 'CONSTRAINTS',
  context: 'CONTEXT',
  domain: 'DOMAIN',
  tools: 'TOOLS',
  format: 'OUTPUT FORMAT',
  examples: 'EXAMPLES',
  custom: 'SECTION',
};

/**
 * Plain Text Formatter - Formats sections using simple text separators
 *
 * Useful for models that don't have specific format preferences.
 */
export class PlainFormatter implements Formatter {
  private separator: string;
  private includeLabels: boolean;

  constructor(options: { separator?: string; includeLabels?: boolean } = {}) {
    this.separator = options.separator ?? '---';
    this.includeLabels = options.includeLabels ?? true;
  }

  /**
   * Format all sections into a complete prompt string
   */
  format(sections: RenderedSection[]): string {
    return sections
      .map((section) => this.formatSection(section))
      .join(`\n\n${this.separator}\n\n`);
  }

  /**
   * Format a single section
   */
  formatSection(section: RenderedSection): string {
    const content = section.content.trim();

    if (!this.includeLabels) {
      return content;
    }

    const label = this.getLabel(section);

    // Handle empty content
    if (!content) {
      return `[${label}]`;
    }

    return `[${label}]\n${content}`;
  }

  /**
   * Get the appropriate label for a section
   */
  private getLabel(section: RenderedSection): string {
    if (section.type === 'custom' && section.name) {
      return section.name.toUpperCase().replace(/[-_]/g, ' ');
    }
    return SECTION_LABELS[section.type];
  }
}

/**
 * Create a plain text formatter instance
 */
export function createPlainFormatter(options?: {
  separator?: string;
  includeLabels?: boolean;
}): PlainFormatter {
  return new PlainFormatter(options);
}
