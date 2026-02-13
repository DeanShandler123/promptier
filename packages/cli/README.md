# @promptier/cli

CLI for composing, linting, and debugging LLM system prompts.

**Part of the [promptier](https://github.com/DeanShandler123/promptier) toolkit:**

- [@promptier/core](https://www.npmjs.com/package/@promptier/core) - Prompt composition and rendering
- [@promptier/lint](https://www.npmjs.com/package/@promptier/lint) - Linting engine with heuristic rules
- **@promptier/cli** - CLI for linting, rendering, and debugging (you are here)

## Installation

```bash
npm install -g @promptier/cli
```

Or use with npx:

```bash
npx @promptier/cli <command>
```

## Commands

### init

Initialize a new promptier project:

```bash
promptier init
promptier init --directory ./my-project
```

Creates:

- `promptier.config.ts` - Configuration file
- `src/fragments/` - Reusable prompt fragments
- `src/agents/` - Agent prompt definitions

### lint

Lint prompts for issues:

```bash
# Lint all .agent.ts files
promptier lint

# Lint specific files
promptier lint ./prompts/agent.ts ./prompts/helper.ts

# Output as JSON
promptier lint --format json

# Use specific config
promptier lint --config ./custom.config.ts
```

**Output:**

```
src/agents/support.agent.ts
  ✖ error    token-limit-exceeded
             Prompt exceeds context window (250000 > 200000 tokens)

  ⚠ warning  missing-identity
             Consider adding an identity section

──────────────────────────────────────────────────
1 error, 1 warning, 0 info
Linted 3 prompts in 42ms
```

### render

Render a prompt to stdout:

```bash
# Render to terminal
promptier render ./prompts/agent.ts

# Save to file
promptier render ./prompts/agent.ts > output.txt

# Output as JSON (includes metadata)
promptier render ./prompts/agent.ts --format json
```

### tokens

Count tokens in a prompt:

```bash
promptier tokens ./prompts/agent.ts
```

**Output:**

```
Prompt: customer-support
Model:  claude-sonnet-4-20250514

Total tokens:     1,247
Context window:   200,000
Usage:            0.6%

By section:
  identity:       45
  capabilities:   120
  constraints:    89
  format:         32
```

### deps

Show fragment dependencies:

```bash
promptier deps ./prompts/agent.ts
```

**Output:**

```
Prompt: customer-support

Dependencies:
  └─ core-identity (v1.0.0)
  └─ safety-rules (v2.1.0)
  └─ response-format (v1.0.0)
```

### blame

Show provenance of prompt content (like `git blame` for prompts):

```bash
# Show full source map
promptier blame ./prompts/agent.ts

# Blame a specific line
promptier blame ./prompts/agent.ts --line 15

# Find where a fragment appears
promptier blame ./prompts/agent.ts --fragment safety-v1
```

**Output:**

```text
Blame for line 15:

Content:
  Never share internal company policies.

Source:
  Type: fragment
  Section: constraints
  Fragment: safety-v1@1.0.0
  File: src/fragments/safety.md:3
```

## Configuration

Create `promptier.config.ts` in your project root:

```typescript
import { defineConfig } from '@promptier/core';
import { defineRule } from '@promptier/lint';

export default defineConfig({
  name: 'my-project',
  defaultModel: 'claude-sonnet-4-20250514',

  // Where to find prompts
  prompts: './src/agents/**/*.agent.ts',

  // Where to find fragments
  fragments: {
    dirs: ['./src/fragments'],
    pattern: '**/*.md',
  },

  // Lint configuration
  lint: {
    rules: {
      'missing-identity': 'error',
      'format-not-last': 'off',
    },
    custom: [
      // Your custom rules
    ],
  },

  // Output options
  output: {
    formatForModel: true,
    cacheOptimize: true,
  },
});
```

## File Conventions

### Agent Files

Name prompt files with `.agent.ts` extension:

```
src/agents/
  customer-support.agent.ts
  code-review.agent.ts
  data-analyst.agent.ts
```

### Fragment Files

Store reusable fragments as markdown:

```
src/fragments/
  identity.md
  safety-rules.md
  response-format.md
```

## Exit Codes

| Code | Meaning             |
| ---- | ------------------- |
| 0    | Success (no errors) |
| 1    | Lint errors found   |

## License

MIT
