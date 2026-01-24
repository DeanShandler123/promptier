import { readFileSync, readdirSync, statSync } from 'fs';
import { join, basename, extname, resolve } from 'path';

import type {
  FragmentDefinition,
  FragmentMetadata,
  FragmentOptions,
} from './types.js';

/**
 * Fragment - A named, reusable piece of prompt text
 *
 * Fragments are the atomic unit of composition in promptier.
 * They are immutable once defined and can reference other fragments.
 */
export class Fragment {
  readonly id: string;
  readonly version: string;
  readonly content: string;
  readonly metadata?: FragmentMetadata;
  readonly sourceFile?: string;
  readonly sourceLine?: number;

  private constructor(definition: FragmentDefinition) {
    this.id = definition.id;
    this.version = definition.version;
    this.content = definition.content;
    this.metadata = definition.metadata;
    this.sourceFile = definition.sourceFile;
    this.sourceLine = definition.sourceLine;
  }

  /**
   * Define a fragment inline with content string or options object
   */
  static define(
    id: string,
    contentOrOptions: string | FragmentOptions,
  ): Fragment {
    if (typeof contentOrOptions === 'string') {
      return new Fragment({
        id,
        version: '1.0.0',
        content: contentOrOptions.trim(),
      });
    }

    const {
      content,
      version,
      description,
      author,
      tags,
      deprecated,
      supersededBy,
    } = contentOrOptions;
    return new Fragment({
      id,
      version: version || '1.0.0',
      content: content.trim(),
      metadata: {
        description,
        author,
        tags,
        deprecated,
        supersededBy,
      },
    });
  }

  /**
   * Load a fragment from a file
   *
   * Supports:
   * - .md files: Content is the file content, metadata from frontmatter
   * - .ts/.js files: Exports a fragment definition
   */
  static fromFile(filePath: string): Fragment {
    const absolutePath = resolve(filePath);
    const ext = extname(absolutePath);
    const content = readFileSync(absolutePath, 'utf-8');
    const id = basename(absolutePath, ext).replace(/\.fragment$/, '');

    if (ext === '.md') {
      const { frontmatter, body } = parseFrontmatter(content);
      return new Fragment({
        id: frontmatter.id || id,
        version: frontmatter.version || '1.0.0',
        content: body.trim(),
        metadata: {
          description: frontmatter.description,
          author: frontmatter.author,
          tags: frontmatter.tags,
          deprecated: frontmatter.deprecated,
          supersededBy: frontmatter.supersededBy,
        },
        sourceFile: absolutePath,
        sourceLine: 1,
      });
    }

    // For .ts/.js files, we expect the content to be a module that exports
    // a fragment definition. In this case we parse it statically.
    throw new Error(
      `Unsupported file extension: ${ext}. Use .md files for fragments.`,
    );
  }

  /**
   * Load all fragments from a directory
   * Returns an object with fragment ids as keys
   */
  static loadDir(
    dirPath: string,
    pattern = '**/*.md',
  ): Record<string, Fragment> {
    const absolutePath = resolve(dirPath);
    const fragments: Record<string, Fragment> = {};

    const files = findFiles(absolutePath, pattern);
    for (const file of files) {
      try {
        const fragment = Fragment.fromFile(file);
        fragments[toCamelCase(fragment.id)] = fragment;
      } catch (error) {
        // Skip files that can't be parsed as fragments
        console.warn(
          `Skipping ${file}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    return fragments;
  }

  /**
   * Compose multiple fragments into a new fragment
   */
  static compose(
    id: string,
    fragments: Fragment[],
    separator = '\n\n',
  ): Fragment {
    const content = fragments.map((f) => f.content).join(separator);
    const composedIds = fragments.map((f) => f.id);

    return new Fragment({
      id,
      version: '1.0.0',
      content,
      metadata: {
        description: `Composed from: ${composedIds.join(', ')}`,
        tags: [...new Set(fragments.flatMap((f) => f.metadata?.tags || []))],
      },
    });
  }

  /**
   * Get the fragment as a plain definition object
   */
  toDefinition(): FragmentDefinition {
    return {
      id: this.id,
      version: this.version,
      content: this.content,
      metadata: this.metadata,
      sourceFile: this.sourceFile,
      sourceLine: this.sourceLine,
    };
  }

  /**
   * Render the fragment content with template variables replaced
   */
  render(variables: Record<string, string> = {}): string {
    return this.content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return key in variables ? variables[key] : match;
    });
  }

  /**
   * Get all template variable names in the fragment
   */
  getVariables(): string[] {
    const matches = this.content.matchAll(/\{\{(\w+)\}\}/g);
    return [...new Set([...matches].map((m) => m[1]))];
  }

  /**
   * Check if this fragment is deprecated
   */
  isDeprecated(): boolean {
    return this.metadata?.deprecated === true;
  }

  /**
   * Get the token count for this fragment (requires token counter to be passed)
   */
  getTokenCount(counter: (text: string) => number): number {
    return counter(this.content);
  }
}

/**
 * Parse YAML frontmatter from markdown content
 */
interface Frontmatter {
  id?: string;
  version?: string;
  description?: string;
  author?: string;
  tags?: string[];
  deprecated?: boolean;
  supersededBy?: string;
}

function parseFrontmatter(content: string): {
  frontmatter: Frontmatter;
  body: string;
} {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const [, yamlContent, body] = match;
  const frontmatter: Frontmatter = {};

  // Simple YAML parsing (no external dependency)
  const lines = yamlContent.split('\n');
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    let value: string | boolean | string[] = line.slice(colonIndex + 1).trim();

    // Handle boolean values
    if (value === 'true') value = true as unknown as string;
    else if (value === 'false') value = false as unknown as string;
    // Handle array values (simple single-line format: [a, b, c])
    else if (value.startsWith('[') && value.endsWith(']')) {
      value = value
        .slice(1, -1)
        .split(',')
        .map((v) => v.trim().replace(/^['"]|['"]$/g, ''));
    }
    // Remove quotes
    else {
      value = value.replace(/^['"]|['"]$/g, '');
    }

    (frontmatter as Record<string, unknown>)[key] = value;
  }

  return { frontmatter, body };
}

/**
 * Find files matching a glob pattern (simple implementation)
 */
function findFiles(dir: string, pattern: string): string[] {
  const files: string[] = [];

  function walk(currentDir: string): void {
    const entries = readdirSync(currentDir);

    for (const entry of entries) {
      const fullPath = join(currentDir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (stat.isFile() && matchesPattern(fullPath, pattern)) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

/**
 * Simple glob pattern matching
 */
function matchesPattern(filePath: string, pattern: string): boolean {
  // Convert glob to regex (simplified)
  const regexPattern = pattern
    .replace(/\*\*/g, '<<<GLOBSTAR>>>')
    .replace(/\*/g, '[^/]*')
    .replace(/<<<GLOBSTAR>>>/g, '.*')
    .replace(/\./g, '\\.');

  const regex = new RegExp(`${regexPattern}$`);
  return regex.test(filePath);
}

/**
 * Convert kebab-case or snake_case to camelCase
 */
function toCamelCase(str: string): string {
  return str.replace(/[-_](.)/g, (_, char) => char.toUpperCase());
}
