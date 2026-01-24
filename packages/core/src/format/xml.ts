import type { Formatter, RenderedSection, SectionType } from '../types.js';

/**
 * XML section tag names for different section types
 */
const SECTION_TAGS: Record<SectionType, string> = {
  identity: 'identity',
  capabilities: 'capabilities',
  constraints: 'constraints',
  context: 'context',
  domain: 'domain',
  tools: 'tools',
  format: 'format',
  examples: 'examples',
  custom: 'section',
};

/**
 * XML Formatter - Formats sections using XML tags
 *
 * Preferred format for Claude models as they perform better with XML structure.
 */
export class XmlFormatter implements Formatter {
  /**
   * Format all sections into a complete prompt string
   */
  format(sections: RenderedSection[]): string {
    return sections.map((section) => this.formatSection(section)).join('\n\n');
  }

  /**
   * Format a single section with XML tags
   */
  formatSection(section: RenderedSection): string {
    const tagName = this.getTagName(section);
    const content = section.content.trim();

    // Handle empty content
    if (!content) {
      return `<${tagName}></${tagName}>`;
    }

    // Use self-closing for very short content (single line)
    if (!content.includes('\n') && content.length < 80) {
      return `<${tagName}>${content}</${tagName}>`;
    }

    // Multi-line content with proper indentation
    return `<${tagName}>\n${content}\n</${tagName}>`;
  }

  /**
   * Get the appropriate XML tag name for a section
   */
  private getTagName(section: RenderedSection): string {
    if (section.type === 'custom' && section.name) {
      // Sanitize custom names to valid XML tag names
      return sanitizeTagName(section.name);
    }
    return SECTION_TAGS[section.type];
  }
}

/**
 * Sanitize a string to be a valid XML tag name
 */
function sanitizeTagName(name: string): string {
  // XML tag names must start with a letter or underscore
  // and can contain letters, digits, hyphens, underscores, and periods
  let sanitized = name
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  // Ensure it starts with a letter or underscore
  if (!/^[a-z_]/i.test(sanitized)) {
    sanitized = '_' + sanitized;
  }

  return sanitized || 'section';
}

/**
 * Create an XML formatter instance
 */
export function createXmlFormatter(): XmlFormatter {
  return new XmlFormatter();
}
