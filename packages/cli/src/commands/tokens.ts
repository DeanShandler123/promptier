import { existsSync } from 'fs';
import { resolve, relative } from 'path';

import pc from 'picocolors';
import { createJiti } from 'jiti';
import { getModelConfig, type Prompt } from '@promptier/core';

// Create jiti instance for loading TypeScript files
const jiti = createJiti(import.meta.url, {
  interopDefault: true,
  moduleCache: false,
});

interface TokensOptions {
  all?: boolean;
}

/**
 * Analyze token usage in prompts
 */
export async function tokensCommand(
  file: string | undefined,
  options: TokensOptions,
): Promise<void> {
  let files: string[];

  if (options.all) {
    files = await findPromptFiles(process.cwd());
  } else if (file) {
    files = [resolve(file)];
  } else {
    console.log('Usage: promptier tokens <file> or --all');
    return;
  }

  if (files.length === 0) {
    console.log(pc.yellow('No prompt files found.'));
    return;
  }

  for (const filePath of files) {
    await analyzeTokens(filePath);
    if (files.length > 1) console.log();
  }
}

/**
 * Analyze tokens for a single prompt file
 */
async function analyzeTokens(filePath: string): Promise<void> {
  if (!existsSync(filePath)) {
    console.error(pc.red(`File not found: ${filePath}`));
    return;
  }

  const prompt = await loadPromptFromFile(filePath);
  if (!prompt) {
    console.error(pc.red(`No prompt found in ${filePath}`));
    return;
  }

  const { meta } = await prompt.render();
  const modelConfig = getModelConfig(prompt.model);

  const relPath = relative(process.cwd(), filePath);
  console.log(
    pc.underline(pc.bold(`${meta.name}`)) + pc.dim(` (${prompt.model})`),
  );
  console.log(pc.dim('File: ' + relPath));
  console.log(pc.dim('─'.repeat(50)));

  // Total tokens
  const percentage = (
    (meta.tokenCount / modelConfig.contextWindow) *
    100
  ).toFixed(1);
  console.log(
    `Total: ${pc.bold(meta.tokenCount.toLocaleString())} tokens (${percentage}% of ${(modelConfig.contextWindow / 1000).toFixed(0)}K context)`,
  );
  console.log();

  // Section breakdown
  console.log('Section Breakdown:');
  const maxSectionName = Math.max(
    ...Object.keys(meta.tokensBySection).map((s) => s.length),
  );
  const maxTokens = Math.max(...Object.values(meta.tokensBySection));

  for (const [section, tokens] of Object.entries(meta.tokensBySection)) {
    const sectionPercentage = ((tokens / meta.tokenCount) * 100).toFixed(1);
    const barLength = Math.round((tokens / maxTokens) * 10);
    const bar = '█'.repeat(barLength) + '░'.repeat(10 - barLength);

    const name = section.padEnd(maxSectionName);
    const tokenStr = tokens.toLocaleString().padStart(6);
    const pctStr = `(${sectionPercentage}%)`.padStart(8);

    console.log(
      `├── ${name} │ ${pc.cyan(bar)} │ ${tokenStr} ${pc.dim(pctStr)}`,
    );
  }

  console.log();

  // Cache analysis
  if (modelConfig.supportsCaching) {
    const cacheableTokens = meta.cacheableTokens;
    const cacheablePercentage = Math.round(
      (cacheableTokens / meta.tokenCount) * 100,
    );

    console.log('Cache Analysis:');
    console.log(
      `├── Cacheable prefix: ${cacheableTokens.toLocaleString()} tokens (${cacheablePercentage}%)`,
    );

    if (modelConfig.cacheConfig) {
      const savings =
        cacheablePercentage * modelConfig.cacheConfig.costMultiplier;
      console.log(
        `└── Estimated cost reduction: ${savings.toFixed(0)}% with prompt caching`,
      );
    }
  } else {
    console.log(pc.dim('Cache analysis: Not supported for ' + prompt.model));
  }
}

/**
 * Find all prompt files in a directory
 */
async function findPromptFiles(dir: string): Promise<string[]> {
  const { readdirSync, statSync } = await import('fs');
  const files: string[] = [];

  function walk(currentDir: string): void {
    try {
      const entries = readdirSync(currentDir);
      for (const entry of entries) {
        if (entry.startsWith('.') || entry === 'node_modules') continue;

        const fullPath = resolve(currentDir, entry);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          walk(fullPath);
        } else if (entry.endsWith('.agent.ts') || entry.endsWith('.agent.js')) {
          files.push(fullPath);
        }
      }
    } catch {
      // Ignore errors
    }
  }

  walk(dir);
  return files;
}

/**
 * Load a prompt from a file using jiti (supports TypeScript)
 */
async function loadPromptFromFile(filePath: string): Promise<Prompt | null> {
  try {
    const module = (await jiti.import(filePath)) as Record<string, unknown>;

    for (const [_key, value] of Object.entries(module)) {
      if (
        value &&
        typeof value === 'object' &&
        'render' in value &&
        'sections' in value
      ) {
        return value as Prompt;
      }
    }

    return null;
  } catch (error) {
    throw error;
  }
}
