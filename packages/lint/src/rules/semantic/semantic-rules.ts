import type { LintWarning } from '@promptier/core';

import type { LintRule, LintContext } from '../../types.js';
import type { LlmClient } from '../../llm/client.js';
import { renderLinterPrompt } from './system-prompt.js';
import { parseSemanticResponse } from './parser.js';

/**
 * Create a single LintRule that wraps the entire LLM semantic analysis call.
 * One call per lint run — the model returns multiple findings in one response.
 */
export function createSemanticRule(client: LlmClient): LintRule {
  return {
    id: 'semantic-analysis',
    category: 'best-practice',
    defaultSeverity: 'warning',
    description: 'LLM-powered semantic analysis of prompt quality',
    check: async (ctx: LintContext): Promise<LintWarning[]> => {
      const sectionTypes = ctx.sections.map((s) => s.type).join(', ');

      const userPrompt = [
        `Target model: ${ctx.modelId}`,
        `Sections: ${sectionTypes || 'none'}`,
        `Token count: ${ctx.tokenCount}`,
        '',
        '=== SYSTEM PROMPT TO ANALYZE ===',
        ctx.text,
        '=== END ===',
      ].join('\n');

      const systemPrompt = await renderLinterPrompt();
      const raw = await client.generate(userPrompt, systemPrompt);
      return parseSemanticResponse(raw);
    },
  };
}
