import { prompt } from '@promptier/core';

// A prompt with issues for testing linting
export const badAgent = prompt('bad-agent')
  .model('claude-sonnet-4-20250514')
  // Missing identity - should trigger warning
  .constraints([
    'Always be helpful. Some other text here. Always be helpful.', // Duplicate instruction
  ])
  .format('Be concise. Provide detailed explanations.') // Conflicting - concise vs detailed
  .build();
