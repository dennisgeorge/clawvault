import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import {
  assertFixtureFiles,
  evaluateCaseReport,
  loadCaseManifest,
  parseCompatReport,
  selectCases,
  validateDeclaredCheckLabels,
  validateExpectedCheckLabels,
  validateFixtureDirectoryCoverage,
  validateFixtureReadmeCoverage
} from './lib/compat-fixture-runner.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const fixturesRoot = path.join(repoRoot, 'tests', 'compat-fixtures');
const fixtureCasesPath = path.join(fixturesRoot, 'cases.json');
const fixtureReadmePath = path.join(fixturesRoot, 'README.md');
const distEntryPath = path.join(repoRoot, 'dist', 'index.js');
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
  assertFixtureFiles(testCase.name, fixturePath, undefined, testCase.allowMissingFiles ?? []);
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
  let report = null;
  let evaluation = {
    passed: false,
    mismatches: []
  };
  let outputError = null;

  try {
    report = parseCompatReport(result.stdout, testCase.name);
    writeCaseReport(testCase, report);
    evaluation = evaluateCaseReport(testCase, report, actualExitCode);
  } catch (err) {
    outputError = err;
    evaluation = {
      passed: false,
      mismatches: [err?.message || String(err)]
    };
  }

  const passed = evaluation.passed;
  const summary = `${passed ? '✓' : '✗'} fixture=${testCase.name} expectedExit=${testCase.expectedExitCode} actualExit=${actualExitCode}`;
  console.log(summary);

  if (!passed) {
    if (outputError) {
      console.error(outputError.message);
    }
    for (const mismatch of evaluation.mismatches) {
      console.error(`  - ${mismatch}`);
    }
    console.error(result.stdout);
    console.error(result.stderr);
  }

  return {
    passed,
    name: testCase.name,
    expectedExitCode: testCase.expectedExitCode,
    actualExitCode,
    mismatches: evaluation.mismatches
  };
}

function discoverCompatCheckLabels(env) {
  const healthyFixturePath = path.join(fixturesRoot, 'healthy');
  const result = spawnSync(
    process.execPath,
    ['./bin/clawvault.js', 'compat', '--base-dir', healthyFixturePath, '--json'],
    {
      cwd: repoRoot,
      env,
      encoding: 'utf-8'
    }
  );

  if (result.status !== 0) {
    throw new Error(`Unable to discover compatibility check labels from healthy fixture (exit ${String(result.status)})`);
  }

  const report = parseCompatReport(result.stdout, 'healthy-label-discovery');
  return report.checks.map((check) => check.label);
}

function main() {
  if (!fs.existsSync(distEntryPath)) {
    throw new Error('Missing dist/index.js. Run `npm run build` before running compatibility fixture checks.');
  }

  const manifest = loadCaseManifest(fixtureCasesPath);
  const allCases = manifest.cases;
  validateFixtureDirectoryCoverage(fixturesRoot, allCases);
  validateFixtureReadmeCoverage(fixtureReadmePath, allCases);
  const cases = selectCases(allCases, process.env.COMPAT_CASES);
  ensureReportDir();
  const { shimDir } = createOpenClawShim();
  const env = {
    ...process.env,
    PATH: `${shimDir}:${process.env.PATH ?? ''}`
  };

  try {
    const availableLabels = discoverCompatCheckLabels(env);
    validateDeclaredCheckLabels(manifest.expectedCheckLabels, availableLabels);
    validateExpectedCheckLabels(allCases, manifest.expectedCheckLabels);
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
