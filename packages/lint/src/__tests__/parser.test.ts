import { describe, it, expect } from 'vitest';

import { parseSemanticResponse } from '../rules/semantic/parser.js';

describe('parseSemanticResponse', () => {
  it('parses valid JSON array correctly', () => {
    const raw = JSON.stringify([
      {
        id: 'semantic-contradiction',
        severity: 'warning',
        message: 'Conflicting instructions found',
        suggestion: 'Remove one of the conflicting statements',
        evidence: 'always X ... never X',
      },
    ]);

    const warnings = parseSemanticResponse(raw);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].id).toBe('semantic-contradiction');
    expect(warnings[0].category).toBe('contradiction');
    expect(warnings[0].severity).toBe('warning');
    expect(warnings[0].message).toBe('Conflicting instructions found');
    expect(warnings[0].suggestion).toBe(
      'Remove one of the conflicting statements',
    );
  });

  it('parses empty array correctly', () => {
    const warnings = parseSemanticResponse('[]');
    expect(warnings).toHaveLength(0);
  });

  it('parses JSON wrapped in markdown fences', () => {
    const raw =
      '```json\n[{"id": "semantic-ambiguity", "severity": "warning", "message": "Vague instruction"}]\n```';

    const warnings = parseSemanticResponse(raw);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].id).toBe('semantic-ambiguity');
    expect(warnings[0].category).toBe('ambiguity');
  });

  it('parses JSON wrapped in plain fences', () => {
    const raw =
      '```\n[{"id": "semantic-verbosity", "severity": "info", "message": "Redundant text"}]\n```';

    const warnings = parseSemanticResponse(raw);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].id).toBe('semantic-verbosity');
    expect(warnings[0].category).toBe('token-budget');
  });

  it('extracts array from surrounding text', () => {
    const raw =
      'Here are the issues:\n[{"id": "semantic-injection-risk", "severity": "error", "message": "Injection risk"}]\nThese are my findings.';

    const warnings = parseSemanticResponse(raw);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].id).toBe('semantic-injection-risk');
    expect(warnings[0].severity).toBe('error');
    expect(warnings[0].category).toBe('security');
  });

  it('returns parse-error warning for completely unparseable input', () => {
    const warnings = parseSemanticResponse(
      'This is not JSON at all, just plain text with no brackets.',
    );

    expect(warnings).toHaveLength(1);
    expect(warnings[0].id).toBe('semantic-parse-error');
    expect(warnings[0].severity).toBe('info');
    expect(warnings[0].message).toContain('unparseable');
  });

  it('skips items missing id', () => {
    const raw = JSON.stringify([
      { severity: 'warning', message: 'No ID here' },
      {
        id: 'semantic-ambiguity',
        severity: 'warning',
        message: 'Has ID',
      },
    ]);

    const warnings = parseSemanticResponse(raw);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].id).toBe('semantic-ambiguity');
  });

  it('skips items missing message', () => {
    const raw = JSON.stringify([
      { id: 'semantic-ambiguity', severity: 'warning' },
      {
        id: 'semantic-verbosity',
        severity: 'info',
        message: 'Has message',
      },
    ]);

    const warnings = parseSemanticResponse(raw);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].id).toBe('semantic-verbosity');
  });

  it('defaults severity to info when missing', () => {
    const raw = JSON.stringify([
      { id: 'semantic-ambiguity', message: 'Some issue' },
    ]);

    const warnings = parseSemanticResponse(raw);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].severity).toBe('info');
  });

  it('defaults severity to info when invalid', () => {
    const raw = JSON.stringify([
      { id: 'semantic-ambiguity', severity: 'critical', message: 'Issue' },
    ]);

    const warnings = parseSemanticResponse(raw);
    expect(warnings[0].severity).toBe('info');
  });

  it('maps known IDs to correct LintCategory', () => {
    const findings = [
      { id: 'semantic-contradiction', message: 'a' },
      { id: 'semantic-ambiguity', message: 'b' },
      { id: 'semantic-injection-risk', message: 'c' },
      { id: 'semantic-verbosity', message: 'd' },
      { id: 'semantic-missing-practice', message: 'e' },
      { id: 'semantic-scope-creep', message: 'f' },
    ];

    const warnings = parseSemanticResponse(JSON.stringify(findings));

    expect(warnings[0].category).toBe('contradiction');
    expect(warnings[1].category).toBe('ambiguity');
    expect(warnings[2].category).toBe('security');
    expect(warnings[3].category).toBe('token-budget');
    expect(warnings[4].category).toBe('best-practice');
    expect(warnings[5].category).toBe('best-practice');
  });

  it('defaults unknown IDs to best-practice category', () => {
    const raw = JSON.stringify([
      { id: 'semantic-unknown-thing', severity: 'info', message: 'Custom' },
    ]);

    const warnings = parseSemanticResponse(raw);
    expect(warnings[0].category).toBe('best-practice');
  });

  it('handles multiple findings', () => {
    const raw = JSON.stringify([
      {
        id: 'semantic-contradiction',
        severity: 'warning',
        message: 'First issue',
      },
      {
        id: 'semantic-verbosity',
        severity: 'info',
        message: 'Second issue',
        suggestion: 'Fix it',
      },
    ]);

    const warnings = parseSemanticResponse(raw);
    expect(warnings).toHaveLength(2);
    expect(warnings[0].message).toBe('First issue');
    expect(warnings[1].suggestion).toBe('Fix it');
  });

  it('skips non-object items in the array', () => {
    const raw = JSON.stringify([
      'not an object',
      null,
      42,
      { id: 'semantic-ambiguity', severity: 'warning', message: 'Valid' },
    ]);

    const warnings = parseSemanticResponse(raw);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].id).toBe('semantic-ambiguity');
  });

  it('returns parse-error for non-array JSON', () => {
    const raw = JSON.stringify({ id: 'test', message: 'not an array' });
    const warnings = parseSemanticResponse(raw);

    expect(warnings).toHaveLength(1);
    expect(warnings[0].id).toBe('semantic-parse-error');
  });

  it('returns parse-error for empty string', () => {
    const warnings = parseSemanticResponse('');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].id).toBe('semantic-parse-error');
  });

  it('returns parse-error for whitespace-only input', () => {
    const warnings = parseSemanticResponse('   \n\t  ');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].id).toBe('semantic-parse-error');
  });

  it('preserves evidence field from LLM output', () => {
    const raw = JSON.stringify([
      {
        id: 'semantic-contradiction',
        severity: 'warning',
        message: 'Conflicting instructions',
        evidence: 'always X ... never X',
      },
    ]);

    const warnings = parseSemanticResponse(raw);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].evidence).toBe('always X ... never X');
  });
});
