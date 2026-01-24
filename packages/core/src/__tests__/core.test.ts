import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { Fragment } from '../fragment.js';
import { Section } from '../section.js';
import { Prompt, prompt } from '../prompt.js';
import { SourceMap } from '../source-map.js';
import { defineConfig } from '../index.js';
import {
  getModelConfig,
  registerModel,
  detectModelFamily,
  isValidModel,
} from '../models/index.js';
import { countTokens, estimateTokens } from '../tokens.js';
import {
  XmlFormatter,
  MarkdownFormatter,
  PlainFormatter,
} from '../format/index.js';

describe('Fragment', () => {
  describe('define', () => {
    it('creates fragment from string', () => {
      const fragment = Fragment.define('test-id', 'Test content');
      expect(fragment.id).toBe('test-id');
      expect(fragment.content).toBe('Test content');
      expect(fragment.version).toBe('1.0.0');
    });

    it('creates fragment from options object', () => {
      const fragment = Fragment.define('test-id', {
        content: 'Test content',
        version: '2.0.0',
        description: 'Test description',
        author: 'Test Author',
        tags: ['test', 'example'],
      });

      expect(fragment.id).toBe('test-id');
      expect(fragment.version).toBe('2.0.0');
      expect(fragment.metadata?.description).toBe('Test description');
      expect(fragment.metadata?.author).toBe('Test Author');
      expect(fragment.metadata?.tags).toEqual(['test', 'example']);
    });

    it('trims content whitespace', () => {
      const fragment = Fragment.define('test', '  \n  Content  \n  ');
      expect(fragment.content).toBe('Content');
    });
  });

  describe('fromFile', () => {
    let testDir: string;

    beforeEach(() => {
      testDir = join(tmpdir(), `promptier-test-${Date.now()}`);
      mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true });
      }
    });

    it('loads fragment from markdown file', () => {
      const mdContent = `---
id: file-fragment
version: 1.2.3
description: From file
tags: [a, b]
---

Fragment content from file.`;

      writeFileSync(join(testDir, 'test.md'), mdContent);

      const fragment = Fragment.fromFile(join(testDir, 'test.md'));
      expect(fragment.id).toBe('file-fragment');
      expect(fragment.version).toBe('1.2.3');
      expect(fragment.content).toBe('Fragment content from file.');
      expect(fragment.metadata?.tags).toEqual(['a', 'b']);
    });

    it('uses filename as id when not in frontmatter', () => {
      const mdContent = `---
version: 1.0.0
---

Content only.`;

      writeFileSync(join(testDir, 'my-fragment.md'), mdContent);

      const fragment = Fragment.fromFile(join(testDir, 'my-fragment.md'));
      expect(fragment.id).toBe('my-fragment');
    });

    it('handles files without frontmatter', () => {
      writeFileSync(
        join(testDir, 'plain.md'),
        'Plain content without frontmatter',
      );

      const fragment = Fragment.fromFile(join(testDir, 'plain.md'));
      expect(fragment.content).toBe('Plain content without frontmatter');
    });
  });

  describe('loadDir', () => {
    let testDir: string;

    beforeEach(() => {
      testDir = join(tmpdir(), `promptier-test-${Date.now()}`);
      mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true });
      }
    });

    it('loads all fragments from directory', () => {
      writeFileSync(join(testDir, 'one.md'), 'Content one');
      writeFileSync(join(testDir, 'two.md'), 'Content two');

      const fragments = Fragment.loadDir(testDir);
      expect(Object.keys(fragments)).toHaveLength(2);
      expect(fragments.one).toBeDefined();
      expect(fragments.two).toBeDefined();
    });

    it('converts kebab-case to camelCase keys', () => {
      writeFileSync(join(testDir, 'my-fragment-name.md'), 'Content');

      const fragments = Fragment.loadDir(testDir);
      expect(fragments.myFragmentName).toBeDefined();
    });
  });

  describe('compose', () => {
    it('combines multiple fragments', () => {
      const f1 = Fragment.define('f1', 'Part one');
      const f2 = Fragment.define('f2', 'Part two');

      const composed = Fragment.compose('combined', [f1, f2]);
      expect(composed.content).toBe('Part one\n\nPart two');
      expect(composed.metadata?.description).toContain('f1');
      expect(composed.metadata?.description).toContain('f2');
    });

    it('uses custom separator', () => {
      const f1 = Fragment.define('f1', 'Part one');
      const f2 = Fragment.define('f2', 'Part two');

      const composed = Fragment.compose('combined', [f1, f2], '\n---\n');
      expect(composed.content).toBe('Part one\n---\nPart two');
    });
  });

  describe('render', () => {
    it('replaces template variables', () => {
      const fragment = Fragment.define('test', 'Hello, {{name}}!');
      const rendered = fragment.render({ name: 'World' });
      expect(rendered).toBe('Hello, World!');
    });

    it('leaves unreplaced variables unchanged', () => {
      const fragment = Fragment.define('test', 'Hello, {{name}}!');
      const rendered = fragment.render({});
      expect(rendered).toBe('Hello, {{name}}!');
    });
  });

  describe('getVariables', () => {
    it('extracts template variable names', () => {
      const fragment = Fragment.define('test', '{{a}} and {{b}} and {{a}}');
      const vars = fragment.getVariables();
      expect(vars).toContain('a');
      expect(vars).toContain('b');
      expect(vars).toHaveLength(2); // Unique
    });
  });
});

describe('Section', () => {
  describe('factory methods', () => {
    it('creates identity section', () => {
      const section = Section.identity('You are helpful');
      expect(section.type).toBe('identity');
      expect(section.priority).toBe(0);
      expect(section.cacheable).toBe(true);
    });

    it('creates constraints section from array', () => {
      const section = Section.constraints(['No harm', 'Be honest']);
      expect(section.type).toBe('constraints');
      expect(section.content).toContain('- No harm');
      expect(section.content).toContain('- Be honest');
    });

    it('creates capabilities section from array', () => {
      const section = Section.capabilities(['Search', 'Calculate']);
      expect(section.type).toBe('capabilities');
      expect(section.content).toContain('- Search');
    });

    it('creates domain section', () => {
      const section = Section.domain('Security knowledge here');
      expect(section.type).toBe('domain');
    });

    it('creates tools section', () => {
      const section = Section.tools([
        { name: 'search', description: 'Search things' },
      ]);
      expect(section.type).toBe('tools');
      expect(section.content).toContain('search');
    });

    it('creates context section with function', () => {
      const section = Section.context(() => 'dynamic');
      expect(section.type).toBe('context');
      expect(section.cacheable).toBe(false);
      expect(typeof section.content).toBe('function');
    });

    it('creates examples section', () => {
      const section = Section.examples('Example: ...');
      expect(section.type).toBe('examples');
    });

    it('creates format section', () => {
      const section = Section.format('Respond in JSON');
      expect(section.type).toBe('format');
    });

    it('creates custom section', () => {
      const section = Section.custom('my-section', 'Custom content', {
        priority: 25,
      });
      expect(section.type).toBe('custom');
      expect(section.name).toBe('my-section');
      expect(section.priority).toBe(25);
    });
  });

  describe('isDynamic', () => {
    it('detects dynamic sections', () => {
      const dynamic = Section.context(() => 'dynamic');
      const static_ = Section.identity('static');

      expect(Section.isDynamic(dynamic)).toBe(true);
      expect(Section.isDynamic(static_)).toBe(false);
    });
  });
});

describe('Prompt', () => {
  describe('compose', () => {
    it('creates prompt with sections', () => {
      const p = Prompt.compose({
        name: 'test',
        model: 'claude-sonnet-4-20250514',
        sections: [Section.identity('You are helpful')],
      });

      expect(p.name).toBe('test');
      expect(p.model).toBe('claude-sonnet-4-20250514');
      expect(p.sections).toHaveLength(1);
    });
  });

  describe('render', () => {
    it('renders prompt to text', async () => {
      const p = Prompt.compose({
        name: 'test',
        model: 'claude-sonnet-4-20250514',
        sections: [Section.identity('You are helpful')],
      });

      const { text, meta } = await p.render();
      expect(text).toContain('helpful');
      expect(meta.name).toBe('test');
      expect(meta.tokenCount).toBeGreaterThan(0);
    });

    it('includes all sections', async () => {
      const p = Prompt.compose({
        name: 'test',
        model: 'claude-sonnet-4-20250514',
        sections: [
          Section.identity('Identity here'),
          Section.constraints(['Constraint one']),
          Section.format('Format here'),
        ],
      });

      const { text } = await p.render();
      expect(text).toContain('Identity');
      expect(text).toContain('Constraint');
      expect(text).toContain('Format');
    });

    it('resolves dynamic context', async () => {
      const p = Prompt.compose({
        name: 'test',
        model: 'claude-sonnet-4-20250514',
        sections: [
          Section.identity('You are helpful'),
          Section.context((ctx) => `User: ${ctx.userName}`),
        ],
      });

      const { text } = await p.render({ userName: 'Alice' });
      expect(text).toContain('Alice');
    });

    it('provides token count metadata', async () => {
      const p = Prompt.compose({
        name: 'test',
        model: 'claude-sonnet-4-20250514',
        sections: [Section.identity('You are a helpful assistant.')],
      });

      const { meta } = await p.render();
      expect(meta.tokenCount).toBeGreaterThan(0);
      expect(meta.tokensBySection).toBeDefined();
    });
  });

  describe('extend', () => {
    it('creates extended prompt', () => {
      const base = Prompt.compose({
        name: 'base',
        model: 'claude-sonnet-4-20250514',
        sections: [Section.identity('Base identity')],
      });

      const extended = base.extend({
        name: 'extended',
        sections: [Section.format('New format')],
      });

      expect(extended.name).toBe('extended');
      expect(extended.sections).toHaveLength(2);
    });
  });

  describe('dependencies', () => {
    it('returns fragment ids', () => {
      const fragment = Fragment.define('my-fragment', 'Content');
      const p = Prompt.compose({
        name: 'test',
        model: 'claude-sonnet-4-20250514',
        sections: [Section.identity(fragment)],
      });

      const deps = p.dependencies();
      expect(deps).toContain('my-fragment');
    });
  });
});

describe('PromptBuilder (fluent API)', () => {
  it('builds prompt with fluent syntax', async () => {
    const p = prompt('fluent-test')
      .model('claude-sonnet-4-20250514')
      .identity('You are helpful')
      .constraints(['Be safe', 'Be honest'])
      .format('Respond in JSON')
      .build();

    const { text } = await p.render();
    expect(text).toContain('helpful');
    expect(text).toContain('safe');
    expect(text).toContain('JSON');
  });

  it('supports dynamic context', async () => {
    const p = prompt('context-test')
      .model('claude-sonnet-4-20250514')
      .identity('You are helpful')
      .context((ctx) => `Today is ${ctx.date}`)
      .build();

    const { text } = await p.render({ date: '2026-01-24' });
    expect(text).toContain('2026-01-24');
  });
});

describe('SourceMap', () => {
  it('tracks fragment origins', () => {
    const sourceMap = new SourceMap('test-prompt');
    sourceMap.setRenderedText('Hello World\nLine two');

    sourceMap.addFragmentMapping({
      outputStart: 0,
      outputEnd: 11,
      fragmentId: 'greeting',
      fragmentVersion: '1.0.0',
      sectionType: 'identity',
      sectionIndex: 0,
    });

    const origin = sourceMap.originAtOffset(5);
    expect(origin?.fragmentId).toBe('greeting');
    expect(origin?.type).toBe('fragment');
  });

  it('tracks dynamic content', () => {
    const sourceMap = new SourceMap('test-prompt');
    sourceMap.setRenderedText('Dynamic content here');

    sourceMap.addDynamicMapping({
      outputStart: 0,
      outputEnd: 20,
      sectionType: 'context',
      sectionIndex: 0,
      dynamicKey: 'ctx.user',
    });

    const origin = sourceMap.originAtOffset(5);
    expect(origin?.type).toBe('dynamic');
    expect(origin?.dynamicKey).toBe('ctx.user');
  });

  it('serializes to JSON', () => {
    const sourceMap = new SourceMap('test-prompt');
    const json = sourceMap.toJSON();

    expect(json.version).toBe(1);
    expect(json.prompt).toBe('test-prompt');
    expect(Array.isArray(json.mappings)).toBe(true);
  });

  it('deserializes from JSON', () => {
    const original = new SourceMap('test-prompt');
    const json = original.toJSON();

    const restored = SourceMap.fromJSON(json);
    expect(restored.prompt).toBe('test-prompt');
  });
});

describe('Models', () => {
  describe('getModelConfig', () => {
    it('returns config for known models', () => {
      const config = getModelConfig('claude-sonnet-4-20250514');
      expect(config.preferredFormat).toBe('xml');
      expect(config.contextWindow).toBeGreaterThan(0);
    });

    it('returns default config for unknown models', () => {
      const config = getModelConfig('unknown-model-xyz');
      expect(config).toBeDefined();
      expect(config.contextWindow).toBeGreaterThan(0);
    });
  });

  describe('detectModelFamily', () => {
    it('detects Claude models', () => {
      expect(detectModelFamily('claude-sonnet-4-20250514')).toBe('claude');
      expect(detectModelFamily('anthropic.claude-3')).toBe('claude');
    });

    it('detects GPT models', () => {
      expect(detectModelFamily('gpt-4o')).toBe('gpt');
      expect(detectModelFamily('gpt-4-turbo')).toBe('gpt');
    });

    it('detects Gemini models', () => {
      expect(detectModelFamily('gemini-1.5-pro')).toBe('gemini');
    });

    it('returns unknown for unrecognized models', () => {
      expect(detectModelFamily('unknown-model')).toBe('unknown');
    });
  });

  describe('isValidModel', () => {
    it('always returns true (deprecated)', () => {
      // isValidModel is deprecated - all strings are valid
      expect(isValidModel('claude-sonnet-4-20250514')).toBe(true);
      expect(isValidModel('gpt-4o')).toBe(true);
      expect(isValidModel('')).toBe(true); // Even empty string returns true now
    });
  });

  describe('registerModel', () => {
    it('registers custom model', () => {
      registerModel('custom:test-model', {
        contextWindow: 4096,
        preferredFormat: 'plain',
        supportsSystemPrompt: true,
        supportsCaching: false,
        tokenizer: 'cl100k_base',
      });

      const config = getModelConfig('custom:test-model');
      expect(config.contextWindow).toBe(4096);
    });
  });
});

describe('Tokens', () => {
  describe('countTokens', () => {
    it('counts tokens in text', async () => {
      const count = await countTokens(
        'Hello, world!',
        'claude-sonnet-4-20250514',
      );
      expect(count).toBeGreaterThan(0);
    });
  });

  describe('estimateTokens', () => {
    it('estimates tokens quickly', () => {
      const estimate = estimateTokens('This is a test sentence.');
      expect(estimate).toBeGreaterThan(0);
    });
  });
});

describe('Formatters', () => {
  const testSections = [
    {
      type: 'identity' as const,
      content: 'You are helpful',
      priority: 100,
      cacheable: true,
      sourceMapping: {
        output: { start: 0, end: 15, line: 1, column: 0 },
        source: { type: 'literal' as const, sectionType: 'identity' as const },
      },
    },
    {
      type: 'format' as const,
      content: 'Respond in JSON',
      priority: 0,
      cacheable: true,
      sourceMapping: {
        output: { start: 16, end: 31, line: 2, column: 0 },
        source: { type: 'literal' as const, sectionType: 'format' as const },
      },
    },
  ];

  describe('XmlFormatter', () => {
    it('formats with XML tags', () => {
      const formatter = new XmlFormatter();
      const output = formatter.format(testSections);
      expect(output).toContain('<identity>');
      expect(output).toContain('</identity>');
      expect(output).toContain('<format>');
    });
  });

  describe('MarkdownFormatter', () => {
    it('formats with markdown headers', () => {
      const formatter = new MarkdownFormatter();
      const output = formatter.format(testSections);
      expect(output).toContain('## Identity');
      expect(output).toContain('## Output Format');
    });
  });

  describe('PlainFormatter', () => {
    it('formats with plain text labels', () => {
      const formatter = new PlainFormatter();
      const output = formatter.format(testSections);
      expect(output).toContain('IDENTITY');
      expect(output).toContain('FORMAT');
    });
  });
});

describe('defineConfig', () => {
  it('returns config object', () => {
    const config = defineConfig({
      name: 'test-project',
      defaultModel: 'claude-sonnet-4-20250514',
    });

    expect(config.name).toBe('test-project');
    expect(config.defaultModel).toBe('claude-sonnet-4-20250514');
  });

  it('provides type safety for config', () => {
    const config = defineConfig({
      fragments: {
        dirs: ['./fragments'],
        pattern: '**/*.md',
      },
      lint: {
        rules: {
          'token-limit-exceeded': 'error',
        },
      },
    });

    expect(config.fragments?.dirs).toEqual(['./fragments']);
    expect(config.lint?.rules?.['token-limit-exceeded']).toBe('error');
  });
});
