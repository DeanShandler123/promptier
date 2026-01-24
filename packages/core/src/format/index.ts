import type { Formatter, ModelIdentifier, RenderedSection } from '../types.js';
import { getModelConfig } from '../models/index.js';
import { createXmlFormatter } from './xml.js';
import { createMarkdownFormatter } from './markdown.js';
import { createPlainFormatter } from './plain.js';

export { XmlFormatter, createXmlFormatter } from './xml.js';
export { MarkdownFormatter, createMarkdownFormatter } from './markdown.js';
export { PlainFormatter, createPlainFormatter } from './plain.js';

/**
 * Get the appropriate formatter for a model
 */
export function getFormatterForModel(modelId: ModelIdentifier): Formatter {
  const config = getModelConfig(modelId);

  switch (config.preferredFormat) {
    case 'xml':
      return createXmlFormatter();
    case 'markdown':
      return createMarkdownFormatter();
    case 'plain':
    default:
      return createPlainFormatter();
  }
}

/**
 * Format sections using the appropriate formatter for a model
 */
export function formatForModel(
  sections: RenderedSection[],
  modelId: ModelIdentifier,
): string {
  const formatter = getFormatterForModel(modelId);
  return formatter.format(sections);
}

/**
 * Create a formatter by name
 */
export function createFormatter(
  format: 'xml' | 'markdown' | 'plain',
): Formatter {
  switch (format) {
    case 'xml':
      return createXmlFormatter();
    case 'markdown':
      return createMarkdownFormatter();
    case 'plain':
      return createPlainFormatter();
  }
}
