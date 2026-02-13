# @promptier/core

Core SDK for composing, rendering, and tracing LLM system prompts.

**Part of the [promptier](https://github.com/DeanShandler123/promptier) toolkit:**

- **@promptier/core** - Prompt composition and rendering (you are here)
- [@promptier/lint](https://www.npmjs.com/package/@promptier/lint) - Linting engine with heuristic rules
- [@promptier/cli](https://www.npmjs.com/package/@promptier/cli) - CLI for linting, rendering, and debugging

## Installation

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

const { text, meta } = await agent.render();
```

## API

### `prompt(name: string)`

Creates a new `PromptBuilder` for fluent prompt composition.

### PromptBuilder Methods

| Method                   | Description                                                       |
| ------------------------ | ----------------------------------------------------------------- |
| `.model(id)`             | Set target model (e.g., `'claude-sonnet-4-20250514'`, `'gpt-4o'`) |
| `.identity(content)`     | Define who the agent is                                           |
| `.capabilities(content)` | List what the agent can do                                        |
| `.constraints(content)`  | Define what the agent must not do                                 |
| `.domain(content)`       | Add domain-specific knowledge                                     |
| `.tools(definitions)`    | Add tool definitions                                              |
| `.examples(content)`     | Add few-shot examples                                             |
| `.format(content)`       | Specify output format                                             |
| `.context(fn)`           | Add dynamic runtime context                                       |
| `.custom(name, content)` | Add custom named section                                          |
| `.options(opts)`         | Set rendering options                                             |
| `.build()`               | Build the Prompt instance                                         |

### Section Types

| Type           | Cacheable    | Description                  |
| -------------- | ------------ | ---------------------------- |
| `identity`     | Yes          | Who the agent is             |
| `capabilities` | Yes          | What the agent can do        |
| `constraints`  | Yes          | What the agent must not do   |
| `domain`       | Yes          | Domain knowledge and context |
| `tools`        | Yes          | Available tool definitions   |
| `examples`     | Yes          | Few-shot examples            |
| `format`       | Yes          | Output format instructions   |
| `context`      | No           | Dynamic runtime context      |
| `custom`       | Configurable | User-defined sections        |

### Prompt Methods

```typescript
// Render to string
const { text, meta } = await agent.render(context?);

// Extend with additional sections
const extended = agent.extend({ sections: [...] });

// Get fragment dependencies
const deps = agent.dependencies();
```

### Fragment

Reusable prompt pieces with version tracking:

```typescript
import { Fragment } from '@promptier/core';

// Define inline
const safety = Fragment.define('safety-v1', {
  content: 'Never generate harmful content.',
  version: '1.0.0',
  description: 'Core safety rules',
});

// Load from markdown file
const identity = Fragment.fromFile('./prompts/identity.md');

// Load directory of fragments
const fragments = Fragment.loadDirectory('./prompts/fragments');
```

**Markdown frontmatter format:**

```markdown
---
id: core-identity
version: 1.0.0
description: Main agent identity
tags: [core, identity]
---

You are a helpful assistant.
```

### Model Utilities

```typescript
import {
  getModelConfig,
  detectModelFamily,
  registerModel,
  supportsCaching,
} from '@promptier/core';

// Get model configuration
const config = getModelConfig('claude-sonnet-4-20250514');
// { contextWindow: 200000, preferredFormat: 'xml', supportsCaching: true }

// Detect model family
detectModelFamily('claude-sonnet-4-20250514'); // 'claude'
detectModelFamily('gpt-4o'); // 'gpt'

// Register custom model
registerModel('my-model', {
  contextWindow: 8192,
  preferredFormat: 'plain',
  supportsCaching: false,
});
```

### Token Utilities

```typescript
import {
  countTokens,
  estimateTokens,
  exceedsContextWindow,
} from '@promptier/core';

// Accurate count (uses tiktoken)
const count = await countTokens(text, 'claude-sonnet-4-20250514');

// Fast estimate (~4 chars per token)
const estimate = estimateTokens(text);

// Check against model limit
const exceeds = await exceedsContextWindow(text, 'gpt-4o');
```

### Formatters

```typescript
import {
  XmlFormatter,
  MarkdownFormatter,
  PlainFormatter,
} from '@promptier/core';

const formatter = new XmlFormatter();
const output = formatter.format(sections);
```

Prompts automatically format for the target model:

- **Claude**: XML tags (`<identity>`, `<constraints>`)
- **GPT**: Markdown headers (`## Identity`)
- **Gemini**: Plain text labels

### Configuration

```typescript
import { defineConfig } from '@promptier/core';

export default defineConfig({
  name: 'my-project',
  defaultModel: 'claude-sonnet-4-20250514',
  prompts: './prompts/**/*.ts',
  fragments: {
    dirs: ['./prompts/fragments'],
  },
});
```

## Types

Key types exported:

- `Prompt` - Compiled prompt instance
- `PromptBuilder` - Fluent builder
- `Fragment` - Reusable prompt piece
- `Section` - Prompt section utilities
- `ModelIdentifier` - Model ID string
- `SectionType` - Section type union
- `SectionConfig` - Section configuration
- `CompiledPrompt` - Rendered output with metadata
- `LintWarning` - Lint warning structure

## License

MIT
