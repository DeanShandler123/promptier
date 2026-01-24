import { existsSync, writeFileSync } from 'fs';
import { resolve } from 'path';

import pc from 'picocolors';
import { createJiti } from 'jiti';
import type { Prompt, RenderContext } from '@promptier/core';

// Create jiti instance for loading TypeScript files
const jiti = createJiti(import.meta.url, {
  interopDefault: true,
  moduleCache: false,
});

interface RenderOptions {
  context?: string;
  output?: string;
  showMeta?: boolean;
}

/**
 * Render a prompt for debugging
 */
export async function renderCommand(
  file: string,
  options: RenderOptions,
): Promise<void> {
  const filePath = resolve(file);

  if (!existsSync(filePath)) {
    console.error(pc.red(`File not found: ${filePath}`));
    process.exitCode = 1;
    return;
  }

  // Parse context if provided
  let context: RenderContext = {};
  if (options.context) {
    try {
      context = JSON.parse(options.context);
    } catch {
      console.error(pc.red('Invalid JSON context'));
      process.exitCode = 1;
      return;
    }
  }

  // Load the prompt
  const prompt = await loadPromptFromFile(filePath);
  if (!prompt) {
    console.error(pc.red(`No prompt found in ${filePath}`));
    process.exitCode = 1;
    return;
  }

  // Render
  try {
    const { text, meta } = await prompt.render(context);

    if (options.output) {
      // Write to file
      const outputPath = resolve(options.output);
      writeFileSync(outputPath, text);
      console.log(pc.green('Wrote rendered prompt to:'), outputPath);

      if (options.showMeta) {
        const metaPath = outputPath.replace(/\.[^.]+$/, '.meta.json');
        writeFileSync(metaPath, JSON.stringify(meta, null, 2));
        console.log(pc.green('Wrote metadata to:'), metaPath);
      }
    } else {
      // Output to console
      console.log(pc.cyan('═'.repeat(60)));
      console.log(pc.cyan('Rendered Prompt'));
      console.log(pc.cyan('═'.repeat(60)));
      console.log();
      console.log(text);
      console.log();

      if (options.showMeta) {
        console.log(pc.cyan('─'.repeat(60)));
        console.log(pc.cyan('Metadata'));
        console.log(pc.cyan('─'.repeat(60)));
        console.log();
        console.log(pc.dim('Name:'), meta.name);
        console.log(pc.dim('Model:'), meta.model);
        console.log(pc.dim('Tokens:'), meta.tokenCount.toLocaleString());
        console.log(pc.dim('Cacheable prefix:'), meta.cacheablePrefix, 'chars');
        console.log();
        console.log(pc.dim('Tokens by section:'));
        for (const [section, tokens] of Object.entries(meta.tokensBySection)) {
          console.log(`  ${section}: ${tokens.toLocaleString()}`);
        }
        console.log();
        console.log(
          pc.dim('Fragments:'),
          meta.fragments.map((f) => f.id).join(', ') || '(none)',
        );
        console.log();
        if (meta.warnings.length > 0) {
          console.log(pc.yellow('Warnings:'));
          for (const warning of meta.warnings) {
            console.log(`  ${warning.severity}: ${warning.message}`);
          }
        }
      }
    }
  } catch (error) {
    console.error(pc.red('Error rendering prompt:'), error);
    process.exitCode = 1;
  }
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
