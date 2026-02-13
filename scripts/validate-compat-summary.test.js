import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import {
  buildCompatSummaryHeader,
  COMPAT_FIXTURE_SCHEMA_VERSION
} from './lib/compat-fixture-runner.mjs';
import { COMPAT_SUMMARY_VALIDATOR_OUTPUT_SCHEMA_VERSION } from './lib/compat-summary-validator-output.mjs';

const summaryValidatorScript = path.resolve(process.cwd(), 'scripts', 'validate-compat-summary.mjs');

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function buildFixturesSummary() {
  return {
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
}

function runSummaryValidator(args = [], env = {}) {
  return spawnSync(
    process.execPath,
    [summaryValidatorScript, ...args],
    {
      cwd: process.cwd(),
      env: { ...process.env, ...env },
      encoding: 'utf-8'
    }
  );
}

function parseJsonLine(stdout) {
  return JSON.parse(stdout.trim());
}

describe('validate-compat-summary script', () => {
  it('validates a fixtures summary and case report artifact set', () => {
    const root = makeTempDir('compat-summary-script-');
    try {
      const summary = buildFixturesSummary();
      const summaryPath = path.join(root, 'summary.json');
      fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');
      fs.writeFileSync(
        path.join(root, 'healthy.json'),
        JSON.stringify({ generatedAt: new Date().toISOString(), checks: [], warnings: 0, errors: 0 }, null, 2),
        'utf-8'
      );

      const result = runSummaryValidator([summaryPath]);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('Compatibility summary validation passed (fixtures)');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails when summary references missing case report artifacts', () => {
    const root = makeTempDir('compat-summary-script-');
    try {
      const summary = buildFixturesSummary();
      const summaryPath = path.join(root, 'summary.json');
      fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');

      const result = runSummaryValidator([summaryPath]);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('Missing case report for summary result');

      const allowMissingResult = runSummaryValidator([summaryPath, '--allow-missing-case-reports']);
      expect(allowMissingResult.status).toBe(0);
      expect(allowMissingResult.stdout).toContain('skipped-case-reports');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('supports COMPAT_REPORT_DIR fallback when path arg is omitted', () => {
    const root = makeTempDir('compat-summary-script-');
    try {
      const summary = buildFixturesSummary();
      fs.writeFileSync(path.join(root, 'summary.json'), JSON.stringify(summary, null, 2), 'utf-8');
      fs.writeFileSync(
        path.join(root, 'healthy.json'),
        JSON.stringify({ generatedAt: new Date().toISOString(), checks: [], warnings: 0, errors: 0 }, null, 2),
        'utf-8'
      );

      const result = runSummaryValidator([], { COMPAT_REPORT_DIR: root });
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('selected=1');
      expect(result.stdout).toContain(`reportDir=${root}`);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('supports --summary and --report-dir overrides', () => {
    const root = makeTempDir('compat-summary-script-');
    try {
      const summary = buildFixturesSummary();
      const summaryRoot = path.join(root, 'summary-root');
      const reportRoot = path.join(root, 'reports');
      fs.mkdirSync(summaryRoot, { recursive: true });
      fs.mkdirSync(reportRoot, { recursive: true });
      const summaryPath = path.join(summaryRoot, 'summary.json');
      fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');
      fs.writeFileSync(
        path.join(reportRoot, 'healthy.json'),
        JSON.stringify({ generatedAt: new Date().toISOString(), checks: [], warnings: 0, errors: 0 }, null, 2),
        'utf-8'
      );

      const result = runSummaryValidator(['--summary', summaryPath, '--report-dir', reportRoot]);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain(`reportDir=${reportRoot}`);

      const outputPath = path.join(root, 'validator-output.json');
      const jsonResult = runSummaryValidator([
        '--summary', summaryPath,
        '--report-dir', reportRoot,
        '--json',
        '--out', outputPath
      ]);
      expect(jsonResult.status).toBe(0);
      const expectedPayload = {
        outputSchemaVersion: COMPAT_SUMMARY_VALIDATOR_OUTPUT_SCHEMA_VERSION,
        status: 'ok',
        summarySchemaVersion: 1,
        fixtureSchemaVersion: 2,
        mode: 'fixtures',
        selectedTotal: 1,
        resultCount: 1,
        summaryPath,
        reportDir: reportRoot,
        caseReportMode: 'validated-case-reports'
      };
      expect(parseJsonLine(jsonResult.stdout)).toEqual(expectedPayload);
      expect(JSON.parse(fs.readFileSync(outputPath, 'utf-8'))).toEqual(expectedPayload);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails with a clear message when no summary path input is provided', () => {
    const result = runSummaryValidator([], {
      COMPAT_REPORT_DIR: '',
      COMPAT_SUMMARY_PATH: ''
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Missing summary path');
  });

  it('fails with clear cli-argument errors for invalid options', () => {
    const unknownOptionResult = runSummaryValidator(['--unknown']);
    expect(unknownOptionResult.status).toBe(1);
    expect(unknownOptionResult.stderr).toContain('Unknown option');

    const missingReportDirResult = runSummaryValidator(['--report-dir']);
    expect(missingReportDirResult.status).toBe(1);
    expect(missingReportDirResult.stderr).toContain('Missing value for --report-dir');

    const root = makeTempDir('compat-summary-script-');
    const outputPath = path.join(root, 'validator-error-output.json');
    const jsonMissingValueResult = runSummaryValidator(['--json', '--report-dir', '--out', outputPath]);
    expect(jsonMissingValueResult.status).toBe(1);
    const expectedErrorPayload = {
      outputSchemaVersion: COMPAT_SUMMARY_VALIDATOR_OUTPUT_SCHEMA_VERSION,
      status: 'error',
      error: 'Missing value for --report-dir'
    };
    expect(parseJsonLine(jsonMissingValueResult.stdout)).toEqual(expectedErrorPayload);
    expect(JSON.parse(fs.readFileSync(outputPath, 'utf-8'))).toEqual(expectedErrorPayload);
    fs.rmSync(root, { recursive: true, force: true });

    const unknownRoot = makeTempDir('compat-summary-script-');
    const unknownOutputPath = path.join(unknownRoot, 'validator-error-output.json');
    const unknownWithOutResult = runSummaryValidator(['--json', '--out', unknownOutputPath, '--unknown']);
    expect(unknownWithOutResult.status).toBe(1);
    expect(parseJsonLine(unknownWithOutResult.stdout)).toEqual({
      outputSchemaVersion: COMPAT_SUMMARY_VALIDATOR_OUTPUT_SCHEMA_VERSION,
      status: 'error',
      error: 'Unknown option: --unknown'
    });
    expect(JSON.parse(fs.readFileSync(unknownOutputPath, 'utf-8'))).toEqual({
      outputSchemaVersion: COMPAT_SUMMARY_VALIDATOR_OUTPUT_SCHEMA_VERSION,
      status: 'error',
      error: 'Unknown option: --unknown'
    });
    fs.rmSync(unknownRoot, { recursive: true, force: true });
  });

  it('prints usage help and exits successfully for --help', () => {
    const result = runSummaryValidator(['--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Usage: node scripts/validate-compat-summary.mjs');
    expect(result.stdout).toContain('--summary <summary.json>');
    expect(result.stdout).toContain('--allow-missing-case-reports');
    expect(result.stdout).toContain('--json');
  });
});
