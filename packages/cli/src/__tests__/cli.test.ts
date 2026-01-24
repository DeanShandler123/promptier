import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Import commands
import { initCommand } from '../commands/init.js';

describe('CLI Commands', () => {
  describe('init command', () => {
    let testDir: string;

    beforeEach(() => {
      // Create a unique temp directory for each test
      testDir = join(tmpdir(), `promptier-test-${Date.now()}`);
      mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
      // Clean up
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true });
      }
    });

    it('creates project structure', () => {
      // Suppress console output
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      initCommand({ directory: testDir });

      // Check directories were created
      expect(existsSync(join(testDir, 'src/fragments'))).toBe(true);
      expect(existsSync(join(testDir, 'src/agents'))).toBe(true);

      // Check files were created
      expect(existsSync(join(testDir, 'promptier.config.ts'))).toBe(true);
      expect(existsSync(join(testDir, 'src/fragments/identity.md'))).toBe(true);
      expect(existsSync(join(testDir, 'src/agents/example.agent.ts'))).toBe(
        true,
      );

      consoleSpy.mockRestore();
    });

    it('creates valid config file', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      initCommand({ directory: testDir });

      const configContent = readFileSync(
        join(testDir, 'promptier.config.ts'),
        'utf-8',
      );

      // Check config contains expected content
      expect(configContent).toContain('defineConfig');
      expect(configContent).toContain('claude-sonnet-4-20250514');
      expect(configContent).toContain('fragments');
      expect(configContent).toContain('prompts');

      consoleSpy.mockRestore();
    });

    it('creates valid identity fragment', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      initCommand({ directory: testDir });

      const fragmentContent = readFileSync(
        join(testDir, 'src/fragments/identity.md'),
        'utf-8',
      );

      // Check fragment has frontmatter
      expect(fragmentContent).toContain('---');
      expect(fragmentContent).toContain('id: core-identity');
      expect(fragmentContent).toContain('version: 1.0.0');

      consoleSpy.mockRestore();
    });

    it('creates valid agent file', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      initCommand({ directory: testDir });

      const agentContent = readFileSync(
        join(testDir, 'src/agents/example.agent.ts'),
        'utf-8',
      );

      // Check agent imports and exports
      expect(agentContent).toContain("from '@promptier/core'");
      expect(agentContent).toContain('Fragment');
      expect(agentContent).toContain('Prompt');
      expect(agentContent).toContain('Section');
      expect(agentContent).toContain('export const exampleAgent');

      consoleSpy.mockRestore();
    });

    it('does not overwrite existing files', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Create config first
      mkdirSync(join(testDir), { recursive: true });
      writeFileSync(join(testDir, 'promptier.config.ts'), 'existing content');

      initCommand({ directory: testDir });

      // Check existing file was not overwritten
      const configContent = readFileSync(
        join(testDir, 'promptier.config.ts'),
        'utf-8',
      );
      expect(configContent).toBe('existing content');

      consoleSpy.mockRestore();
    });
  });

  describe('lint command', () => {
    // The lint command requires loading TypeScript files with jiti,
    // which is complex to test. We test the core linting logic separately
    // in the lint package tests.

    it('lint command module exports correctly', async () => {
      const { lintCommand } = await import('../commands/lint.js');
      expect(typeof lintCommand).toBe('function');
    });
  });

  describe('render command', () => {
    it('render command module exports correctly', async () => {
      const { renderCommand } = await import('../commands/render.js');
      expect(typeof renderCommand).toBe('function');
    });
  });

  describe('tokens command', () => {
    it('tokens command module exports correctly', async () => {
      const { tokensCommand } = await import('../commands/tokens.js');
      expect(typeof tokensCommand).toBe('function');
    });
  });

  describe('deps command', () => {
    it('deps command module exports correctly', async () => {
      const { depsCommand } = await import('../commands/deps.js');
      expect(typeof depsCommand).toBe('function');
    });
  });

  describe('blame command', () => {
    it('blame command module exports correctly', async () => {
      const { blameCommand } = await import('../commands/blame.js');
      expect(typeof blameCommand).toBe('function');
    });
  });
});

describe('CLI Main Entry', () => {
  it('has all command exports available', async () => {
    // Don't import the main index.ts directly as it runs program.parse()
    // Instead, verify each command module is importable
    const initModule = await import('../commands/init.js');
    const lintModule = await import('../commands/lint.js');
    const renderModule = await import('../commands/render.js');
    const tokensModule = await import('../commands/tokens.js');
    const depsModule = await import('../commands/deps.js');
    const blameModule = await import('../commands/blame.js');

    expect(initModule.initCommand).toBeDefined();
    expect(lintModule.lintCommand).toBeDefined();
    expect(renderModule.renderCommand).toBeDefined();
    expect(tokensModule.tokensCommand).toBeDefined();
    expect(depsModule.depsCommand).toBeDefined();
    expect(blameModule.blameCommand).toBeDefined();
  });
});
