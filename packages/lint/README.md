# @promptier/lint

Linting engine for promptier prompts. Catch common issues before runtime.

**Part of the [promptier](https://github.com/DeanShandler123/promptier) toolkit:**

- [@promptier/core](https://www.npmjs.com/package/@promptier/core) - Prompt composition and rendering
- **@promptier/lint** - Linting engine with heuristic rules (you are here)
- [@promptier/cli](https://www.npmjs.com/package/@promptier/cli) - CLI for linting, rendering, and debugging

## Installation

```bash
npm install @promptier/lint
```

## Quick Start

```typescript
import { Linter } from '@promptier/lint';
import { prompt } from '@promptier/core';

const agent = prompt('assistant')
  .model('claude-sonnet-4-20250514')
  .identity('You are helpful.')
  .build();

const linter = new Linter();
const result = await linter.lint(agent);

console.log(result.errors);   // Must fix
console.log(result.warnings); // Should fix
console.log(result.info);     // Consider
```

## Built-in Rules

### Token Budget

| Rule | Severity | Description |
|------|----------|-------------|
| `token-limit-exceeded` | error | Prompt exceeds model's context window |
| `token-limit-warning` | warning | Prompt uses >80% of context window |

### Model Mismatch

| Rule | Severity | Description |
|------|----------|-------------|
| `xml-tags-with-gpt` | warning | Using XML tags with GPT models (prefer markdown) |
| `markdown-with-claude` | info | Using markdown headers with Claude (prefer XML) |

### Cache Efficiency

| Rule | Severity | Description |
|------|----------|-------------|
| `dynamic-before-static` | warning | Dynamic content appears before cacheable content, reducing cache hit rate |

### Best Practice

| Rule | Severity | Description |
|------|----------|-------------|
| `missing-identity` | warning | No identity section defined - agents should know who they are |
| `empty-sections` | warning | Section has empty or whitespace-only content |

### Ordering

| Rule | Severity | Description |
|------|----------|-------------|
| `format-not-last` | info | Format section not at end of prompt (recommended position) |

### Duplication

| Rule | Severity | Description |
|------|----------|-------------|
| `duplicate-instructions` | warning | Same instruction appears multiple times |

### Security

| Rule | Severity | Description |
|------|----------|-------------|
| `user-input-in-system` | error | User input markers (`{{user.*}}`, `$user.*`) in static sections - potential injection risk |

### Contradiction

| Rule | Severity | Description |
|------|----------|-------------|
| `conflicting-patterns` | warning | Contradictory instructions (e.g., "always X" and "never X") |

## Inline Ignores

Disable rules directly in your prompt text:

```typescript
const agent = prompt('assistant')
  .model('claude-sonnet-4-20250514')
  .identity(`
    <!-- promptier-ignore missing-identity -->
    You are a helpful assistant.
  `)
  .build();
```

### Syntax

**XML-style** (recommended for Claude prompts):

```xml
<!-- promptier-ignore rule-id -->
<!-- promptier-ignore rule-id, other-rule -->
<!-- promptier-ignore-all -->
```

**Bracket-style** (works everywhere):

```text
[promptier-ignore: rule-id]
[promptier-ignore: rule-id, other-rule]
[promptier-ignore-all]
```

### Examples

Ignore a specific rule:

```xml
<!-- promptier-ignore missing-identity -->
```

Ignore multiple rules:

```xml
<!-- promptier-ignore missing-identity, empty-sections -->
```

Ignore all rules (use sparingly):

```xml
<!-- promptier-ignore-all -->
```

## Configuration

### Rule Severity

Override rule severity in config:

```typescript
const linter = new Linter({
  rules: {
    'missing-identity': 'error',    // Upgrade to error
    'format-not-last': 'off',       // Disable
    'markdown-with-claude': 'warning', // Upgrade to warning
  },
});
```

Severity levels: `'error'` | `'warning'` | `'info'` | `'off'`

### Rule Options

Some rules accept options. Use tuple syntax `[severity, options]`:

```typescript
const linter = new Linter({
  rules: {
    // token-limit-warning accepts a threshold (0-1, default 0.8)
    'token-limit-warning': ['warning', { threshold: 0.7 }],
  },
});
```

Available options:

| Rule                  | Option      | Default | Description                               |
|-----------------------|-------------|---------|-------------------------------------------|
| `token-limit-warning` | `threshold` | `0.8`   | Warn when usage exceeds this ratio (0-1)  |

### Via Config File

```typescript
// promptier.config.ts
import { defineConfig } from '@promptier/core';

export default defineConfig({
  lint: {
    rules: {
      'missing-identity': 'error',
      'format-not-last': 'off',
    },
  },
});
```

## Custom Rules

### Define a Rule

```typescript
import { defineRule } from '@promptier/lint';

const noTodos = defineRule({
  id: 'no-todos',
  category: 'best-practice',
  defaultSeverity: 'warning',
  description: 'No TODO comments in production prompts',
  check: (ctx) => {
    if (/TODO/i.test(ctx.text)) {
      return [{
        id: 'no-todos',
        category: 'best-practice',
        severity: 'warning',
        message: 'Remove TODO comments before deployment',
        suggestion: 'Complete or remove the TODO item',
      }];
    }
    return [];
  },
});
```

### Add to Linter

**Via constructor:**

```typescript
const linter = new Linter({
  custom: [noTodos],
});
```

**Via method:**

```typescript
const linter = new Linter();
linter.addRule(noTodos);
```

**Via config file:**

```typescript
// promptier.config.ts
import { defineConfig } from '@promptier/core';
import { defineRule } from '@promptier/lint';

export default defineConfig({
  lint: {
    custom: [
      defineRule({
        id: 'no-placeholder',
        category: 'best-practice',
        defaultSeverity: 'error',
        description: 'No placeholder text',
        check: (ctx) => /\[placeholder\]/i.test(ctx.text)
          ? [{ id: 'no-placeholder', category: 'best-practice', severity: 'error', message: 'Remove placeholders' }]
          : [],
      }),
    ],
  },
});
```

### LintContext

The `check` function receives a `LintContext` with:

```typescript
interface LintContext {
  prompt: Prompt;           // The Prompt instance
  text: string;             // Rendered prompt text
  sections: SectionConfig[]; // Array of sections
  modelId: string;          // Target model ID
  modelConfig: {
    contextWindow: number;
    preferredFormat: 'xml' | 'markdown' | 'plain';
    supportsCaching: boolean;
  };
  tokenCount: number;       // Token count of rendered text
  options?: RuleOptions;    // Rule-specific options from config
}
```

### LintWarning

Rules return an array of warnings:

```typescript
interface LintWarning {
  id: string;               // Rule ID
  category: LintCategory;   // Category for grouping
  severity: LintSeverity;   // 'error' | 'warning' | 'info'
  message: string;          // Human-readable message
  suggestion?: string;      // Optional fix suggestion
  evidence?: string;        // Optional quoted text from prompt (semantic rules)
  position?: {              // Optional source location
    start: number;
    end: number;
    line: number;
    column: number;
  };
}
```

### Categories

Built-in categories:
- `token-budget` - Token limit issues
- `model-mismatch` - Model-specific format issues
- `cache-inefficiency` - Prompt caching issues
- `best-practice` - General best practices
- `ordering` - Section ordering suggestions
- `duplication` - Duplicate content
- `security` - Security concerns
- `contradiction` - Conflicting instructions

## API

### Linter

```typescript
const linter = new Linter(config?);

// Lint a prompt
const result = await linter.lint(prompt);

// Add custom rule
linter.addRule(rule, severity?);

// Configure rule severity
linter.configureRule('rule-id', 'error');

// Disable rule
linter.disableRule('rule-id');

// Get all rule IDs
const ids = linter.getRuleIds();

// Get rule config
const severity = linter.getRuleConfig('rule-id');
```

### createLinter

Factory function for creating configured linters:

```typescript
import { createLinter } from '@promptier/lint';

const linter = createLinter({
  rules: { 'missing-identity': 'error' },
  custom: [myRule],
});
```

### lint

Quick lint function for simple use cases:

```typescript
import { lint } from '@promptier/lint';

const warnings = await lint(prompt);
```

### LintResult

```typescript
interface LintResult {
  passed: boolean;          // No errors
  errors: LintWarning[];    // Severity: error
  warnings: LintWarning[];  // Severity: warning
  info: LintWarning[];      // Severity: info
  stats: {
    rulesChecked: number;
    timeMs: number;
    llmCalls: number;       // Number of LLM calls made (semantic linting)
  };
}
```

## Semantic Linting (LLM-powered)

Enable LLM-powered analysis to catch issues heuristics can't — contradictions, ambiguity, injection risks, verbosity, and more. Runs locally via [Ollama](https://ollama.ai).

```bash
ollama pull llama3.2:3b
```

```typescript
const linter = new Linter({
  llm: {
    enabled: true,
    model: 'llama3.2:3b', // default
  },
});

const result = await linter.lint(agent);
// result.info may include semantic-* findings
```

### Semantic Rules

| Rule | Category | Description |
| ------ | ---------- | ------------- |
| `semantic-contradiction` | contradiction | Instructions that conflict with each other |
| `semantic-ambiguity` | ambiguity | Vague instructions open to misinterpretation |
| `semantic-injection-risk` | security | Patterns vulnerable to prompt injection |
| `semantic-verbosity` | token-budget | Redundant phrasing that wastes tokens |
| `semantic-missing-practice` | best-practice | Missing error handling or edge case guidance |
| `semantic-scope-creep` | best-practice | Instructions beyond the agent's stated role |

### Custom LLM Client

You can bring your own `LlmClient` implementation instead of using the built-in Ollama client. This is useful for connecting to OpenAI, Anthropic, or any other provider:

```typescript
import { Linter, type LlmClient } from '@promptier/lint';

const myClient: LlmClient = {
  modelName: 'gpt-4o',
  async generate(prompt, system) {
    // Call your preferred LLM provider
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          ...(system ? [{ role: 'system', content: system }] : []),
          { role: 'user', content: prompt },
        ],
      }),
    });
    const data = await response.json();
    return data.choices[0].message.content;
  },
  async healthCheck() {
    return { ok: true };
  },
};

const linter = new Linter({
  llm: {
    enabled: true,
    client: myClient, // Bypasses built-in provider factory
  },
});
```

### LlmClient Interface

```typescript
interface LlmClient {
  generate(prompt: string, system?: string): Promise<string>;
  healthCheck(): Promise<{ ok: boolean; error?: string }>;
  readonly modelName: string;
}
```

| Method | Description |
| -------- | ------------- |
| `generate(prompt, system?)` | Send a prompt (with optional system message) and return the raw text response |
| `healthCheck()` | Verify the provider is reachable and the model is available |
| `modelName` | Display name of the configured model |

When `client` is provided on `LlmConfig`, the `provider`, `model`, `host`, and `timeout` fields are ignored — your client is used directly.

## License

MIT
