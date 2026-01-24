# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-01-24

### Added

- **@promptier/core**: Fluent prompt builder with typed sections (identity, capabilities, constraints, format)
- **@promptier/core**: Fragment system for reusable prompt pieces (`Fragment.define()`, `Fragment.fromFile()`)
- **@promptier/core**: Model-aware formatting (XML for Claude, Markdown for GPT, Plain for others)
- **@promptier/core**: Token counting and cache efficiency tracking
- **@promptier/core**: Source maps for prompt provenance tracking
- **@promptier/lint**: 11 built-in heuristic lint rules
- **@promptier/lint**: Configurable rule severity and options
- **@promptier/lint**: Inline ignore directives (`<!-- promptier-ignore -->`)
- **@promptier/lint**: Custom rule support via `defineRule()`
- **promptier CLI**: `init`, `lint`, `render`, `tokens`, `blame` commands
- Examples: basic, customer-support, with-vercel-ai
