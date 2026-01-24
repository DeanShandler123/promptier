import { prompt, Fragment } from '@promptier/core';

// Test fragment
const testIdentity = Fragment.define('test-identity', {
  content: 'You are a test assistant for unit testing.',
  version: '1.0.0',
  description: 'Test identity fragment',
});

// Test prompt
export const testAgent = prompt('test-agent')
  .model('claude-sonnet-4-20250514')
  .identity(testIdentity.content)
  .constraints(['Be helpful', 'Be accurate'])
  .format('Respond clearly.')
  .build();

// Another prompt for testing multiple prompts
export const anotherAgent = prompt('another-agent')
  .model('gpt-4o')
  .identity('You are another test assistant.')
  .build();
