/**
 * Customer Support Agent - Full-featured example
 *
 * Demonstrates:
 * - Reusable fragments
 * - Dynamic context injection
 * - Linting
 * - Source mapping
 *
 * Run: npx tsx agent.ts
 */
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { prompt, Fragment } from '@promptier/core';
import { Linter } from '@promptier/lint';

// Get the directory of this file (for resolving relative paths)
const __dirname = dirname(fileURLToPath(import.meta.url));

// Load reusable fragments (paths relative to this file)
const safetyRules = Fragment.fromFile(join(__dirname, 'fragments/safety.md'));
const responseFormat = Fragment.fromFile(
  join(__dirname, 'fragments/response-format.md'),
);

// Define the customer support agent
export const supportAgent = prompt('customer-support')
  .model('claude-sonnet-4-20250514')
  .identity(
    `You are a customer support agent for TechCorp.
You help customers with billing, technical issues, and general inquiries.
You are empathetic, patient, and solution-oriented.`,
  )
  .capabilities([
    'Look up order status and history',
    'Process refunds up to $100',
    'Reset passwords and unlock accounts',
    'Schedule callbacks with specialists',
    'Access knowledge base articles',
  ])
  .constraints(safetyRules)
  .context((ctx) => {
    // Dynamic context injected at render time
    const customerName = (ctx.customerName as string | undefined) ?? 'Unknown';
    const accountTier = (ctx.accountTier as string | undefined) ?? 'Standard';
    const openTickets = (ctx.openTickets as number | undefined) ?? 0;
    return `
Customer Info:
- Name: ${customerName}
- Account Tier: ${accountTier}
- Open Tickets: ${openTickets}

Current Time: ${new Date().toISOString()}
`;
  })
  .format(responseFormat)
  .build();

// Main function demonstrating usage
async function main() {
  // 1. Render with context
  console.log('=== Rendering Prompt ===\n');

  const { text, meta } = await supportAgent.render({
    customerName: 'Alice Johnson',
    accountTier: 'Premium',
    openTickets: 2,
  });

  console.log(text);
  console.log('\n=== Metadata ===\n');
  console.log(`Name: ${meta.name}`);
  console.log(`Model: ${meta.model}`);
  console.log(`Tokens: ${meta.tokenCount.toLocaleString()}`);
  console.log(`Cacheable: ${meta.cacheableTokens.toLocaleString()} tokens`);
  console.log(`Fragments used: ${meta.fragments.map((f) => f.id).join(', ')}`);

  // 2. Lint the prompt
  console.log('\n=== Linting ===\n');

  const linter = new Linter();
  const result = await linter.lint(supportAgent);

  if (result.passed) {
    console.log('✓ All checks passed');
  } else {
    console.log(
      `✗ ${result.errors.length} errors, ${result.warnings.length} warnings`,
    );
    for (const error of result.errors) {
      console.log(`  ERROR: ${error.message}`);
    }
    for (const warning of result.warnings) {
      console.log(`  WARN: ${warning.message}`);
    }
  }

  // 3. Source mapping (blame)
  console.log('\n=== Source Map (first 5 mappings) ===\n');

  for (const mapping of meta.sourceMap.mappings.slice(0, 5)) {
    console.log(
      `Lines ${mapping.output.line}: ${mapping.source.type}` +
        (mapping.source.fragmentId ? ` (${mapping.source.fragmentId})` : ''),
    );
  }
}

// Run if executed directly (not when imported by CLI)
if (process.argv[1]?.includes('agent.ts')) {
  main().catch(console.error);
}
