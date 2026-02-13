import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  COMPAT_FIXTURE_SCHEMA_VERSION,
  assertFixtureFiles,
  evaluateCaseReport,
  ensureCompatReportShape,
  loadCaseManifest,
  loadCases,
  parseCompatReport,
  selectCases,
  validateDeclaredCheckLabels,
  validateExpectedCheckLabels,
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
      expectedCheckLabels: ['hook handler safety'],
      cases: [
        {
          name: 'healthy',
          description: 'expected strict pass.',
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
      const manifest = loadCaseManifest(file);
      expect(manifest.expectedCheckLabels).toEqual(['hook handler safety']);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects invalid case metadata', () => {
    const root = makeTempDir('compat-cases-');
    const file = path.join(root, 'cases.json');
    fs.writeFileSync(file, JSON.stringify({
      schemaVersion: COMPAT_FIXTURE_SCHEMA_VERSION,
      expectedCheckLabels: ['hook handler safety'],
      cases: [
        {
          name: 'bad-status',
          description: 'fixture with invalid status metadata.',
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
      expectedCheckLabels: ['hook handler safety'],
      cases: [
        {
          name: 'bad-allow-missing',
          description: 'fixture with invalid allowMissingFiles metadata.',
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
      expectedCheckLabels: ['hook handler safety'],
      cases: [
        {
          name: 'bad-hint-metadata',
          description: 'fixture with invalid expectedHintIncludes metadata.',
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
      expectedCheckLabels: ['hook handler safety'],
      cases: []
    }), 'utf-8');
    try {
      expect(() => loadCases(file)).toThrow('schemaVersion');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects missing expectedCheckLabels metadata', () => {
    const root = makeTempDir('compat-cases-');
    const file = path.join(root, 'cases.json');
    fs.writeFileSync(file, JSON.stringify({
      schemaVersion: COMPAT_FIXTURE_SCHEMA_VERSION,
      cases: []
    }), 'utf-8');
    try {
      expect(() => loadCaseManifest(file)).toThrow('expectedCheckLabels');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects missing case description metadata', () => {
    const root = makeTempDir('compat-cases-');
    const file = path.join(root, 'cases.json');
    fs.writeFileSync(file, JSON.stringify({
      schemaVersion: COMPAT_FIXTURE_SCHEMA_VERSION,
      expectedCheckLabels: ['hook handler safety'],
      cases: [
        {
          name: 'missing-description',
          expectedExitCode: 0,
          expectedWarnings: 0,
          expectedErrors: 0,
          expectedCheckStatuses: { 'hook handler safety': 'ok' }
        }
      ]
    }), 'utf-8');
    try {
      expect(() => loadCases(file)).toThrow('missing description');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('filters selected case names and rejects unknown filters', () => {
    const cases = [
      { name: 'healthy', description: 'ok' },
      { name: 'missing-events', description: 'error drift' }
    ];
    expect(selectCases(cases, 'healthy')).toEqual([{ name: 'healthy', description: 'ok' }]);
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

  it('validates expected check labels against available report labels', () => {
    const cases = [
      {
        name: 'healthy',
        description: 'ok',
        expectedCheckStatuses: { 'hook handler safety': 'ok' },
        expectedDetailIncludes: { 'hook handler safety': 'all good' },
        expectedHintIncludes: { 'hook handler safety': 'execFileSync' }
      }
    ];
    expect(() => validateExpectedCheckLabels(cases, ['hook handler safety'])).not.toThrow();
    expect(() => validateExpectedCheckLabels(cases, ['skill metadata'])).toThrow('unknown check labels');
  });

  it('validates declared compat label contract against runtime labels', () => {
    expect(() => validateDeclaredCheckLabels(
      ['openclaw CLI available', 'hook handler safety'],
      ['openclaw CLI available', 'hook handler safety']
    )).not.toThrow();

    expect(() => validateDeclaredCheckLabels(
      ['openclaw CLI available', 'hook handler safety'],
      ['openclaw CLI available']
    )).toThrow('contract mismatch');

    expect(() => validateDeclaredCheckLabels(
      ['openclaw CLI available', 'hook handler safety'],
      ['hook handler safety', 'openclaw CLI available']
    )).toThrow('order mismatch');
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
        { name: 'healthy', description: 'ok' },
        { name: 'missing-events', description: 'error drift' }
      ])).not.toThrow();
      expect(() => validateFixtureDirectoryCoverage(root, [{ name: 'healthy', description: 'ok' }]))
        .toThrow('Unreferenced fixture directories');
      expect(() => validateFixtureDirectoryCoverage(root, [
        { name: 'healthy', description: 'ok' },
        { name: 'missing-package-hook', description: 'missing package hook' }
      ]))
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
        { name: 'healthy', description: 'ok' },
        { name: 'missing-events', description: 'bad' }
      ])).not.toThrow();

      expect(() => validateFixtureReadmeCoverage(readmePath, [
        { name: 'healthy', description: 'ok' },
        { name: 'missing-package-hook', description: 'missing package hook' }
      ])).toThrow('Undocumented fixture cases');

      fs.writeFileSync(readmePath, ['- `healthy` — ok', '- `extra-fixture` — stale'].join('\n'), 'utf-8');
      expect(() => validateFixtureReadmeCoverage(readmePath, [
        { name: 'healthy', description: 'ok' }
      ])).toThrow('README lists unknown fixture cases');

      fs.writeFileSync(readmePath, ['- `healthy` — stale description'].join('\n'), 'utf-8');
      expect(() => validateFixtureReadmeCoverage(readmePath, [
        { name: 'healthy', description: 'ok' }
      ])).toThrow('descriptions out of sync');

      fs.writeFileSync(
        readmePath,
        ['- `missing-events` — bad', '- `healthy` — ok'].join('\n'),
        'utf-8'
      );
      expect(() => validateFixtureReadmeCoverage(readmePath, [
        { name: 'healthy', description: 'ok' },
        { name: 'missing-events', description: 'bad' }
      ])).toThrow('scenario order is out of sync');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
