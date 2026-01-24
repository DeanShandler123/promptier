import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

import pc from 'picocolors';

/**
 * Initialize a new promptier project
 */
export function initCommand(options: { directory?: string }): void {
  const targetDir = options.directory || process.cwd();

  console.log(pc.cyan('Initializing promptier project...\n'));

  // Create directory structure
  const dirs = ['src/fragments', 'src/agents'];

  for (const dir of dirs) {
    const fullPath = join(targetDir, dir);
    if (!existsSync(fullPath)) {
      mkdirSync(fullPath, { recursive: true });
      console.log(pc.green('  Created'), dir);
    } else {
      console.log(pc.yellow('  Exists'), dir);
    }
  }

  // Create config file
  const configPath = join(targetDir, 'promptier.config.ts');
  if (!existsSync(configPath)) {
    writeFileSync(configPath, CONFIG_TEMPLATE);
    console.log(pc.green('  Created'), 'promptier.config.ts');
  } else {
    console.log(pc.yellow('  Exists'), 'promptier.config.ts');
  }

  // Create example fragment
  const fragmentPath = join(targetDir, 'src/fragments/identity.md');
  if (!existsSync(fragmentPath)) {
    writeFileSync(fragmentPath, FRAGMENT_TEMPLATE);
    console.log(pc.green('  Created'), 'src/fragments/identity.md');
  }

  // Create example agent
  const agentPath = join(targetDir, 'src/agents/example.agent.ts');
  if (!existsSync(agentPath)) {
    writeFileSync(agentPath, AGENT_TEMPLATE);
    console.log(pc.green('  Created'), 'src/agents/example.agent.ts');
  }

  console.log('\n' + pc.green('Done!') + ' Project initialized.\n');
  console.log('Next steps:');
  console.log('  1. Install dependencies:');
  console.log(pc.cyan('     npm install @promptier/core'));
  console.log('  2. Edit your fragments in src/fragments/');
  console.log('  3. Create agents in src/agents/');
  console.log('  4. Run lint: ' + pc.cyan('promptier lint'));
}

const CONFIG_TEMPLATE = `import { defineConfig } from '@promptier/core';

export default defineConfig({
  name: 'my-project',
  root: './src',

  fragments: {
    dirs: ['./src/fragments'],
    pattern: '**/*.md',
  },

  prompts: {
    dirs: ['./src/agents'],
    pattern: '**/*.agent.ts',
  },

  defaultModel: 'claude-sonnet-4-20250514',

  lint: {
    rules: {
      'token-limit-exceeded': 'error',
      'cache-inefficiency': 'warning',
      'missing-identity': 'warning',
    },
  },

  output: {
    formatForModel: true,
    cacheOptimize: true,
    includeSourceMap: true,
  },
});
`;

const FRAGMENT_TEMPLATE = `---
id: core-identity
version: 1.0.0
description: Core agent identity
author: Your Name
tags: [identity, core]
---

You are a helpful AI assistant.
You provide accurate, helpful, and harmless responses.
`;

const AGENT_TEMPLATE = `import { Fragment, Prompt, Section } from '@promptier/core';

// Load fragments
const identity = Fragment.fromFile('./src/fragments/identity.md');

// Define the agent prompt
export const exampleAgent = Prompt.compose({
  name: 'example-agent',
  model: 'claude-sonnet-4-20250514',
  sections: [
    Section.identity(identity),
    Section.format(\`Respond in a clear and helpful manner.\`),
  ],
});

// Usage example:
// const { text, meta } = await exampleAgent.render();
`;
