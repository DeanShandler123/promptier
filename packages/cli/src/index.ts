import { Command } from 'commander';
import pc from 'picocolors';

import { initCommand } from './commands/init.js';
import { lintCommand } from './commands/lint.js';
import { renderCommand } from './commands/render.js';
import { tokensCommand } from './commands/tokens.js';
import { depsCommand } from './commands/deps.js';
import { blameCommand } from './commands/blame.js';

const program = new Command();

program
  .name('promptier')
  .description('Compose, lint, and debug LLM system prompts.')
  .version('0.1.0');

// init command
program
  .command('init')
  .description('Initialize a new promptier project')
  .option('-d, --directory <path>', 'Target directory')
  .action(initCommand);

// lint command
program
  .command('lint [files...]')
  .description('Lint prompts for issues')
  .option('--fix', 'Auto-fix issues where possible')
  .option('-f, --format <format>', 'Output format (text or json)', 'text')
  .option('-c, --config <path>', 'Path to config file')
  .action(lintCommand);

// render command
program
  .command('render <file>')
  .description('Render a prompt for debugging')
  .option('-c, --context <json>', 'JSON context for rendering')
  .option('-o, --output <path>', 'Output file path')
  .option('-m, --show-meta', 'Show metadata')
  .action(renderCommand);

// tokens command
program
  .command('tokens [file]')
  .description('Analyze token usage in prompts')
  .option('-a, --all', 'Analyze all prompts')
  .action(tokensCommand);

// deps command
program
  .command('deps')
  .description('Analyze fragment dependencies')
  .option('-f, --fragment <id>', 'Show prompts using this fragment')
  .option('-p, --prompt <name>', 'Show fragments used by this prompt')
  .action(depsCommand);

// blame command
program
  .command('blame <file>')
  .description('Show provenance of prompt content')
  .option('-l, --line <number>', 'Blame a specific line', parseInt)
  .option('-f, --fragment <id>', 'Find where a fragment appears')
  .action(blameCommand);

// Parse and run
program.parse();

// If no command provided, show help
if (!process.argv.slice(2).length) {
  console.log(
    pc.cyan(`
  ╔═══════════════════════════════════════════════════════════╗
  ║                                                           ║
  ║   ${pc.bold('promptier')}                                            ║
  ║                                                           ║
  ║   Compose, lint, and debug LLM system prompts.            ║
  ║                                                           ║
  ╚═══════════════════════════════════════════════════════════╝
`),
  );
  program.help();
}
