import type { LintWarning, LintCategory, LintSeverity } from '@promptier/core';

/** Map semantic rule IDs to LintCategory */
const CATEGORY_MAP: Record<string, LintCategory> = {
  'semantic-contradiction': 'contradiction',
  'semantic-ambiguity': 'ambiguity',
  'semantic-injection-risk': 'security',
  'semantic-verbosity': 'token-budget',
  'semantic-missing-practice': 'best-practice',
  'semantic-scope-creep': 'best-practice',
};

const VALID_SEVERITIES = new Set<string>(['error', 'warning', 'info']);

interface RawFinding {
  id?: unknown;
  severity?: unknown;
  message?: unknown;
  suggestion?: unknown;
  evidence?: unknown;
}

/**
 * Parse structured LLM output into LintWarning[].
 *
 * Resilient to common small-model quirks:
 * 1. Tries JSON.parse directly
 * 2. Extracts JSON from markdown fences
 * 3. Extracts first [...] array from raw text
 * 4. Returns a parse-error warning as last resort
 */
export function parseSemanticResponse(raw: string): LintWarning[] {
  const parsed = tryParse(raw);

  if (parsed === null) {
    return [
      {
        id: 'semantic-parse-error',
        category: 'best-practice',
        severity: 'info',
        message:
          'LLM linter returned unparseable response. Raw output available in debug mode.',
      },
    ];
  }

  if (!Array.isArray(parsed)) {
    return [
      {
        id: 'semantic-parse-error',
        category: 'best-practice',
        severity: 'info',
        message:
          'LLM linter returned unparseable response. Raw output available in debug mode.',
      },
    ];
  }

  const warnings: LintWarning[] = [];

  for (const item of parsed as RawFinding[]) {
    if (!item || typeof item !== 'object') continue;

    const id = typeof item.id === 'string' ? item.id : undefined;
    const message = typeof item.message === 'string' ? item.message : undefined;

    // Skip items without id and message
    if (!id || !message) continue;

    const severity: LintSeverity =
      typeof item.severity === 'string' && VALID_SEVERITIES.has(item.severity)
        ? (item.severity as LintSeverity)
        : 'info';

    const category: LintCategory = CATEGORY_MAP[id] ?? 'best-practice';

    const warning: LintWarning = {
      id,
      category,
      severity,
      message,
    };

    if (typeof item.suggestion === 'string') {
      warning.suggestion = item.suggestion;
    }

    if (typeof item.evidence === 'string') {
      warning.evidence = item.evidence;
    }

    warnings.push(warning);
  }

  return warnings;
}

/**
 * Try multiple strategies to extract a JSON array from raw LLM output.
 */
function tryParse(raw: string): unknown {
  const trimmed = raw.trim();

  // Strategy 1: Direct JSON.parse
  try {
    return JSON.parse(trimmed);
  } catch {
    // continue
  }

  // Strategy 2: Extract from markdown fences (```json ... ``` or ``` ... ```)
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      // continue
    }
  }

  // Strategy 3: Find first [ to last ]
  const firstBracket = trimmed.indexOf('[');
  const lastBracket = trimmed.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    try {
      return JSON.parse(trimmed.slice(firstBracket, lastBracket + 1));
    } catch {
      // continue
    }
  }

  return null;
}
