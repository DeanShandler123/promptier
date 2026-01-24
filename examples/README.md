# Examples

Complete, runnable examples demonstrating promptier usage.

## Setup

From the repository root:

```bash
npm install
npm run build
```

Then in any example directory:

```bash
npx tsx agent.ts
```

## Examples

### [basic/](./basic/)

**Simplest possible usage** - 20 lines showing the fluent API.

```typescript
const agent = prompt('assistant')
  .model('claude-sonnet-4-20250514')
  .identity('You are a helpful AI assistant.')
  .capabilities(['Answer questions', 'Help with tasks'])
  .constraints(['Be concise', 'Stay on topic'])
  .format('Respond in a clear, friendly tone.')
  .build();

const { text, meta } = await agent.render();
```

### [customer-support/](./customer-support/)

**Full-featured example** showing:

- Reusable fragments (markdown files with frontmatter)
- Dynamic context injection at render time
- Linting with `@promptier/lint`
- Source mapping for debugging

```
customer-support/
├── agent.ts
└── fragments/
    ├── safety.md
    └── response-format.md
```

### [with-vercel-ai/](./with-vercel-ai/)

**Integration example** showing promptier with the Vercel AI SDK.

```typescript
import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { prompt } from '@promptier/core';

const { text: systemPrompt } = await agent.render();

const { text } = await generateText({
  model: anthropic('claude-sonnet-4-20250514'),
  system: systemPrompt,
  prompt: userMessage,
});
```

Requires: `npm install ai @ai-sdk/anthropic`

## Running Examples

```bash
# Basic
cd examples/basic && npx tsx agent.ts

# Customer support (with fragments)
cd examples/customer-support && npx tsx agent.ts

# Vercel AI integration (requires ANTHROPIC_API_KEY)
cd examples/with-vercel-ai && npx tsx agent.ts
```
