import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import {
  assertFixtureFiles,
  ensureReportDir,
  evaluateCaseReport,
  loadCaseManifest,
  parseCompatReport,
  selectCases,
  validateDeclaredCheckLabels,
  validateExpectedCheckLabels,
  validateFixtureDirectoryCoverage,
  validateFixtureReadmeCoverage,
  writeCaseReport,
  writeSummaryReport
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
const validateOnly = process.env.COMPAT_VALIDATE_ONLY === '1';

function createOpenClawShim() {
  const shimDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawvault-openclaw-shim-'));
  const shimPath = path.join(shimDir, 'openclaw');
  fs.writeFileSync(shimPath, '#!/usr/bin/env bash\nexit 0\n', 'utf-8');
  fs.chmodSync(shimPath, 0o755);
  return { shimDir, shimPath };
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
    writeCaseReport(compatReportDir, testCase, report);
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
  ensureReportDir(compatReportDir);
  const { shimDir } = createOpenClawShim();
  const env = {
    ...process.env,
    PATH: `${shimDir}:${process.env.PATH ?? ''}`
  };

  try {
    const availableLabels = discoverCompatCheckLabels(env);
    validateDeclaredCheckLabels(manifest.expectedCheckLabels, availableLabels);
    validateExpectedCheckLabels(allCases, manifest.expectedCheckLabels);
    if (validateOnly) {
      writeSummaryReport(compatReportDir, {
        generatedAt: new Date().toISOString(),
        mode: 'contract',
        schemaVersion: manifest.schemaVersion,
        selectedCases: cases.map((testCase) => testCase.name),
        total: 0,
        failures: 0,
        results: []
      });
      console.log('Compatibility fixture contract validation passed.');
      return;
    }
    const results = cases.map((testCase) => runCase(testCase, env));
    writeSummaryReport(compatReportDir, {
      generatedAt: new Date().toISOString(),
      mode: 'fixtures',
      schemaVersion: manifest.schemaVersion,
      selectedCases: cases.map((testCase) => testCase.name),
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
