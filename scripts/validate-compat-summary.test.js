import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import {
  buildCompatSummaryHeader,
  COMPAT_FIXTURE_SCHEMA_VERSION
} from './lib/compat-fixture-runner.mjs';

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
});
