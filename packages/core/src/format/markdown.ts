import type { Formatter, RenderedSection, SectionType } from '../types.js';

/**
 * Markdown header names for different section types
 */
const SECTION_HEADERS: Record<SectionType, string> = {
  identity: 'Identity',
  capabilities: 'Capabilities',
  constraints: 'Constraints',
  context: 'Context',
  domain: 'Domain Knowledge',
  tools: 'Available Tools',
  format: 'Output Format',
  examples: 'Examples',
  custom: 'Section',
};

/**
 * Markdown Formatter - Formats sections using Markdown headers
 *
 * Preferred format for GPT models and general-purpose formatting.
 */
export class MarkdownFormatter implements Formatter {
  private headerLevel: number;

  constructor(headerLevel: number = 2) {
    this.headerLevel = headerLevel;
  }

  /**
   * Format all sections into a complete prompt string
   */
  format(sections: RenderedSection[]): string {
    return sections.map((section) => this.formatSection(section)).join('\n\n');
  }

  /**
   * Format a single section with Markdown header
   */
  formatSection(section: RenderedSection): string {
    const header = this.getHeader(section);
    const content = section.content.trim();
    const headerPrefix = '#'.repeat(this.headerLevel);

    // Handle empty content
    if (!content) {
      return `${headerPrefix} ${header}`;
    }

    return `${headerPrefix} ${header}\n\n${content}`;
  }

  /**
   * Get the appropriate header text for a section
   */
  private getHeader(section: RenderedSection): string {
    if (section.type === 'custom' && section.name) {
      return toTitleCase(section.name);
    }
    return SECTION_HEADERS[section.type];
  }
}

/**
 * Convert a string to title case
 */
function toTitleCase(str: string): string {
  return str
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Create a Markdown formatter instance
 */
export function createMarkdownFormatter(
  headerLevel: number = 2,
): MarkdownFormatter {
  return new MarkdownFormatter(headerLevel);
}
