import { existsSync } from 'fs';
import { resolve, relative } from 'path';

import pc from 'picocolors';
import { createJiti } from 'jiti';
import {
  Linter,
  createLlmClient,
  type LintResult,
  type LintRule,
  type LlmConfig,
} from '@promptier/lint';
import type { Prompt, LintWarning, promptierConfig } from '@promptier/core';

// Create jiti instance for loading TypeScript files
const jiti = createJiti(import.meta.url, {
  interopDefault: true,
  moduleCache: false,
});

interface LintOptions {
  fix?: boolean;
  semantic?: boolean;
  format?: 'text' | 'json';
  config?: string;
}

/**
 * Load config file if it exists
 */
async function loadConfig(
  configPath?: string,
): Promise<promptierConfig | null> {
  const configFiles = configPath
    ? [configPath]
    : ['promptier.config.ts', 'promptier.config.js', 'promptier.config.mjs'];

  for (const file of configFiles) {
    const fullPath = resolve(process.cwd(), file);
    if (existsSync(fullPath)) {
      try {
        const module = (await jiti.import(fullPath)) as Record<string, unknown>;
        return (module.default ?? module) as promptierConfig;
      } catch (error) {
        console.warn(
          pc.yellow(`Warning: Failed to load config from ${file}: ${error}`),
        );
      }
    }
  }
  return null;
}

/**
 * Lint prompts for issues
 */
export async function lintCommand(
  files: string[],
  options: LintOptions,
): Promise<void> {
  const startTime = Date.now();

  // Load config and create linter with custom rules
  const config = await loadConfig(options.config);

  // Resolve LLM config: --semantic flag overrides config file
  let llmConfig: LlmConfig | undefined;
  const semanticEnabled = options.semantic || config?.lint?.llm?.enabled;

  if (semanticEnabled) {
    llmConfig = {
      enabled: true,
      provider: config?.lint?.llm?.provider ?? 'ollama',
      model: config?.lint?.llm?.model ?? 'llama3.2:3b',
      host: config?.lint?.llm?.host ?? 'http://localhost:11434',
      timeout: config?.lint?.llm?.timeout,
    };

    // Run health check before linting — reuse client via llmConfig.client
    const client = createLlmClient(llmConfig);
    const health = await client.healthCheck();

    if (!health.ok) {
      console.log(pc.yellow(`Semantic linting unavailable: ${health.error}`));
      console.log(pc.dim('Continuing with heuristic rules only.\n'));
      llmConfig = undefined;
    } else {
      console.log(
        pc.dim(
          `Using ${llmConfig.provider ?? 'ollama'} (${client.modelName}) for semantic analysis\n`,
        ),
      );
      // Pass the verified client so the linter doesn't create a second one
      llmConfig.client = client;
    }
  }

  const linter = new Linter({
    rules: config?.lint?.rules,
    custom: config?.lint?.custom as LintRule[] | undefined,
    llm: llmConfig,
  });

  // Find files to lint
  const targetFiles =
    files.length > 0
      ? files.map((f) => resolve(f))
      : await findPromptFiles(process.cwd());

  if (targetFiles.length === 0) {
    console.log(pc.yellow('No prompt files found.'));
    console.log(
      'Run ' + pc.cyan('promptier init') + ' to create a new project.',
    );
    return;
  }

  const allResults: Array<{ file: string; result: LintResult }> = [];
  let totalErrors = 0;
  let totalWarnings = 0;
  let totalInfo = 0;

  // Lint each file
  for (const file of targetFiles) {
    try {
      const prompt = await loadPromptFromFile(file);
      if (!prompt) continue;

      const result = await linter.lint(prompt);
      allResults.push({ file, result });

      totalErrors += result.errors.length;
      totalWarnings += result.warnings.length;
      totalInfo += result.info.length;
    } catch (error) {
      console.error(pc.red(`Error loading ${file}:`), error);
    }
  }

  // Output results
  if (options.format === 'json') {
    outputJson(allResults);
  } else {
    outputText(allResults);
  }

  // Summary
  const elapsed = Date.now() - startTime;
  console.log('\n' + pc.dim('─'.repeat(50)));
  const totalLlmCalls = allResults.reduce(
    (sum, r) => sum + r.result.stats.llmCalls,
    0,
  );
  const semanticSuffix =
    totalLlmCalls > 0
      ? ` (includes ${totalLlmCalls} semantic check${totalLlmCalls !== 1 ? 's' : ''})`
      : '';
  console.log(
    `${totalErrors > 0 ? pc.red(`${totalErrors} error${totalErrors !== 1 ? 's' : ''}`) : pc.green('0 errors')}, ` +
      `${totalWarnings > 0 ? pc.yellow(`${totalWarnings} warning${totalWarnings !== 1 ? 's' : ''}`) : '0 warnings'}, ` +
      `${totalInfo} info` +
      semanticSuffix,
  );
  console.log(
    pc.dim(
      `Linted ${allResults.length} prompt${allResults.length !== 1 ? 's' : ''} in ${elapsed}ms`,
    ),
  );

  // Exit with error code if errors found
  if (totalErrors > 0) {
    process.exitCode = 1;
  }
}

/**
 * Output results as text
 */
function outputText(
  results: Array<{ file: string; result: LintResult }>,
): void {
  for (const { file, result } of results) {
    const relPath = relative(process.cwd(), file);

    if (
      result.errors.length + result.warnings.length + result.info.length ===
      0
    ) {
      continue;
    }

    console.log('\n' + pc.underline(relPath));

    for (const warning of result.errors) {
      console.log(formatWarning(warning, 'error'));
    }
    for (const warning of result.warnings) {
      console.log(formatWarning(warning, 'warning'));
    }
    for (const warning of result.info) {
      console.log(formatWarning(warning, 'info'));
    }
  }
}

/**
 * Output results as JSON
 */
function outputJson(
  results: Array<{ file: string; result: LintResult }>,
): void {
  const output = results.map(({ file, result }) => ({
    file: relative(process.cwd(), file),
    passed: result.passed,
    errors: result.errors,
    warnings: result.warnings,
    info: result.info,
  }));
  console.log(JSON.stringify(output, null, 2));
}

/**
 * Format a single warning for text output
 */
function formatWarning(
  warning: LintWarning,
  severity: 'error' | 'warning' | 'info',
): string {
  const icon =
    severity === 'error'
      ? pc.red('✖')
      : severity === 'warning'
        ? pc.yellow('⚠')
        : pc.blue('ℹ');

  const label =
    severity === 'error'
      ? pc.red('error')
      : severity === 'warning'
        ? pc.yellow('warning')
        : pc.blue('info');

  let line = `  ${icon} ${label}    ${pc.dim(warning.id)}\n`;
  line += `             ${warning.message}`;

  if (warning.suggestion) {
    line += '\n             ' + pc.dim(warning.suggestion);
  }

  if (warning.evidence) {
    line += '\n             ' + pc.dim(`"${warning.evidence}"`);
  }

  if (warning.position) {
    const posStr = warning.position.column
      ? `at line ${warning.position.line}:${warning.position.column}`
      : `at line ${warning.position.line}`;
    line += '\n             ' + pc.dim(posStr);
  }

  return line;
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
  if (!existsSync(filePath)) {
    console.error(pc.red(`File not found: ${filePath}`));
    return null;
  }

  // Use jiti to load TypeScript/JavaScript modules
  const module = (await jiti.import(filePath)) as Record<string, unknown>;

  // Look for exported prompts
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

  console.warn(pc.yellow(`No prompt found in ${filePath}`));
  return null;
}
