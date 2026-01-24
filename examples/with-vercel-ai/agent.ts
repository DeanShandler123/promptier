/**
 * Vercel AI SDK Integration Example
 *
 * Shows how to use promptier with the Vercel AI SDK.
 *
 * Install dependencies:
 *   npm install ai @ai-sdk/anthropic
 *
 * Set your API key:
 *   export ANTHROPIC_API_KEY=your-key
 *
 * Run: npx tsx agent.ts
 */
import { prompt } from '@promptier/core';

// Define your agent with promptier
export const codeReviewer = prompt('code-reviewer')
  .model('claude-sonnet-4-20250514')
  .identity(
    `You are an expert code reviewer.
You provide constructive, actionable feedback on code quality, security, and best practices.`,
  )
  .capabilities([
    'Identify bugs and logic errors',
    'Spot security vulnerabilities',
    'Suggest performance improvements',
    'Recommend better patterns and practices',
  ])
  .constraints([
    'Be constructive, not critical',
    'Prioritize issues by severity',
    'Provide specific line references when possible',
    'Suggest fixes, not just problems',
  ])
  .format(
    `Structure your review as:

## Summary
One sentence overall assessment.

## Issues Found
List issues by severity (Critical > High > Medium > Low).

## Suggestions
Optional improvements that aren't bugs.

## What's Good
Highlight positive aspects of the code.`,
  )
  .build();

// Example usage
async function main() {
  const codeToReview = `
function processUser(data) {
  const query = "SELECT * FROM users WHERE id = " + data.id;
  db.execute(query);

  if (data.role == "admin") {
    grantAllPermissions(data.id);
  }

  return { success: true };
}
`;

  console.log('=== Code Review Agent ===\n');

  // Render the system prompt
  const { text: systemPrompt, meta } = await codeReviewer.render();

  console.log('System prompt rendered:');
  console.log(`  Tokens: ${meta.tokenCount}`);
  console.log(`  Cacheable: ${meta.cacheableTokens} tokens\n`);

  // Try to use Vercel AI SDK if available
  try {
    const { generateText } = await import('ai');
    const { anthropic } = await import('@ai-sdk/anthropic');

    console.log('Calling Claude via Vercel AI SDK...\n');

    const { text } = await generateText({
      model: anthropic('claude-sonnet-4-20250514'),
      system: systemPrompt,
      prompt: `Please review this code:\n\n\`\`\`typescript\n${codeToReview}\n\`\`\``,
    });

    console.log(text);
  } catch (error) {
    // SDK not installed or API key missing
    const isModuleError =
      error instanceof Error &&
      (error.message.includes('Cannot find module') ||
        error.message.includes('MODULE_NOT_FOUND'));

    if (isModuleError) {
      console.log(
        'Vercel AI SDK not installed. Showing rendered prompt only.\n',
      );
      console.log('To run with LLM:');
      console.log('  npm install ai @ai-sdk/anthropic');
      console.log('  export ANTHROPIC_API_KEY=your-key\n');
    } else {
      console.log('API call failed (check ANTHROPIC_API_KEY).\n');
    }

    console.log('=== Rendered System Prompt ===\n');
    console.log(systemPrompt);

    console.log('\n=== Usage with Vercel AI SDK ===\n');
    console.log(`import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

const { text } = await generateText({
  model: anthropic('claude-sonnet-4-20250514'),
  system: systemPrompt,  // <-- from promptier
  prompt: userMessage,
});`);
  }
}

// Run if executed directly (not when imported by CLI)
if (process.argv[1]?.includes('agent.ts')) {
  main().catch(console.error);
}
