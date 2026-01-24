import type { LintWarning } from '@promptier/core';

import type { LintRule, LintContext } from '../../types.js';

/**
 * Get line and column from offset in text
 */
function getPosition(
  text: string,
  offset: number,
): { line: number; column: number } {
  const lines = text.slice(0, offset).split('\n');
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1,
  };
}

/**
 * Rule: Token limit exceeded
 */
export const tokenLimitExceeded: LintRule = {
  id: 'token-limit-exceeded',
  category: 'token-budget',
  defaultSeverity: 'error',
  description: 'Checks if the prompt exceeds the model context window',
  check: (ctx: LintContext): LintWarning[] => {
    if (ctx.tokenCount > ctx.modelConfig.contextWindow) {
      return [
        {
          id: 'token-limit-exceeded',
          category: 'token-budget',
          severity: 'error',
          message: `Prompt exceeds context window (${ctx.tokenCount.toLocaleString()} > ${ctx.modelConfig.contextWindow.toLocaleString()} tokens)`,
        },
      ];
    }
    return [];
  },
};

/**
 * Rule: Token limit warning (approaching limit)
 *
 * Options:
 * - threshold: number (0-1, default 0.8) - warn when usage exceeds this ratio
 */
export const tokenLimitWarning: LintRule = {
  id: 'token-limit-warning',
  category: 'token-budget',
  defaultSeverity: 'warning',
  description: 'Warns when prompt is approaching the context window limit',
  check: (ctx: LintContext): LintWarning[] => {
    const threshold =
      typeof ctx.options?.threshold === 'number' ? ctx.options.threshold : 0.8;
    const ratio = ctx.tokenCount / ctx.modelConfig.contextWindow;
    if (ratio > threshold && ratio <= 1) {
      return [
        {
          id: 'token-limit-warning',
          category: 'token-budget',
          severity: 'warning',
          message: `Prompt approaching context window (${Math.round(ratio * 100)}% of limit, threshold: ${Math.round(threshold * 100)}%)`,
        },
      ];
    }
    return [];
  },
};

/**
 * Rule: XML tags with GPT models
 */
export const xmlTagsWithGpt: LintRule = {
  id: 'xml-tags-with-gpt',
  category: 'model-mismatch',
  defaultSeverity: 'warning',
  description: 'Warns when using XML tags with GPT models',
  check: (ctx: LintContext): LintWarning[] => {
    if (ctx.modelId.startsWith('gpt') && hasXmlTags(ctx.text)) {
      return [
        {
          id: 'xml-tags-with-gpt',
          category: 'model-mismatch',
          severity: 'warning',
          message:
            'XML tags detected but targeting GPT model. Consider using markdown headers instead.',
          suggestion:
            'Switch to markdown formatting or change model to Claude.',
        },
      ];
    }
    return [];
  },
};

/**
 * Rule: Markdown with Claude
 */
export const markdownWithClaude: LintRule = {
  id: 'markdown-with-claude',
  category: 'model-mismatch',
  defaultSeverity: 'info',
  description: 'Suggests using XML tags instead of markdown for Claude',
  check: (ctx: LintContext): LintWarning[] => {
    if (
      ctx.modelId.startsWith('claude') &&
      hasMarkdownHeaders(ctx.text) &&
      !hasXmlTags(ctx.text)
    ) {
      return [
        {
          id: 'markdown-with-claude',
          category: 'model-mismatch',
          severity: 'info',
          message:
            'Claude performs better with XML tags than markdown headers.',
          suggestion: 'Consider using XML tags for structure.',
        },
      ];
    }
    return [];
  },
};

/**
 * Rule: Dynamic content before static
 */
export const dynamicBeforeStatic: LintRule = {
  id: 'dynamic-before-static',
  category: 'cache-inefficiency',
  defaultSeverity: 'warning',
  description: 'Warns when dynamic content appears before static content',
  check: (ctx: LintContext): LintWarning[] => {
    const firstDynamicIdx = ctx.sections.findIndex((s) => !s.cacheable);
    const lastCacheableIdx = findLastIndex(ctx.sections, (s) => s.cacheable);

    if (
      firstDynamicIdx !== -1 &&
      lastCacheableIdx !== -1 &&
      firstDynamicIdx < lastCacheableIdx
    ) {
      return [
        {
          id: 'dynamic-before-static',
          category: 'cache-inefficiency',
          severity: 'warning',
          message:
            'Dynamic content before static content reduces cache efficiency.',
          suggestion:
            'Reorder sections to put static content first, or enable cacheOptimize option.',
        },
      ];
    }
    return [];
  },
};

/**
 * Rule: Missing identity section
 */
export const missingIdentity: LintRule = {
  id: 'missing-identity',
  category: 'best-practice',
  defaultSeverity: 'warning',
  description: 'Warns when no identity section is defined',
  check: (ctx: LintContext): LintWarning[] => {
    const hasIdentity = ctx.sections.some((s) => s.type === 'identity');
    if (!hasIdentity) {
      return [
        {
          id: 'missing-identity',
          category: 'best-practice',
          severity: 'warning',
          message: 'No identity section. Agent may lack consistent persona.',
          suggestion: 'Add an identity section to define who the agent is.',
        },
      ];
    }
    return [];
  },
};

/**
 * Rule: Format section not at end
 */
export const formatNotLast: LintRule = {
  id: 'format-not-last',
  category: 'ordering',
  defaultSeverity: 'info',
  description: 'Suggests placing format section at the end',
  check: (ctx: LintContext): LintWarning[] => {
    const formatIdx = ctx.sections.findIndex((s) => s.type === 'format');
    if (formatIdx !== -1 && formatIdx !== ctx.sections.length - 1) {
      return [
        {
          id: 'format-not-last',
          category: 'ordering',
          severity: 'info',
          message: 'Output format instructions work best at the end.',
          suggestion: 'Move the format section to be the last section.',
        },
      ];
    }
    return [];
  },
};

/**
 * Rule: Duplicate instructions
 */
export const duplicateInstructions: LintRule = {
  id: 'duplicate-instructions',
  category: 'duplication',
  defaultSeverity: 'warning',
  description: 'Detects duplicate sentences in the prompt',
  check: (ctx: LintContext): LintWarning[] => {
    const duplicates = findDuplicateSentences(ctx.text);
    if (duplicates.length > 0) {
      return duplicates.map((dup) => {
        // Find position of second occurrence
        const firstIdx = ctx.text.toLowerCase().indexOf(dup);
        const secondIdx = ctx.text.toLowerCase().indexOf(dup, firstIdx + 1);
        const pos = secondIdx !== -1 ? getPosition(ctx.text, secondIdx) : null;

        return {
          id: 'duplicate-instructions',
          category: 'duplication' as const,
          severity: 'warning' as const,
          message: `Duplicate instruction detected: "${dup.substring(0, 50)}${dup.length > 50 ? '...' : ''}"`,
          suggestion: 'Remove or consolidate duplicate instructions.',
          ...(pos && {
            position: {
              start: secondIdx,
              end: secondIdx + dup.length,
              line: pos.line,
              column: pos.column,
            },
          }),
        };
      });
    }
    return [];
  },
};

/**
 * Rule: Potential user input in system prompt
 */
export const userInputInSystem: LintRule = {
  id: 'user-input-in-system',
  category: 'security',
  defaultSeverity: 'error',
  description: 'Detects potential user input markers in non-context sections',
  check: (ctx: LintContext): LintWarning[] => {
    const warnings: LintWarning[] = [];

    for (const section of ctx.sections) {
      if (section.type === 'context') continue;

      const content =
        typeof section.content === 'string'
          ? section.content
          : typeof section.content === 'object' && 'content' in section.content
            ? section.content.content
            : '';

      const markerMatch = findUserInputMarker(content);
      if (markerMatch) {
        // Find position in full text
        const contentStart = ctx.text.indexOf(content);
        const absoluteOffset =
          contentStart !== -1 ? contentStart + markerMatch.index : -1;
        const pos =
          absoluteOffset !== -1 ? getPosition(ctx.text, absoluteOffset) : null;

        warnings.push({
          id: 'user-input-in-system',
          category: 'security',
          severity: 'error',
          message: `Potential user input detected in ${section.type} section: "${markerMatch.match}". Injection risk.`,
          suggestion:
            'Move user-provided content to a context section with proper sanitization.',
          ...(pos && {
            position: {
              start: absoluteOffset,
              end: absoluteOffset + markerMatch.match.length,
              line: pos.line,
              column: pos.column,
            },
          }),
        });
      }
    }

    return warnings;
  },
};

/**
 * Rule: Empty sections
 */
export const emptySections: LintRule = {
  id: 'empty-sections',
  category: 'best-practice',
  defaultSeverity: 'warning',
  description: 'Warns about empty sections',
  check: (ctx: LintContext): LintWarning[] => {
    const warnings: LintWarning[] = [];

    for (const section of ctx.sections) {
      const content =
        typeof section.content === 'string'
          ? section.content
          : typeof section.content === 'object' && 'content' in section.content
            ? section.content.content
            : '';

      if (typeof section.content !== 'function' && content.trim() === '') {
        warnings.push({
          id: 'empty-sections',
          category: 'best-practice',
          severity: 'warning',
          message: `Empty ${section.type} section.`,
          suggestion: 'Remove empty sections or add content.',
        });
      }
    }

    return warnings;
  },
};

/**
 * Rule: Conflicting language patterns
 */
export const conflictingPatterns: LintRule = {
  id: 'conflicting-patterns',
  category: 'contradiction',
  defaultSeverity: 'warning',
  description: 'Detects potentially conflicting instruction patterns',
  check: (ctx: LintContext): LintWarning[] => {
    const warnings: LintWarning[] = [];
    const text = ctx.text.toLowerCase();

    // Check for "always X" and "never X" pairs
    const alwaysMatches = text.matchAll(/always\s+(\w+(?:\s+\w+)?)/g);
    const neverMatches = text.matchAll(/never\s+(\w+(?:\s+\w+)?)/g);

    const alwaysActions = new Set([...alwaysMatches].map((m) => m[1]));
    const neverActions = new Set([...neverMatches].map((m) => m[1]));

    for (const action of alwaysActions) {
      if (neverActions.has(action)) {
        warnings.push({
          id: 'conflicting-patterns',
          category: 'contradiction',
          severity: 'warning',
          message: `Conflicting instructions: both "always ${action}" and "never ${action}" found.`,
          suggestion: 'Clarify the intended behavior.',
        });
      }
    }

    // Check for "be concise" vs "provide detailed"
    if (
      text.includes('concise') &&
      (text.includes('detailed') || text.includes('comprehensive'))
    ) {
      warnings.push({
        id: 'conflicting-patterns',
        category: 'contradiction',
        severity: 'info',
        message:
          'Potentially conflicting: instructions for both concise and detailed responses.',
        suggestion: 'Clarify when to be concise vs detailed.',
      });
    }

    return warnings;
  },
};

// Utility functions

function hasXmlTags(text: string): boolean {
  return /<[a-z][a-z0-9-]*>/i.test(text);
}

function hasMarkdownHeaders(text: string): boolean {
  return /^#{1,6}\s+/m.test(text);
}

function findLastIndex<T>(array: T[], predicate: (item: T) => boolean): number {
  for (let i = array.length - 1; i >= 0; i--) {
    if (predicate(array[i])) return i;
  }
  return -1;
}

function findDuplicateSentences(text: string): string[] {
  // Split into sentences
  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 20); // Only consider meaningful sentences

  const seen = new Map<string, number>();
  const duplicates: string[] = [];

  for (const sentence of sentences) {
    const count = (seen.get(sentence) ?? 0) + 1;
    seen.set(sentence, count);

    if (count === 2) {
      duplicates.push(sentence);
    }
  }

  return duplicates;
}

function findUserInputMarker(
  text: string,
): { match: string; index: number } | null {
  // Common patterns that might indicate user input
  const markers = [
    /\{\{user\.[^}]*\}\}/i,
    /\$user\.\w+/i,
    /user_input/i,
    /user_message/i,
    /<user_input>/i,
    /\[USER INPUT\]/i,
  ];

  for (const pattern of markers) {
    const match = text.match(pattern);
    if (match && match.index !== undefined) {
      return { match: match[0], index: match.index };
    }
  }
  return null;
}

/**
 * All heuristic rules
 */
export const heuristicRules: LintRule[] = [
  tokenLimitExceeded,
  tokenLimitWarning,
  xmlTagsWithGpt,
  markdownWithClaude,
  dynamicBeforeStatic,
  missingIdentity,
  formatNotLast,
  duplicateInstructions,
  userInputInSystem,
  emptySections,
  conflictingPatterns,
];
