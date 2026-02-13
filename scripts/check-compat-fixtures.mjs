import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import {
  assertFixtureFiles,
  loadCases,
  parseCompatReport,
  selectCases,
  validateFixtureDirectoryCoverage
} from './lib/compat-fixture-runner.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const fixturesRoot = path.join(repoRoot, 'tests', 'compat-fixtures');
const fixtureCasesPath = path.join(fixturesRoot, 'cases.json');
const compatReportDir = process.env.COMPAT_REPORT_DIR
  ? path.resolve(process.env.COMPAT_REPORT_DIR)
  : '';

function createOpenClawShim() {
  const shimDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawvault-openclaw-shim-'));
  const shimPath = path.join(shimDir, 'openclaw');
  fs.writeFileSync(shimPath, '#!/usr/bin/env bash\nexit 0\n', 'utf-8');
  fs.chmodSync(shimPath, 0o755);
  return { shimDir, shimPath };
}

function ensureReportDir() {
  if (!compatReportDir) return;
  fs.mkdirSync(compatReportDir, { recursive: true });
}

function writeCaseReport(testCase, report) {
  if (!compatReportDir || !report) return;
  const reportPath = path.join(compatReportDir, `${testCase.name}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
}

function writeSummaryReport(summary) {
  if (!compatReportDir) return;
  const summaryPath = path.join(compatReportDir, 'summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');
}

function runCase(testCase, env) {
  const fixturePath = path.join(fixturesRoot, testCase.name);
  assertFixtureFiles(testCase.name, fixturePath);
  const result = spawnSync(
    process.execPath,
    ['./bin/clawvault.js', 'compat', '--strict', '--base-dir', fixturePath, '--json'],
    {
      cwd: repoRoot,
      env,
      encoding: 'utf-8'
    }
  );

  const actualExitCode = result.status ?? 1;
  const exitMatches = actualExitCode === testCase.expectedExitCode;
  let report = null;
  let outputMatches = false;
  let outputError = null;

  try {
    report = parseCompatReport(result.stdout, testCase.name);
    writeCaseReport(testCase, report);
    const warningsMatch = report.warnings === testCase.expectedWarnings;
    const errorsMatch = report.errors === testCase.expectedErrors;
    const statusMatches = Object.entries(testCase.expectedCheckStatuses).every(([label, expectedStatus]) => {
      const check = report.checks.find((candidate) => candidate?.label === label);
      return check?.status === expectedStatus;
    });
    const detailMatches = Object.entries(testCase.expectedDetailIncludes ?? {}).every(([label, expectedSnippet]) => {
      const check = report.checks.find((candidate) => candidate?.label === label);
      return typeof check?.detail === 'string' && check.detail.includes(expectedSnippet);
    });
    outputMatches = warningsMatch && errorsMatch && statusMatches && detailMatches;
  } catch (err) {
    outputError = err;
    outputMatches = false;
  }

  const passed = exitMatches && outputMatches;
  const summary = `${passed ? '✓' : '✗'} fixture=${testCase.name} expectedExit=${testCase.expectedExitCode} actualExit=${actualExitCode}`;
  console.log(summary);

  if (!passed) {
    if (outputError) {
      console.error(outputError.message);
    }
    if (report) {
      console.error(`expected warnings/errors=${testCase.expectedWarnings}/${testCase.expectedErrors} actual=${report.warnings}/${report.errors}`);
    }
    console.error(result.stdout);
    console.error(result.stderr);
  }

  return {
    passed,
    name: testCase.name,
    expectedExitCode: testCase.expectedExitCode,
    actualExitCode
  };
}

function main() {
  const allCases = loadCases(fixtureCasesPath);
  validateFixtureDirectoryCoverage(fixturesRoot, allCases);
  const cases = selectCases(allCases, process.env.COMPAT_CASES);
  ensureReportDir();
  const { shimDir } = createOpenClawShim();
  const env = {
    ...process.env,
    PATH: `${shimDir}:${process.env.PATH ?? ''}`
  };

  try {
    const results = cases.map((testCase) => runCase(testCase, env));
    writeSummaryReport({
      generatedAt: new Date().toISOString(),
      total: results.length,
      failures: results.filter((result) => !result.passed).length,
      results
    });
    const failures = results.filter((result) => !result.passed).length;

    if (failures > 0) {
      console.error(`Compatibility fixture check failed: ${failures} case(s).`);
      process.exit(1);
    }

    console.log('Compatibility fixture check passed.');
  } finally {
    fs.rmSync(shimDir, { recursive: true, force: true });
  }
}

main();
