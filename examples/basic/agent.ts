/**
 * Basic Example - Simplest possible promptier usage
 *
 * Run: npx tsx agent.ts
 */
import { prompt, Fragment } from '@promptier/core';

// Fragments can be defined inline (useful for reusable pieces)
const guidelines = Fragment.define(
  'guidelines',
  `
- Be concise and direct
- Stay on topic
- Admit when you're unsure
- Use examples when helpful
`,
);

// Define an agent using the fluent API
export const agent = prompt('helpful-assistant')
  .model('claude-sonnet-4-20250514')
  .identity('You are a helpful AI assistant.')
  .capabilities(['Answer questions', 'Help with tasks', 'Provide explanations'])
  .constraints(guidelines) // Fragment works here
  .format('Respond in a clear, friendly tone.')
  .build();

// Render the prompt
async function main() {
  const { text, meta } = await agent.render();

  console.log('=== Rendered Prompt ===\n');
  console.log(text);
  console.log('\n=== Metadata ===\n');
  console.log(`Tokens: ${meta.tokenCount}`);
  console.log(`Cacheable tokens: ${meta.cacheableTokens}`);
  console.log(`Warnings: ${meta.warnings.length}`);
}

// Run if executed directly (not when imported by CLI)
if (process.argv[1]?.includes('agent.ts')) {
  main().catch(console.error);
}
