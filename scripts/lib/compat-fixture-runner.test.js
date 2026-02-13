import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  COMPAT_FIXTURE_SCHEMA_VERSION,
  assertFixtureFiles,
  evaluateCaseReport,
  ensureCompatReportShape,
  loadCases,
  parseCompatReport,
  selectCases,
  validateFixtureDirectoryCoverage,
  validateFixtureReadmeCoverage
} from './compat-fixture-runner.mjs';

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

describe('compat fixture runner utilities', () => {
  it('loads valid declarative cases from disk', () => {
    const root = makeTempDir('compat-cases-');
    const file = path.join(root, 'cases.json');
    fs.writeFileSync(file, JSON.stringify({
      schemaVersion: COMPAT_FIXTURE_SCHEMA_VERSION,
      cases: [
        {
          name: 'healthy',
          expectedExitCode: 0,
          expectedWarnings: 0,
          expectedErrors: 0,
          expectedCheckStatuses: { 'hook handler safety': 'ok' }
        }
      ]
    }), 'utf-8');
    try {
      const loaded = loadCases(file);
      expect(loaded).toHaveLength(1);
      expect(loaded[0].name).toBe('healthy');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects invalid case metadata', () => {
    const root = makeTempDir('compat-cases-');
    const file = path.join(root, 'cases.json');
    fs.writeFileSync(file, JSON.stringify({
      schemaVersion: COMPAT_FIXTURE_SCHEMA_VERSION,
      cases: [
        {
          name: 'bad-status',
          expectedExitCode: 0,
          expectedWarnings: 0,
          expectedErrors: 0,
          expectedCheckStatuses: { 'hook handler safety': 'invalid' }
        }
      ]
    }), 'utf-8');
    try {
      expect(() => loadCases(file)).toThrow('invalid status');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects invalid allowMissingFiles metadata', () => {
    const root = makeTempDir('compat-cases-');
    const file = path.join(root, 'cases.json');
    fs.writeFileSync(file, JSON.stringify({
      schemaVersion: COMPAT_FIXTURE_SCHEMA_VERSION,
      cases: [
        {
          name: 'bad-allow-missing',
          expectedExitCode: 0,
          expectedWarnings: 0,
          expectedErrors: 0,
          expectedCheckStatuses: { 'hook handler safety': 'ok' },
          allowMissingFiles: [123]
        }
      ]
    }), 'utf-8');
    try {
      expect(() => loadCases(file)).toThrow('allowMissingFiles');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects invalid expectedHintIncludes metadata', () => {
    const root = makeTempDir('compat-cases-');
    const file = path.join(root, 'cases.json');
    fs.writeFileSync(file, JSON.stringify({
      schemaVersion: COMPAT_FIXTURE_SCHEMA_VERSION,
      cases: [
        {
          name: 'bad-hint-metadata',
          expectedExitCode: 0,
          expectedWarnings: 0,
          expectedErrors: 0,
          expectedCheckStatuses: { 'hook handler safety': 'ok' },
          expectedHintIncludes: [123]
        }
      ]
    }), 'utf-8');
    try {
      expect(() => loadCases(file)).toThrow('hint expectation');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects unsupported fixture schema version', () => {
    const root = makeTempDir('compat-cases-');
    const file = path.join(root, 'cases.json');
    fs.writeFileSync(file, JSON.stringify({
      schemaVersion: 999,
      cases: []
    }), 'utf-8');
    try {
      expect(() => loadCases(file)).toThrow('schemaVersion');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('filters selected case names and rejects unknown filters', () => {
    const cases = [
      { name: 'healthy' },
      { name: 'missing-events' }
    ];
    expect(selectCases(cases, 'healthy')).toEqual([{ name: 'healthy' }]);
    expect(() => selectCases(cases, 'unknown')).toThrow('Unknown COMPAT_CASES entries');
  });

  it('validates compatibility report shape and parsing', () => {
    const report = {
      generatedAt: new Date().toISOString(),
      checks: [],
      warnings: 0,
      errors: 0
    };
    expect(() => ensureCompatReportShape(report, 'healthy')).not.toThrow();
    expect(parseCompatReport(JSON.stringify(report), 'healthy')).toEqual(report);
    expect(() => parseCompatReport('{}', 'bad')).toThrow('invalid JSON report');
  });

  it('evaluates expected report signals and surfaces mismatches', () => {
    const testCase = {
      expectedExitCode: 1,
      expectedWarnings: 1,
      expectedErrors: 0,
      expectedCheckStatuses: { 'hook handler safety': 'warn' },
      expectedDetailIncludes: { 'hook handler safety': '--profile auto' },
      expectedHintIncludes: { 'hook handler safety': 'execFileSync' }
    };
    const matchingReport = {
      generatedAt: new Date().toISOString(),
      warnings: 1,
      errors: 0,
      checks: [
        {
          label: 'hook handler safety',
          status: 'warn',
          detail: 'Missing --profile auto',
          hint: 'Use execFileSync and --profile auto'
        }
      ]
    };
    const mismatchReport = {
      generatedAt: new Date().toISOString(),
      warnings: 0,
      errors: 0,
      checks: [
        { label: 'hook handler safety', status: 'ok', detail: 'all good', hint: 'n/a' }
      ]
    };

    expect(evaluateCaseReport(testCase, matchingReport, 1)).toEqual({ passed: true, mismatches: [] });
    const mismatch = evaluateCaseReport(testCase, mismatchReport, 0);
    expect(mismatch.passed).toBe(false);
    expect(mismatch.mismatches.length).toBeGreaterThan(0);
  });

  it('asserts required fixture file layout', () => {
    const root = makeTempDir('compat-fixture-');
    fs.mkdirSync(path.join(root, 'hooks', 'clawvault'), { recursive: true });
    fs.writeFileSync(path.join(root, 'package.json'), '{}', 'utf-8');
    fs.writeFileSync(path.join(root, 'SKILL.md'), '---\n---', 'utf-8');
    fs.writeFileSync(path.join(root, 'hooks', 'clawvault', 'HOOK.md'), '---\n---', 'utf-8');
    fs.writeFileSync(path.join(root, 'hooks', 'clawvault', 'handler.js'), '', 'utf-8');
    try {
      expect(() => assertFixtureFiles('healthy', root)).not.toThrow();
      fs.rmSync(path.join(root, 'hooks', 'clawvault', 'handler.js'));
      expect(() => assertFixtureFiles('healthy', root)).toThrow('missing required files');
      expect(() => assertFixtureFiles('healthy', root, undefined, [path.join('hooks', 'clawvault', 'handler.js')])).not.toThrow();
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('validates fixture directory coverage against declarative cases', () => {
    const root = makeTempDir('compat-fixtures-root-');
    fs.mkdirSync(path.join(root, 'healthy'));
    fs.mkdirSync(path.join(root, 'missing-events'));
    try {
      expect(() => validateFixtureDirectoryCoverage(root, [
        { name: 'healthy' },
        { name: 'missing-events' }
      ])).not.toThrow();
      expect(() => validateFixtureDirectoryCoverage(root, [{ name: 'healthy' }]))
        .toThrow('Unreferenced fixture directories');
      expect(() => validateFixtureDirectoryCoverage(root, [{ name: 'healthy' }, { name: 'missing-package-hook' }]))
        .toThrow('Missing fixture directories');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('validates README coverage against declarative cases', () => {
    const root = makeTempDir('compat-readme-');
    const readmePath = path.join(root, 'README.md');
    try {
      fs.writeFileSync(readmePath, ['- `healthy` — ok', '- `missing-events` — bad'].join('\n'), 'utf-8');
      expect(() => validateFixtureReadmeCoverage(readmePath, [
        { name: 'healthy' },
        { name: 'missing-events' }
      ])).not.toThrow();

      expect(() => validateFixtureReadmeCoverage(readmePath, [
        { name: 'healthy' },
        { name: 'missing-package-hook' }
      ])).toThrow('Undocumented fixture cases');

      fs.writeFileSync(readmePath, ['- `healthy` — ok', '- `extra-fixture` — stale'].join('\n'), 'utf-8');
      expect(() => validateFixtureReadmeCoverage(readmePath, [
        { name: 'healthy' }
      ])).toThrow('README lists unknown fixture cases');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
