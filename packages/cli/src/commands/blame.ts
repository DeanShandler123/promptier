import { existsSync } from 'fs';
import { resolve, relative } from 'path';

import pc from 'picocolors';
import { createJiti } from 'jiti';
import { SourceMap, type Prompt } from '@promptier/core';

// Create jiti instance for loading TypeScript files
const jiti = createJiti(import.meta.url, {
  interopDefault: true,
  moduleCache: false,
});

interface BlameOptions {
  line?: number;
  fragment?: string;
}

/**
 * Show provenance of prompt content - trace back to original source
 */
export async function blameCommand(
  file: string,
  options: BlameOptions,
): Promise<void> {
  const filePath = resolve(file);

  if (!existsSync(filePath)) {
    console.error(pc.red(`File not found: ${filePath}`));
    process.exitCode = 1;
    return;
  }

  const prompt = await loadPromptFromFile(filePath);
  if (!prompt) {
    console.error(pc.red(`No prompt found in ${filePath}`));
    process.exitCode = 1;
    return;
  }

  const { text, meta } = await prompt.render();
  const sourceMap = SourceMap.fromJSON(meta.sourceMap);
  sourceMap.setRenderedText(text);

  if (options.line !== undefined) {
    // Blame a specific line
    const origin = sourceMap.originAt(options.line, 1);

    console.log(pc.cyan(`Blame for line ${options.line}:`));
    console.log();

    if (!origin) {
      console.log(pc.yellow('No mapping found for this line.'));
      return;
    }

    // Show the line content
    const lines = text.split('\n');
    const lineContent = lines[options.line - 1] || '';
    console.log(pc.dim('Content:'));
    console.log(`  ${lineContent}`);
    console.log();

    // Show the origin
    console.log(pc.dim('Source:'));
    console.log(`  Type: ${pc.cyan(origin.type)}`);

    if (origin.sectionType) {
      console.log(`  Section: ${pc.cyan(origin.sectionType)}`);
    }

    if (origin.fragmentId) {
      console.log(
        `  Fragment: ${pc.cyan(origin.fragmentId)}@${origin.fragmentVersion || '1.0.0'}`,
      );
    }

    if (origin.file) {
      const relFile = relative(process.cwd(), origin.file);
      console.log(
        `  File: ${pc.cyan(relFile)}${origin.fileLine ? `:${origin.fileLine}` : ''}`,
      );
    }

    if (origin.dynamicKey) {
      console.log(`  Dynamic key: ${pc.cyan(origin.dynamicKey)}`);
    }
  } else if (options.fragment) {
    // Find where a fragment appears
    const positions = sourceMap.positionsFrom(options.fragment);

    console.log(pc.cyan(`Positions of fragment "${options.fragment}":`));
    console.log();

    if (positions.length === 0) {
      console.log(pc.yellow('Fragment not found in rendered prompt.'));
      return;
    }

    const lines = text.split('\n');

    for (const pos of positions) {
      console.log(`Lines ${pos.line}-${getEndLine(text, pos.end)}:`);

      // Show a preview
      const startLine = pos.line - 1;
      const endLine = getEndLine(text, pos.end);
      const preview = lines.slice(startLine, Math.min(endLine, startLine + 3));

      for (let i = 0; i < preview.length; i++) {
        const lineNum = String(startLine + i + 1).padStart(4);
        console.log(pc.dim(`${lineNum} │`) + ` ${preview[i]}`);
      }

      if (endLine > startLine + 3) {
        console.log(
          pc.dim(`     │ ... (${endLine - startLine - 3} more lines)`),
        );
      }
      console.log();
    }
  } else {
    // Show full source map visualization
    console.log(pc.cyan('Source Map Visualization:'));
    console.log();
    console.log(sourceMap.visualize());
  }
}

/**
 * Get the end line number from a character offset
 */
function getEndLine(text: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === '\n') line++;
  }
  return line;
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
