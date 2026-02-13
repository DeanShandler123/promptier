# promptier

<p align="center">
  <img src="./assets/logo.png" alt="promptier" width="200" />
</p>

<p align="center">
  <strong>Compose, lint, and trace LLM system prompts.</strong>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> •
  <a href="#why-promptier">Why promptier?</a> •
  <a href="#features">Features</a> •
  <a href="#documentation">Docs</a> •
  <a href="#contributing">Contributing</a>
</p>

---

## Why promptier?

System prompts are **code**. They define agent behavior, capabilities, and constraints. Yet most teams treat them as strings scattered across their codebase, no structure, no validation, no visibility.

**promptier** gives you:

- **Structure** — Fluent API to compose prompts from typed sections (identity, capabilities, constraints, format)
- **Reusability** — Fragments you can version, share, and compose across agents
- **Validation** — Lint rules that catch issues before runtime (token limits, format mismatches, security concerns)
- **Visibility** — Source maps that trace every line of output back to its origin (like git blame for prompts)
- **Portability** — Model-aware formatting that works with Claude, GPT, Gemini, and others

```bash
npm install @promptier/core
```

## Quick Start

```typescript
import { prompt } from '@promptier/core';

const agent = prompt('customer-support')
  .model('claude-sonnet-4-20250514')
  .identity('You are a customer support agent for Acme Inc.')
  .capabilities(['Access customer order history', 'Process refunds up to $100'])
  .constraints(['Never share internal policies', 'Escalate legal questions'])
  .format('Respond in a friendly, professional tone.')
  .build();

// Render to text
const { text, meta } = await agent.render();

// Use with any LLM SDK
const response = await generateText({
  model: anthropic('claude-sonnet-4-20250514'),
  system: text,
  prompt: userMessage,
});
```

## Packages

| Package                                                              | Version                                                                                                   | Description                           |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| **[@promptier/core](https://www.npmjs.com/package/@promptier/core)** | [![npm](https://img.shields.io/npm/v/@promptier/core.svg)](https://www.npmjs.com/package/@promptier/core) | Prompt composition and rendering      |
| **[@promptier/lint](https://www.npmjs.com/package/@promptier/lint)** | [![npm](https://img.shields.io/npm/v/@promptier/lint.svg)](https://www.npmjs.com/package/@promptier/lint) | Linting engine with heuristic rules   |
| **[@promptier/cli](https://www.npmjs.com/package/@promptier/cli)**   | [![npm](https://img.shields.io/npm/v/@promptier/cli.svg)](https://www.npmjs.com/package/@promptier/cli)   | CLI for linting, rendering, debugging |

```bash
# Install all packages
npm install @promptier/core @promptier/lint @promptier/cli
```

## Features

### Fluent Prompt Builder

```typescript
const agent = prompt('assistant')
  .model('gpt-4o')
  .identity('You are a helpful assistant.')
  .capabilities(['Search the web', 'Run code'])
  .constraints(['Never make up facts'])
  .context(async (ctx) => `User timezone: ${ctx.timezone}`)
  .format('Be concise.')
  .build();
```

### Reusable Fragments

```typescript
import { Fragment } from '@promptier/core';

// Inline definition
const safety = Fragment.define(
  'safety',
  `
- Never generate harmful content
- Respect user privacy
- Escalate security concerns
`,
);

// Or load from markdown file
const identity = Fragment.fromFile('./prompts/identity.md');

// Use in prompts
agent.constraints(safety);
```

### Model-Aware Formatting

Prompts automatically format for the target model:

- **Claude**: XML tags (`<identity>`, `<constraints>`)
- **GPT**: Markdown headers (`## Identity`)
- **Gemini**: Plain text labels

### Source Maps & Tracing

Every rendered prompt includes a source map that traces each line back to its origin:

```typescript
const { text, meta } = await agent.render();

// meta.sourceMap.mappings contains:
[
  {
    output: { start: 0, end: 45, line: 1 },
    source: {
      type: 'identity',
      fragmentId: null,
      file: null,
    },
  },
  {
    output: { start: 46, end: 128, line: 3 },
    source: {
      type: 'constraints',
      fragmentId: 'safety-rules',
      version: 'a1b2c3d',
      file: './prompts/safety.md',
    },
  },
  {
    output: { start: 129, end: 203, line: 7 },
    source: {
      type: 'context',
      fragmentId: null,
      file: null,
      dynamic: true,
    },
  },
];
```

Use the CLI to visualize provenance:

```bash
$ promptier blame agent.ts

  1 │ <identity>                          │ identity
  2 │ You are a customer support agent... │ identity
  3 │ </identity>                         │ identity
  4 │ <constraints>                       │ constraints
  5 │ - Never share internal policies     │ constraints ← safety-rules (./prompts/safety.md)
  6 │ - Escalate legal questions          │ constraints ← safety-rules (./prompts/safety.md)
  7 │ - Process refunds up to $100        │ constraints ← refund-policy@v2.1
  8 │ </constraints>                      │ constraints
  9 │ <context>                           │ context (dynamic)
 10 │ Customer: Jane Doe (Premium)        │ context (dynamic)
 11 │ </context>                          │ context (dynamic)
```

When something goes wrong, you know exactly which fragment, file, and version produced each line.

### Linting

```bash
npm install @promptier/lint
```

```typescript
import { Linter } from '@promptier/lint';

const linter = new Linter();
const result = await linter.lint(agent);
// result.errors, result.warnings, result.info
```

Built-in heuristic rules catch:

- Token limit violations
- Model/format mismatches
- Cache inefficiencies
- Missing identity sections
- Security concerns (user input in system prompts)
- Contradictory instructions

#### Semantic Linting (LLM-powered)

For deeper analysis, promptier can use a local LLM via [Ollama](https://ollama.ai) to catch issues heuristics can't — contradictions, ambiguity, injection vulnerabilities, verbosity, and more.

```bash
# One-time setup
ollama pull llama3.2:3b

# Run with semantic analysis
promptier lint --semantic
```

Semantic linting catches:

- **Contradictions** — instructions that conflict with each other
- **Ambiguity** — vague instructions open to misinterpretation
- **Injection vulnerabilities** — patterns that could allow prompt injection
- **Verbosity** — redundant phrasing that wastes tokens
- **Missing best practices** — no error handling, missing edge case guidance
- **Scope creep** — instructions beyond the agent's stated role

Runs locally, no data leaves your machine. If Ollama isn't running, the linter falls back to heuristic rules only.

Enable permanently in config:

```typescript
// promptier.config.ts
import { defineConfig } from '@promptier/core';

export default defineConfig({
  lint: {
    llm: {
      enabled: true,
      model: 'llama3.2:3b', // default
    },
  },
});
```

See [lint rules documentation](./packages/lint/README.md#built-in-rules) for the full list.

### CLI

```bash
npm install -g @promptier/cli
```

```bash
promptier init              # Initialize project
promptier lint              # Lint all prompts
promptier lint --semantic   # Lint with LLM-powered semantic analysis
promptier render agent.ts   # Render prompt to stdout
promptier tokens agent.ts   # Count tokens
promptier blame agent.ts    # Trace prompt origins (like git blame)
```

#### File discovery

By default, `promptier lint` recursively finds all `*.agent.ts` and `*.agent.js` files in the current directory. You can also pass specific files:

```bash
# Auto-discover *.agent.ts files
promptier lint

# Lint specific files (any file that exports a Prompt works)
promptier lint src/prompts/support.ts lib/my-agent.ts
```

Any file that exports an object with `render()` and `sections` properties (i.e., a `Prompt` built with `prompt().build()`) will be picked up.

See [CLI documentation](./packages/cli/README.md) for all commands.

## Configuration

```typescript
// promptier.config.ts
import { defineConfig } from '@promptier/core';
import { defineRule } from '@promptier/lint';

export default defineConfig({
  name: 'my-project',
  defaultModel: 'claude-sonnet-4-20250514',
  prompts: './prompts/**/*.ts',
  lint: {
    rules: {
      'missing-identity': 'error',
      'token-limit-warning': ['warning', { threshold: 0.7 }],
    },
    custom: [
      // Custom lint rules
    ],
  },
});
```

## Documentation

- **[Examples](./examples/)** — Complete, runnable examples
- **[@promptier/core](./packages/core/README.md)** — Prompt composition API, fragments, formatters
- **[@promptier/lint](./packages/lint/README.md)** — Lint rules reference, custom rules
- **[@promptier/cli](./packages/cli/README.md)** — Command reference, project setup

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting a PR.

### Development

```bash
# Clone the repo
git clone https://github.com/DeanShandler123/promptier
cd promptier

# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm test

# Lint
npm run lint
```

### Submitting Changes

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Author

**Dean Shandler**

- GitHub: [DeanShandler123](https://github.com/DeanShandler123)

## License

MIT
