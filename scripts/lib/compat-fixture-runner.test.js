import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  assertBuildFreshness,
  COMPAT_FIXTURE_SCHEMA_VERSION,
  COMPAT_SUMMARY_SCHEMA_VERSION,
  assertFixtureFiles,
  buildCompatSummaryHeader,
  buildFixtureRunTelemetry,
  ensureReportDir,
  evaluateCaseReport,
  ensureCompatReportShape,
  ensureCompatSummaryShape,
  loadCompatSummary,
  loadCaseManifest,
  loadCases,
  parseCompatReport,
  selectCases,
  summarizeFixtureResults,
  validateCompatSummaryCaseReports,
  validateCheckStatusCoverage,
  validateDeclaredCheckLabels,
  validateExpectedCheckLabels,
  validateFixtureDirectoryCoverage,
  validateFixtureReadmeCoverage,
  writeCaseReport,
  writeSummaryReport
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
      expect(manifest.schemaVersion).toBe(COMPAT_FIXTURE_SCHEMA_VERSION);
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

  it('rejects allowMissingFiles paths outside required fixture file set', () => {
    const root = makeTempDir('compat-cases-');
    const file = path.join(root, 'cases.json');
    fs.writeFileSync(file, JSON.stringify({
      schemaVersion: COMPAT_FIXTURE_SCHEMA_VERSION,
      expectedCheckLabels: ['hook handler safety'],
      cases: [
        {
          name: 'bad-allow-missing-path',
          description: 'fixture with unknown allowMissingFiles path.',
          expectedExitCode: 1,
          expectedWarnings: 1,
          expectedErrors: 0,
          expectedCheckStatuses: { 'hook handler safety': 'warn' },
          allowMissingFiles: ['UNKNOWN.md']
        }
      ]
    }), 'utf-8');
    try {
      expect(() => loadCases(file)).toThrow('unknown required-file paths');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects invalid openclawExitCode metadata', () => {
    const root = makeTempDir('compat-cases-');
    const file = path.join(root, 'cases.json');
    fs.writeFileSync(file, JSON.stringify({
      schemaVersion: COMPAT_FIXTURE_SCHEMA_VERSION,
      expectedCheckLabels: ['hook handler safety'],
      cases: [
        {
          name: 'bad-openclaw-exit-code',
          description: 'fixture with invalid openclawExitCode metadata.',
          expectedExitCode: 1,
          expectedWarnings: 1,
          expectedErrors: 0,
          expectedCheckStatuses: { 'hook handler safety': 'warn' },
          openclawExitCode: 999
        }
      ]
    }), 'utf-8');
    try {
      expect(() => loadCases(file)).toThrow('openclawExitCode');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects invalid openclawSignal metadata', () => {
    const root = makeTempDir('compat-cases-');
    const file = path.join(root, 'cases.json');
    fs.writeFileSync(file, JSON.stringify({
      schemaVersion: COMPAT_FIXTURE_SCHEMA_VERSION,
      expectedCheckLabels: ['hook handler safety'],
      cases: [
        {
          name: 'bad-openclaw-signal',
          description: 'fixture with invalid openclawSignal metadata.',
          expectedExitCode: 1,
          expectedWarnings: 1,
          expectedErrors: 0,
          expectedCheckStatuses: { 'hook handler safety': 'warn' },
          openclawSignal: 'TERM'
        }
      ]
    }), 'utf-8');
    try {
      expect(() => loadCases(file)).toThrow('openclawSignal');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects invalid openclawMissing metadata', () => {
    const root = makeTempDir('compat-cases-');
    const file = path.join(root, 'cases.json');
    fs.writeFileSync(file, JSON.stringify({
      schemaVersion: COMPAT_FIXTURE_SCHEMA_VERSION,
      expectedCheckLabels: ['hook handler safety'],
      cases: [
        {
          name: 'bad-openclaw-missing',
          description: 'fixture with invalid openclawMissing metadata.',
          expectedExitCode: 1,
          expectedWarnings: 1,
          expectedErrors: 0,
          expectedCheckStatuses: { 'hook handler safety': 'warn' },
          openclawMissing: 'yes'
        }
      ]
    }), 'utf-8');
    try {
      expect(() => loadCases(file)).toThrow('openclawMissing');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects mixed openclawExitCode/openclawSignal metadata', () => {
    const root = makeTempDir('compat-cases-');
    const file = path.join(root, 'cases.json');
    fs.writeFileSync(file, JSON.stringify({
      schemaVersion: COMPAT_FIXTURE_SCHEMA_VERSION,
      expectedCheckLabels: ['hook handler safety'],
      cases: [
        {
          name: 'mixed-openclaw-metadata',
          description: 'fixture with both openclawExitCode and openclawSignal.',
          expectedExitCode: 1,
          expectedWarnings: 1,
          expectedErrors: 0,
          expectedCheckStatuses: { 'hook handler safety': 'warn' },
          openclawExitCode: 2,
          openclawSignal: 'SIGTERM'
        }
      ]
    }), 'utf-8');
    try {
      expect(() => loadCases(file)).toThrow('mutually exclusive');

      fs.writeFileSync(file, JSON.stringify({
        schemaVersion: COMPAT_FIXTURE_SCHEMA_VERSION,
        expectedCheckLabels: ['hook handler safety'],
        cases: [
          {
            name: 'mixed-openclaw-exit-missing',
            description: 'fixture with both openclawExitCode and openclawMissing.',
            expectedExitCode: 1,
            expectedWarnings: 1,
            expectedErrors: 0,
            expectedCheckStatuses: { 'hook handler safety': 'warn' },
            openclawExitCode: 2,
            openclawMissing: true
          }
        ]
      }), 'utf-8');
      expect(() => loadCases(file)).toThrow('mutually exclusive');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('requires openclaw readiness warning status for non-ready CLI simulations', () => {
    const root = makeTempDir('compat-cases-');
    const file = path.join(root, 'cases.json');
    try {
      fs.writeFileSync(file, JSON.stringify({
        schemaVersion: COMPAT_FIXTURE_SCHEMA_VERSION,
        expectedCheckLabels: ['openclaw CLI available'],
        cases: [
          {
            name: 'bad-openclaw-exit-status',
            description: 'non-zero openclaw exit without warning expectation.',
            expectedExitCode: 1,
            expectedWarnings: 1,
            expectedErrors: 0,
            expectedCheckStatuses: { 'openclaw CLI available': 'ok' },
            openclawExitCode: 2
          }
        ]
      }), 'utf-8');
      expect(() => loadCases(file)).toThrow('non-ready openclaw simulation');

      fs.writeFileSync(file, JSON.stringify({
        schemaVersion: COMPAT_FIXTURE_SCHEMA_VERSION,
        expectedCheckLabels: ['openclaw CLI available'],
        cases: [
          {
            name: 'bad-openclaw-signal-status',
            description: 'signal openclaw exit without warning expectation.',
            expectedExitCode: 1,
            expectedWarnings: 1,
            expectedErrors: 0,
            expectedCheckStatuses: { 'openclaw CLI available': 'ok' },
            openclawSignal: 'SIGTERM'
          }
        ]
      }), 'utf-8');
      expect(() => loadCases(file)).toThrow('non-ready openclaw simulation');

      fs.writeFileSync(file, JSON.stringify({
        schemaVersion: COMPAT_FIXTURE_SCHEMA_VERSION,
        expectedCheckLabels: ['openclaw CLI available'],
        cases: [
          {
            name: 'bad-openclaw-missing-status',
            description: 'missing openclaw simulation without warning expectation.',
            expectedExitCode: 1,
            expectedWarnings: 1,
            expectedErrors: 0,
            expectedCheckStatuses: { 'openclaw CLI available': 'ok' },
            openclawMissing: true
          }
        ]
      }), 'utf-8');
      expect(() => loadCases(file)).toThrow('non-ready openclaw simulation');
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

  it('rejects orphan detail/hint expectations without status entries', () => {
    const root = makeTempDir('compat-cases-');
    const file = path.join(root, 'cases.json');
    try {
      fs.writeFileSync(file, JSON.stringify({
        schemaVersion: COMPAT_FIXTURE_SCHEMA_VERSION,
        expectedCheckLabels: ['hook handler safety'],
        cases: [
          {
            name: 'orphan-detail-label',
            description: 'detail expectation without expected status label.',
            expectedExitCode: 1,
            expectedWarnings: 1,
            expectedErrors: 0,
            expectedCheckStatuses: { 'hook handler safety': 'warn' },
            expectedDetailIncludes: { 'skill metadata': 'metadata.openclaw' }
          }
        ]
      }), 'utf-8');
      expect(() => loadCases(file)).toThrow('detail expectation references label');

      fs.writeFileSync(file, JSON.stringify({
        schemaVersion: COMPAT_FIXTURE_SCHEMA_VERSION,
        expectedCheckLabels: ['hook handler safety'],
        cases: [
          {
            name: 'orphan-hint-label',
            description: 'hint expectation without expected status label.',
            expectedExitCode: 1,
            expectedWarnings: 1,
            expectedErrors: 0,
            expectedCheckStatuses: { 'hook handler safety': 'warn' },
            expectedHintIncludes: { 'skill metadata': 'metadata.openclaw' }
          }
        ]
      }), 'utf-8');
      expect(() => loadCases(file)).toThrow('hint expectation references label');
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

  it('rejects non-kebab-case fixture case names', () => {
    const root = makeTempDir('compat-cases-');
    const file = path.join(root, 'cases.json');
    fs.writeFileSync(file, JSON.stringify({
      schemaVersion: COMPAT_FIXTURE_SCHEMA_VERSION,
      expectedCheckLabels: ['hook handler safety'],
      cases: [
        {
          name: 'Bad Case Name',
          description: 'invalid case name format.',
          expectedExitCode: 1,
          expectedWarnings: 1,
          expectedErrors: 0,
          expectedCheckStatuses: { 'hook handler safety': 'warn' }
        }
      ]
    }), 'utf-8');
    try {
      expect(() => loadCases(file)).toThrow('kebab-case lowercase');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects invalid expected exit/count consistency in case metadata', () => {
    const root = makeTempDir('compat-cases-');
    const file = path.join(root, 'cases.json');
    try {
      fs.writeFileSync(file, JSON.stringify({
        schemaVersion: COMPAT_FIXTURE_SCHEMA_VERSION,
        expectedCheckLabels: ['hook handler safety'],
        cases: [
          {
            name: 'bad-exit',
            description: 'invalid exit code value.',
            expectedExitCode: 2,
            expectedWarnings: 0,
            expectedErrors: 0,
            expectedCheckStatuses: { 'hook handler safety': 'ok' }
          }
        ]
      }), 'utf-8');
      expect(() => loadCases(file)).toThrow('expectedExitCode must be 0 or 1');

      fs.writeFileSync(file, JSON.stringify({
        schemaVersion: COMPAT_FIXTURE_SCHEMA_VERSION,
        expectedCheckLabels: ['hook handler safety'],
        cases: [
          {
            name: 'bad-success-counts',
            description: 'success exit with non-zero warnings.',
            expectedExitCode: 0,
            expectedWarnings: 1,
            expectedErrors: 0,
            expectedCheckStatuses: { 'hook handler safety': 'warn' }
          }
        ]
      }), 'utf-8');
      expect(() => loadCases(file)).toThrow('expectedExitCode=0');

      fs.writeFileSync(file, JSON.stringify({
        schemaVersion: COMPAT_FIXTURE_SCHEMA_VERSION,
        expectedCheckLabels: ['hook handler safety'],
        cases: [
          {
            name: 'bad-failure-counts',
            description: 'failure exit with zero warnings and errors.',
            expectedExitCode: 1,
            expectedWarnings: 0,
            expectedErrors: 0,
            expectedCheckStatuses: { 'hook handler safety': 'ok' }
          }
        ]
      }), 'utf-8');
      expect(() => loadCases(file)).toThrow('expectedExitCode=1');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects empty expectedCheckStatuses metadata', () => {
    const root = makeTempDir('compat-cases-');
    const file = path.join(root, 'cases.json');
    fs.writeFileSync(file, JSON.stringify({
      schemaVersion: COMPAT_FIXTURE_SCHEMA_VERSION,
      expectedCheckLabels: ['hook handler safety'],
      cases: [
        {
          name: 'empty-status',
          description: 'missing status assertions.',
          expectedExitCode: 0,
          expectedWarnings: 0,
          expectedErrors: 0,
          expectedCheckStatuses: {}
        }
      ]
    }), 'utf-8');
    try {
      expect(() => loadCases(file)).toThrow('expectedCheckStatuses must include at least one');
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
    expect(() => selectCases(cases, 'healthy,healthy')).toThrow('Duplicate COMPAT_CASES entries');
    expect(() => selectCases(cases, ', ,')).toThrow('did not include any case names');
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

  it('rejects expectedCheckStatuses labels that are not declared in expectedCheckLabels', () => {
    const root = makeTempDir('compat-cases-');
    const file = path.join(root, 'cases.json');
    fs.writeFileSync(file, JSON.stringify({
      schemaVersion: COMPAT_FIXTURE_SCHEMA_VERSION,
      expectedCheckLabels: ['hook handler safety'],
      cases: [
        {
          name: 'undeclared-status-label',
          description: 'status labels must be declared by expectedCheckLabels.',
          expectedExitCode: 1,
          expectedWarnings: 1,
          expectedErrors: 0,
          expectedCheckStatuses: {
            'skill metadata': 'warn'
          }
        }
      ]
    }), 'utf-8');
    try {
      expect(() => loadCases(file)).toThrow('expectedCheckStatuses references undeclared check label');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
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

  it('validates status coverage across expected check labels', () => {
    const expectedLabels = ['openclaw CLI available', 'hook handler safety'];
    expect(() => validateCheckStatusCoverage([
      {
        name: 'healthy',
        expectedCheckStatuses: {
          'openclaw CLI available': 'ok',
          'hook handler safety': 'ok'
        }
      }
    ], expectedLabels)).not.toThrow();

    expect(() => validateCheckStatusCoverage([
      {
        name: 'healthy',
        expectedCheckStatuses: {
          'hook handler safety': 'ok'
        }
      }
    ], expectedLabels)).toThrow('do not cover labels');
  });

  it('writes optional compat report artifacts when report directory is provided', () => {
    const root = makeTempDir('compat-report-artifacts-');
    try {
      const summary = {
        ...buildCompatSummaryHeader({
          generatedAt: '2026-02-13T00:00:00.000Z',
          mode: 'contract',
          schemaVersion: COMPAT_FIXTURE_SCHEMA_VERSION,
          selectedCases: ['healthy'],
          expectedCheckLabels: ['openclaw CLI available'],
          runtimeCheckLabels: ['openclaw CLI available']
        }),
        total: 0,
        preflightDurationMs: 1,
        totalDurationMs: 1,
        averageDurationMs: 0,
        overallDurationMs: 1,
        slowestCases: [],
        failures: 0,
        passedCases: [],
        failedCases: [],
        results: []
      };
      const report = { generatedAt: new Date().toISOString(), checks: [], warnings: 0, errors: 0 };
      ensureReportDir(root);
      writeCaseReport(root, { name: 'healthy' }, report);
      writeSummaryReport(root, summary);

      const casePath = path.join(root, 'healthy.json');
      const summaryPath = path.join(root, 'summary.json');
      expect(fs.existsSync(casePath)).toBe(true);
      expect(fs.existsSync(summaryPath)).toBe(true);
      expect(JSON.parse(fs.readFileSync(casePath, 'utf-8'))).toEqual(report);
      expect(JSON.parse(fs.readFileSync(summaryPath, 'utf-8'))).toEqual(summary);
      expect(loadCompatSummary(summaryPath)).toEqual(summary);
      expect(() => validateCompatSummaryCaseReports(summary, root)).not.toThrow();

      expect(() => ensureReportDir('')).not.toThrow();
      expect(() => writeCaseReport('', { name: 'healthy' }, report)).not.toThrow();
      expect(() => writeSummaryReport('', summary)).not.toThrow();
      expect(() => writeCaseReport(root, { name: 'broken' }, { generatedAt: '2026-02-13T00:00:00.000Z' })).toThrow('report missing');
      expect(() => writeSummaryReport(root, { generatedAt: 'invalid' })).toThrow('compat summary');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('builds fixture runtime telemetry from per-case durations', () => {
    expect(buildFixtureRunTelemetry([
      { name: 'a', durationMs: 10 },
      { name: 'b', durationMs: 21 },
      { name: 'c', durationMs: 9 }
    ], 5)).toEqual({
      preflightDurationMs: 5,
      totalDurationMs: 40,
      averageDurationMs: 13,
      overallDurationMs: 45,
      slowestCases: [
        { name: 'b', durationMs: 21 },
        { name: 'a', durationMs: 10 },
        { name: 'c', durationMs: 9 }
      ]
    });

    expect(buildFixtureRunTelemetry([], -10)).toEqual({
      preflightDurationMs: 0,
      totalDurationMs: 0,
      averageDurationMs: 0,
      overallDurationMs: 0,
      slowestCases: []
    });
  });

  it('summarizes fixture pass/fail case names', () => {
    expect(summarizeFixtureResults([
      { name: 'healthy', passed: true },
      { name: 'missing-events', passed: false },
      { name: 'missing-package-hook', passed: false }
    ])).toEqual({
      total: 3,
      failures: 2,
      passedCases: ['healthy'],
      failedCases: ['missing-events', 'missing-package-hook']
    });
  });

  it('builds compatibility summary headers with schema versioning', () => {
    const header = buildCompatSummaryHeader({
      generatedAt: '2026-02-13T00:00:00.000Z',
      mode: 'fixtures',
      schemaVersion: COMPAT_FIXTURE_SCHEMA_VERSION,
      selectedCases: ['healthy'],
      expectedCheckLabels: ['openclaw CLI available'],
      runtimeCheckLabels: ['openclaw CLI available']
    });
    expect(header).toEqual({
      summarySchemaVersion: COMPAT_SUMMARY_SCHEMA_VERSION,
      generatedAt: '2026-02-13T00:00:00.000Z',
      mode: 'fixtures',
      schemaVersion: COMPAT_FIXTURE_SCHEMA_VERSION,
      selectedCases: ['healthy'],
      selectedTotal: 1,
      expectedCheckLabels: ['openclaw CLI available'],
      runtimeCheckLabels: ['openclaw CLI available']
    });
    expect(() => buildCompatSummaryHeader({
      generatedAt: '',
      mode: 'unknown',
      schemaVersion: COMPAT_FIXTURE_SCHEMA_VERSION,
      selectedCases: [],
      expectedCheckLabels: [],
      runtimeCheckLabels: []
    })).toThrow('Unsupported summary mode');

    expect(() => buildCompatSummaryHeader({
      generatedAt: '',
      mode: 'fixtures',
      schemaVersion: COMPAT_FIXTURE_SCHEMA_VERSION,
      selectedCases: ['healthy', 'healthy'],
      expectedCheckLabels: ['openclaw CLI available'],
      runtimeCheckLabels: ['openclaw CLI available']
    })).toThrow('Duplicate summary header entries in selectedCases');

    expect(() => buildCompatSummaryHeader({
      generatedAt: '',
      mode: 'fixtures',
      schemaVersion: COMPAT_FIXTURE_SCHEMA_VERSION,
      selectedCases: ['healthy'],
      expectedCheckLabels: ['openclaw CLI available'],
      runtimeCheckLabels: [123]
    })).toThrow('Invalid summary header field');
  });

  it('validates compatibility summary shape invariants', () => {
    const summary = {
      ...buildCompatSummaryHeader({
        generatedAt: '2026-02-13T00:00:00.000Z',
        mode: 'fixtures',
        schemaVersion: COMPAT_FIXTURE_SCHEMA_VERSION,
        selectedCases: ['healthy'],
        expectedCheckLabels: ['openclaw CLI available'],
        runtimeCheckLabels: ['openclaw CLI available']
      }),
      total: 1,
      preflightDurationMs: 10,
      totalDurationMs: 20,
      averageDurationMs: 20,
      overallDurationMs: 30,
      slowestCases: [{ name: 'healthy', durationMs: 20 }],
      failures: 0,
      passedCases: ['healthy'],
      failedCases: [],
      results: [{
        name: 'healthy',
        expectedExitCode: 0,
        actualExitCode: 0,
        passed: true,
        durationMs: 20,
        mismatches: []
      }]
    };
    expect(() => ensureCompatSummaryShape(summary)).not.toThrow();

    expect(() => ensureCompatSummaryShape({
      ...summary,
      failures: 1
    })).toThrow('failures must equal failedCases.length');

    expect(() => ensureCompatSummaryShape({
      ...summary,
      selectedTotal: 2
    })).toThrow('selectedTotal must equal selectedCases.length');

    expect(() => ensureCompatSummaryShape({
      ...summary,
      passedCases: ['healthy', 'healthy']
    })).toThrow('Duplicate summary header entries in passedCases');
    expect(() => ensureCompatSummaryShape({
      ...summary,
      selectedCases: ['healthy', 'missing-events'],
      selectedTotal: 2
    })).toThrow('fixtures summary total must equal selectedTotal');
    expect(() => ensureCompatSummaryShape({
      ...summary,
      passedCases: [],
      failedCases: []
    })).toThrow('result marked passed but absent from passedCases');
    expect(() => ensureCompatSummaryShape({
      ...summary,
      selectedCases: ['healthy', 'missing-events'],
      selectedTotal: 2,
      total: 2,
      passedCases: ['healthy', 'missing-events'],
      results: [
        {
          name: 'missing-events',
          expectedExitCode: 1,
          actualExitCode: 1,
          passed: true,
          durationMs: 15,
          mismatches: []
        },
        {
          ...summary.results[0]
        }
      ]
    })).toThrow('results order must match selectedCases order');
    expect(() => ensureCompatSummaryShape({
      ...summary,
      results: [{
        ...summary.results[0],
        expectedExitCode: 1,
        actualExitCode: 0,
        passed: true,
        mismatches: []
      }]
    })).toThrow('passed cases must match expected and actual exit codes');
    expect(() => ensureCompatSummaryShape({
      ...summary,
      results: [{
        ...summary.results[0],
        passed: false,
        mismatches: []
      }]
    })).toThrow('failed cases must include mismatch details');
    expect(() => ensureCompatSummaryShape({
      ...summary,
      results: [{
        ...summary.results[0],
        mismatches: ['unexpected mismatch']
      }]
    })).toThrow('passed cases must not include mismatches');
    expect(() => ensureCompatSummaryShape({
      ...summary,
      slowestCases: []
    })).toThrow('slowestCases length must equal min(3, total)');
    expect(() => ensureCompatSummaryShape({
      ...summary,
      slowestCases: [{ name: 'healthy', durationMs: 999 }]
    })).toThrow('slowestCases duration mismatch');
    expect(() => ensureCompatSummaryShape({
      ...summary,
      selectedCases: ['healthy', 'missing-events'],
      selectedTotal: 2,
      total: 2,
      passedCases: ['healthy', 'missing-events'],
      results: [
        { ...summary.results[0] },
        {
          name: 'missing-events',
          expectedExitCode: 1,
          actualExitCode: 1,
          passed: true,
          durationMs: 10,
          mismatches: []
        }
      ],
      slowestCases: [
        { name: 'missing-events', durationMs: 10 },
        { name: 'healthy', durationMs: 20 }
      ]
    })).toThrow('slowestCases must be sorted by descending durationMs');

    const contractSummary = {
      ...buildCompatSummaryHeader({
        generatedAt: '2026-02-13T00:00:00.000Z',
        mode: 'contract',
        schemaVersion: COMPAT_FIXTURE_SCHEMA_VERSION,
        selectedCases: ['healthy'],
        expectedCheckLabels: ['openclaw CLI available'],
        runtimeCheckLabels: ['openclaw CLI available']
      }),
      total: 0,
      preflightDurationMs: 10,
      totalDurationMs: 10,
      averageDurationMs: 0,
      overallDurationMs: 10,
      slowestCases: [],
      failures: 0,
      passedCases: [],
      failedCases: [],
      results: []
    };
    expect(() => ensureCompatSummaryShape(contractSummary)).not.toThrow();
    expect(() => ensureCompatSummaryShape({
      ...contractSummary,
      total: 1,
      results: [{
        name: 'healthy',
        expectedExitCode: 0,
        actualExitCode: 0,
        passed: true,
        durationMs: 20,
        mismatches: []
      }],
      passedCases: ['healthy']
    })).toThrow('contract summary must report zero total/failures');
  });

  it('validates fixtures summary case report artifacts from summary entries', () => {
    const root = makeTempDir('compat-summary-artifact-');
    try {
      const fixturesSummary = {
        ...buildCompatSummaryHeader({
          generatedAt: '2026-02-13T00:00:00.000Z',
          mode: 'fixtures',
          schemaVersion: COMPAT_FIXTURE_SCHEMA_VERSION,
          selectedCases: ['healthy'],
          expectedCheckLabels: ['openclaw CLI available'],
          runtimeCheckLabels: ['openclaw CLI available']
        }),
        total: 1,
        preflightDurationMs: 10,
        totalDurationMs: 20,
        averageDurationMs: 20,
        overallDurationMs: 30,
        slowestCases: [{ name: 'healthy', durationMs: 20 }],
        failures: 0,
        passedCases: ['healthy'],
        failedCases: [],
        results: [{
          name: 'healthy',
          expectedExitCode: 0,
          actualExitCode: 0,
          passed: true,
          durationMs: 20,
          mismatches: []
        }]
      };
      const summaryPath = path.join(root, 'summary.json');
      fs.writeFileSync(summaryPath, JSON.stringify(fixturesSummary, null, 2), 'utf-8');
      expect(loadCompatSummary(summaryPath)).toEqual(fixturesSummary);

      expect(() => validateCompatSummaryCaseReports(fixturesSummary, root)).toThrow('Missing case report');
      fs.writeFileSync(
        path.join(root, 'healthy.json'),
        JSON.stringify({ generatedAt: new Date().toISOString(), checks: [], warnings: 0, errors: 0 }, null, 2),
        'utf-8'
      );
      expect(() => validateCompatSummaryCaseReports(fixturesSummary, root)).not.toThrow();
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('validates build freshness for compatibility checks', () => {
    const root = makeTempDir('compat-build-freshness-');
    const sourcePath = path.join(root, 'compat.ts');
    const buildPath = path.join(root, 'compat.js');
    try {
      fs.writeFileSync(sourcePath, 'source', 'utf-8');
      fs.writeFileSync(buildPath, 'build', 'utf-8');
      expect(() => assertBuildFreshness(sourcePath, buildPath, 'compat artifact')).not.toThrow();

      const freshTime = new Date('2026-02-13T00:00:00.000Z');
      const staleTime = new Date('2026-02-12T00:00:00.000Z');
      fs.utimesSync(sourcePath, freshTime, freshTime);
      fs.utimesSync(buildPath, staleTime, staleTime);
      expect(() => assertBuildFreshness(sourcePath, buildPath, 'compat artifact')).toThrow('Stale compat artifact');

      fs.rmSync(buildPath, { force: true });
      expect(() => assertBuildFreshness(sourcePath, buildPath, 'compat artifact')).toThrow('Missing compat artifact');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
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

      fs.writeFileSync(
        readmePath,
        ['- `healthy` — ok', '- `healthy` — duplicate'].join('\n'),
        'utf-8'
      );
      expect(() => validateFixtureReadmeCoverage(readmePath, [
        { name: 'healthy', description: 'ok' }
      ])).toThrow('duplicate fixture cases');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
