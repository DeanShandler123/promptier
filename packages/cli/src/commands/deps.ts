import { existsSync } from 'fs';
import { resolve, relative } from 'path';

import pc from 'picocolors';
import { createJiti } from 'jiti';
import type { Prompt } from '@promptier/core';

// Create jiti instance for loading TypeScript files
const jiti = createJiti(import.meta.url, {
  interopDefault: true,
  moduleCache: false,
});

interface DepsOptions {
  fragment?: string;
  prompt?: string;
}

/**
 * Analyze fragment dependencies
 */
export async function depsCommand(options: DepsOptions): Promise<void> {
  const files = await findPromptFiles(process.cwd());

  if (files.length === 0) {
    console.log(pc.yellow('No prompt files found.'));
    return;
  }

  // Load all prompts and their dependencies
  const promptDeps: Map<string, { file: string; deps: string[] }> = new Map();

  for (const file of files) {
    const prompt = await loadPromptFromFile(file);
    if (!prompt) continue;

    promptDeps.set(prompt.name, {
      file,
      deps: prompt.dependencies(),
    });
  }

  if (options.fragment) {
    // Show what uses a specific fragment
    console.log(pc.cyan(`Prompts using fragment "${options.fragment}":`));
    console.log();

    let found = false;
    for (const [promptName, { file, deps }] of promptDeps) {
      if (deps.includes(options.fragment)) {
        found = true;
        const relPath = relative(process.cwd(), file);
        console.log(`  ${pc.bold(promptName)}`);
        console.log(`  ${pc.dim(relPath)}`);
        console.log();
      }
    }

    if (!found) {
      console.log(pc.yellow(`  No prompts use fragment "${options.fragment}"`));
    }
  } else if (options.prompt) {
    // Show what a specific prompt uses
    const entry = promptDeps.get(options.prompt);
    if (!entry) {
      console.log(pc.yellow(`Prompt "${options.prompt}" not found.`));
      return;
    }

    console.log(pc.cyan(`Dependencies of "${options.prompt}":`));
    console.log();

    if (entry.deps.length === 0) {
      console.log(
        pc.dim('  No fragment dependencies (uses inline strings only)'),
      );
    } else {
      for (const dep of entry.deps) {
        console.log(`  ${pc.bold(dep)}`);
      }
    }
  } else {
    // Show full dependency graph
    console.log(pc.cyan('Fragment Dependency Graph:'));
    console.log();

    // Build reverse index (fragment -> prompts that use it)
    const fragmentUsage: Map<string, string[]> = new Map();

    for (const [promptName, { deps }] of promptDeps) {
      for (const dep of deps) {
        const users = fragmentUsage.get(dep) || [];
        users.push(promptName);
        fragmentUsage.set(dep, users);
      }
    }

    // Print prompts and their dependencies
    console.log(pc.bold('Prompts:'));
    for (const [promptName, { file, deps }] of promptDeps) {
      const relPath = relative(process.cwd(), file);
      console.log(`  ${pc.cyan(promptName)} ${pc.dim(`(${relPath})`)}`);

      if (deps.length === 0) {
        console.log(pc.dim('    └── (no fragments)'));
      } else {
        for (let i = 0; i < deps.length; i++) {
          const prefix = i === deps.length - 1 ? '└──' : '├──';
          console.log(`    ${prefix} ${deps[i]}`);
        }
      }
      console.log();
    }

    // Print fragments and what uses them
    if (fragmentUsage.size > 0) {
      console.log(pc.bold('Fragments:'));
      for (const [fragment, users] of fragmentUsage) {
        console.log(`  ${pc.cyan(fragment)}`);
        console.log(pc.dim(`    Used by: ${users.join(', ')}`));
      }
    }
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
  if (!existsSync(filePath)) return null;

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
  } catch {
    return null;
  }
}
