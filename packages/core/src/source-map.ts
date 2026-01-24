import type { SourceMapData, SourceMapping, SectionType } from './types.js';

interface FragmentMappingOptions {
  outputStart: number;
  outputEnd: number;
  fragmentId: string;
  fragmentVersion: string;
  sectionType: SectionType;
  sectionIndex: number;
  sourceFile?: string;
  sourceLine?: number;
}

interface DynamicMappingOptions {
  outputStart: number;
  outputEnd: number;
  sectionType: SectionType;
  sectionIndex: number;
  dynamicKey?: string;
}

/**
 * SourceMap - Traces every character in rendered output to its origin
 *
 * Enables debugging by mapping output positions back to:
 * - Fragment IDs and versions
 * - Section types
 * - Source files and line numbers
 * - Dynamic content keys
 */
export class SourceMap {
  readonly version: 1 = 1;
  readonly prompt: string;
  private mappings: SourceMapping[] = [];

  constructor(promptName: string) {
    this.prompt = promptName;
  }

  /**
   * Add a mapping for a range in the output
   */
  addMapping(mapping: SourceMapping): void {
    this.mappings.push(mapping);
  }

  /**
   * Add a fragment mapping
   */
  addFragmentMapping(options: FragmentMappingOptions): void {
    const { line, column } = this.getLineColumn(options.outputStart);

    this.mappings.push({
      output: {
        start: options.outputStart,
        end: options.outputEnd,
        line,
        column,
      },
      source: {
        type: 'fragment',
        fragmentId: options.fragmentId,
        fragmentVersion: options.fragmentVersion,
        sectionType: options.sectionType,
        sectionIndex: options.sectionIndex,
        file: options.sourceFile,
        fileLine: options.sourceLine,
      },
    });
  }

  /**
   * Add a dynamic content mapping
   */
  addDynamicMapping(options: DynamicMappingOptions): void {
    const { line, column } = this.getLineColumn(options.outputStart);

    this.mappings.push({
      output: {
        start: options.outputStart,
        end: options.outputEnd,
        line,
        column,
      },
      source: {
        type: 'dynamic',
        sectionType: options.sectionType,
        sectionIndex: options.sectionIndex,
        dynamicKey: options.dynamicKey,
      },
    });
  }

  /**
   * Add a literal (inline string) mapping
   */
  addLiteralMapping(
    outputStart: number,
    outputEnd: number,
    sectionType: SectionType,
    sectionIndex: number,
  ): void {
    const { line, column } = this.getLineColumn(outputStart);

    this.mappings.push({
      output: {
        start: outputStart,
        end: outputEnd,
        line,
        column,
      },
      source: {
        type: 'literal',
        sectionType,
        sectionIndex,
      },
    });
  }

  /**
   * Add a generated content mapping (e.g., section headers, separators)
   */
  addGeneratedMapping(
    outputStart: number,
    outputEnd: number,
    sectionType?: SectionType,
    sectionIndex?: number,
  ): void {
    const { line, column } = this.getLineColumn(outputStart);

    this.mappings.push({
      output: {
        start: outputStart,
        end: outputEnd,
        line,
        column,
      },
      source: {
        type: 'generated',
        sectionType,
        sectionIndex,
      },
    });
  }

  /**
   * Get the origin of content at a specific position
   */
  originAt(line: number, column: number): SourceMapping['source'] | null {
    const charOffset = this.getCharOffset(line, column);

    for (const mapping of this.mappings) {
      if (
        charOffset >= mapping.output.start &&
        charOffset < mapping.output.end
      ) {
        return mapping.source;
      }
    }

    return null;
  }

  /**
   * Get the origin of content at a specific character offset
   */
  originAtOffset(offset: number): SourceMapping['source'] | null {
    for (const mapping of this.mappings) {
      if (offset >= mapping.output.start && offset < mapping.output.end) {
        return mapping.source;
      }
    }

    return null;
  }

  /**
   * Get all positions from a specific fragment
   */
  positionsFrom(fragmentId: string): SourceMapping['output'][] {
    return this.mappings
      .filter((m) => m.source.fragmentId === fragmentId)
      .map((m) => m.output);
  }

  /**
   * Get all mappings for a section type
   */
  getMappingsForSection(sectionType: SectionType): SourceMapping[] {
    return this.mappings.filter((m) => m.source.sectionType === sectionType);
  }

  /**
   * Get all unique fragment IDs in this source map
   */
  getFragmentIds(): string[] {
    const ids = new Set<string>();
    for (const mapping of this.mappings) {
      if (mapping.source.fragmentId) {
        ids.add(mapping.source.fragmentId);
      }
    }
    return [...ids];
  }

  /**
   * Serialize to JSON format
   */
  toJSON(): SourceMapData {
    return {
      version: 1,
      prompt: this.prompt,
      mappings: [...this.mappings],
    };
  }

  /**
   * Create from JSON data
   */
  static fromJSON(data: SourceMapData): SourceMap {
    const sourceMap = new SourceMap(data.prompt);
    for (const mapping of data.mappings) {
      sourceMap.addMapping(mapping);
    }
    return sourceMap;
  }

  /**
   * Generate a visual representation of the source map
   */
  visualize(_renderedText?: string): string {
    // Sort mappings by output start position
    const sorted = [...this.mappings].sort(
      (a, b) => a.output.start - b.output.start,
    );

    const lines: string[] = [];
    let currentLine = 1;
    let lineRanges: Array<{ start: number; end: number; source: string }> = [];

    for (const mapping of sorted) {
      // Group by line
      if (mapping.output.line > currentLine) {
        if (lineRanges.length > 0) {
          lines.push(formatLineRange(currentLine, lineRanges));
        }
        currentLine = mapping.output.line;
        lineRanges = [];
      }

      const sourceStr = formatSource(mapping.source);
      lineRanges.push({
        start: mapping.output.line,
        end: this.getLineFromOffset(mapping.output.end),
        source: sourceStr,
      });
    }

    // Handle last line
    if (lineRanges.length > 0) {
      lines.push(formatLineRange(currentLine, lineRanges));
    }

    // Consolidate adjacent lines with same source
    return consolidateVisualization(lines);
  }

  /**
   * Internal: Track current rendered text for line calculations
   */
  private renderedText = '';

  setRenderedText(text: string): void {
    this.renderedText = text;
  }

  private getLineColumn(offset: number): { line: number; column: number } {
    const text = this.renderedText;
    let line = 1;
    let column = 1;

    for (let i = 0; i < offset && i < text.length; i++) {
      if (text[i] === '\n') {
        line++;
        column = 1;
      } else {
        column++;
      }
    }

    return { line, column };
  }

  private getCharOffset(line: number, column: number): number {
    const text = this.renderedText;
    let currentLine = 1;
    let offset = 0;

    while (offset < text.length && currentLine < line) {
      if (text[offset] === '\n') {
        currentLine++;
      }
      offset++;
    }

    return offset + column - 1;
  }

  private getLineFromOffset(offset: number): number {
    const text = this.renderedText;
    let line = 1;

    for (let i = 0; i < offset && i < text.length; i++) {
      if (text[i] === '\n') {
        line++;
      }
    }

    return line;
  }
}

/**
 * Format a source reference for visualization
 */
function formatSource(source: SourceMapping['source']): string {
  switch (source.type) {
    case 'fragment':
      return `[${source.sectionType}] ${source.fragmentId}@${source.fragmentVersion}`;
    case 'dynamic':
      return `[${source.sectionType}] <dynamic${source.dynamicKey ? `: ${source.dynamicKey}` : ''}>`;
    case 'literal':
      return `[${source.sectionType}] <literal>`;
    case 'generated':
      return source.sectionType
        ? `[${source.sectionType}] <generated>`
        : '<generated>';
  }
}

/**
 * Format a line range for visualization
 */
function formatLineRange(
  line: number,
  ranges: Array<{ start: number; end: number; source: string }>,
): string {
  const endLine = Math.max(...ranges.map((r) => r.end));
  const lineStr =
    line === endLine ? `Line ${line}` : `Lines ${line}-${endLine}`;
  const sources = [...new Set(ranges.map((r) => r.source))].join(', ');
  return `${lineStr}:   ${sources}`;
}

/**
 * Consolidate visualization output
 */
function consolidateVisualization(lines: string[]): string {
  if (lines.length === 0) return 'No mappings';

  // Group consecutive lines with same source
  const consolidated: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const current = lines[i];
    const sourceMatch = current.match(/:   (.+)$/);
    if (!sourceMatch) {
      consolidated.push(current);
      i++;
      continue;
    }

    const currentSource = sourceMatch[1];
    let startLine = parseInt(current.match(/Line[s]? (\d+)/)?.[1] || '0');
    let endLine = startLine;

    // Look ahead for consecutive lines with same source
    let j = i + 1;
    while (j < lines.length) {
      const next = lines[j];
      const nextSourceMatch = next.match(/:   (.+)$/);
      if (!nextSourceMatch || nextSourceMatch[1] !== currentSource) break;

      const nextLineMatch = next.match(/Line[s]? (\d+)(?:-(\d+))?/);
      if (nextLineMatch) {
        endLine = parseInt(nextLineMatch[2] || nextLineMatch[1]);
      }
      j++;
    }

    if (startLine === endLine) {
      consolidated.push(`Lines ${startLine}:   ${currentSource}`);
    } else {
      consolidated.push(`Lines ${startLine}-${endLine}:   ${currentSource}`);
    }
    i = j;
  }

  return consolidated.join('\n');
}
