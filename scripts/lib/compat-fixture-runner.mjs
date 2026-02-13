import * as fs from 'fs';
import * as path from 'path';

export const COMPAT_FIXTURE_SCHEMA_VERSION = 2;
export const COMPAT_SUMMARY_SCHEMA_VERSION = 1;
export const VALID_CHECK_STATUSES = new Set(['ok', 'warn', 'error']);
export const REQUIRED_FIXTURE_FILES = [
  'package.json',
  'SKILL.md',
  path.join('hooks', 'clawvault', 'HOOK.md'),
  path.join('hooks', 'clawvault', 'handler.js')
];

export function loadCaseManifest(casesPath) {
  const raw = fs.readFileSync(casesPath, 'utf-8');
  const parsed = JSON.parse(raw);

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('compat fixture manifest must be an object');
  }

  if (parsed.schemaVersion !== COMPAT_FIXTURE_SCHEMA_VERSION) {
    throw new Error(
      `compat fixture schemaVersion must be ${COMPAT_FIXTURE_SCHEMA_VERSION} (received ${String(parsed.schemaVersion)})`
    );
  }

  const expectedCheckLabels = parsed.expectedCheckLabels;
  if (!Array.isArray(expectedCheckLabels) || expectedCheckLabels.length === 0) {
    throw new Error('compat fixture expectedCheckLabels must be a non-empty array');
  }
  const expectedCheckLabelSet = new Set();
  for (const [index, label] of expectedCheckLabels.entries()) {
    if (typeof label !== 'string' || label.length === 0) {
      throw new Error(`compat fixture expectedCheckLabels[${index}] must be a non-empty string`);
    }
    if (expectedCheckLabelSet.has(label)) {
      throw new Error(`compat fixture expectedCheckLabels contains duplicate "${label}"`);
    }
    expectedCheckLabelSet.add(label);
  }

  const cases = parsed.cases;
  if (!Array.isArray(cases) || cases.length === 0) {
    throw new Error('compat fixture cases must be a non-empty array');
  }

  const names = new Set();
  for (const [index, testCase] of cases.entries()) {
    if (!testCase || typeof testCase !== 'object') {
      throw new Error(`compat fixture case[${index}] must be an object`);
    }
    if (typeof testCase.name !== 'string' || testCase.name.length === 0) {
      throw new Error(`compat fixture case[${index}] missing name`);
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(testCase.name)) {
      throw new Error(`compat fixture case[${index}] name must be kebab-case lowercase`);
    }
    if (typeof testCase.description !== 'string' || testCase.description.trim().length === 0) {
      throw new Error(`compat fixture case[${index}] missing description`);
    }
    if (names.has(testCase.name)) {
      throw new Error(`compat fixture case[${index}] duplicates name "${testCase.name}"`);
    }
    names.add(testCase.name);
    if (!Number.isInteger(testCase.expectedExitCode)) {
      throw new Error(`compat fixture case[${index}] missing expectedExitCode`);
    }
    if (testCase.expectedExitCode !== 0 && testCase.expectedExitCode !== 1) {
      throw new Error(`compat fixture case[${index}] expectedExitCode must be 0 or 1`);
    }
    if (!Number.isInteger(testCase.expectedWarnings)) {
      throw new Error(`compat fixture case[${index}] missing expectedWarnings`);
    }
    if (testCase.expectedWarnings < 0) {
      throw new Error(`compat fixture case[${index}] expectedWarnings must be >= 0`);
    }
    if (!Number.isInteger(testCase.expectedErrors)) {
      throw new Error(`compat fixture case[${index}] missing expectedErrors`);
    }
    if (testCase.expectedErrors < 0) {
      throw new Error(`compat fixture case[${index}] expectedErrors must be >= 0`);
    }
    if (testCase.expectedExitCode === 0 && (testCase.expectedWarnings > 0 || testCase.expectedErrors > 0)) {
      throw new Error(`compat fixture case[${index}] expectedExitCode=0 requires expectedWarnings=0 and expectedErrors=0`);
    }
    if (testCase.expectedExitCode === 1 && testCase.expectedWarnings === 0 && testCase.expectedErrors === 0) {
      throw new Error(`compat fixture case[${index}] expectedExitCode=1 requires warnings or errors`);
    }
    if (!testCase.expectedCheckStatuses || typeof testCase.expectedCheckStatuses !== 'object') {
      throw new Error(`compat fixture case[${index}] missing expectedCheckStatuses`);
    }
    if (Object.keys(testCase.expectedCheckStatuses).length === 0) {
      throw new Error(`compat fixture case[${index}] expectedCheckStatuses must include at least one check label`);
    }
    const statusLabels = new Set(Object.keys(testCase.expectedCheckStatuses));
    for (const [label, status] of Object.entries(testCase.expectedCheckStatuses)) {
      if (typeof label !== 'string' || !label) {
        throw new Error(`compat fixture case[${index}] has invalid status label`);
      }
      if (!expectedCheckLabelSet.has(label)) {
        throw new Error(`compat fixture case[${index}] expectedCheckStatuses references undeclared check label: ${label}`);
      }
      if (!VALID_CHECK_STATUSES.has(status)) {
        throw new Error(`compat fixture case[${index}] has invalid status "${status}" for "${label}"`);
      }
    }

    if (testCase.expectedDetailIncludes !== undefined) {
      if (!testCase.expectedDetailIncludes || typeof testCase.expectedDetailIncludes !== 'object') {
        throw new Error(`compat fixture case[${index}] expectedDetailIncludes must be an object`);
      }
      for (const [label, snippet] of Object.entries(testCase.expectedDetailIncludes)) {
        if (typeof label !== 'string' || !label || typeof snippet !== 'string' || !snippet) {
          throw new Error(`compat fixture case[${index}] has invalid detail expectation`);
        }
        if (!statusLabels.has(label)) {
          throw new Error(`compat fixture case[${index}] detail expectation references label without expectedCheckStatuses entry: ${label}`);
        }
      }
    }

    if (testCase.expectedHintIncludes !== undefined) {
      if (!testCase.expectedHintIncludes || typeof testCase.expectedHintIncludes !== 'object') {
        throw new Error(`compat fixture case[${index}] expectedHintIncludes must be an object`);
      }
      for (const [label, snippet] of Object.entries(testCase.expectedHintIncludes)) {
        if (typeof label !== 'string' || !label || typeof snippet !== 'string' || !snippet) {
          throw new Error(`compat fixture case[${index}] has invalid hint expectation`);
        }
        if (!statusLabels.has(label)) {
          throw new Error(`compat fixture case[${index}] hint expectation references label without expectedCheckStatuses entry: ${label}`);
        }
      }
    }

    if (testCase.allowMissingFiles !== undefined) {
      if (!Array.isArray(testCase.allowMissingFiles) || testCase.allowMissingFiles.some((value) => typeof value !== 'string' || !value)) {
        throw new Error(`compat fixture case[${index}] allowMissingFiles must be an array of non-empty strings`);
      }
      const requiredFileSet = new Set(REQUIRED_FIXTURE_FILES);
      const unknownAllowMissing = testCase.allowMissingFiles.filter((value) => !requiredFileSet.has(value));
      if (unknownAllowMissing.length > 0) {
        throw new Error(`compat fixture case[${index}] allowMissingFiles contains unknown required-file paths: ${unknownAllowMissing.join(', ')}`);
      }
    }

    if (testCase.openclawExitCode !== undefined) {
      if (!Number.isInteger(testCase.openclawExitCode) || testCase.openclawExitCode < 0 || testCase.openclawExitCode > 255) {
        throw new Error(`compat fixture case[${index}] openclawExitCode must be an integer between 0 and 255`);
      }
    }
    if (testCase.openclawMissing !== undefined && typeof testCase.openclawMissing !== 'boolean') {
      throw new Error(`compat fixture case[${index}] openclawMissing must be a boolean`);
    }
    if (testCase.openclawSignal !== undefined) {
      if (typeof testCase.openclawSignal !== 'string' || !/^SIG[A-Z0-9]+$/.test(testCase.openclawSignal)) {
        throw new Error(`compat fixture case[${index}] openclawSignal must be a signal string like SIGTERM`);
      }
    }
    if (
      (testCase.openclawExitCode !== undefined && testCase.openclawSignal !== undefined)
      || (testCase.openclawExitCode !== undefined && testCase.openclawMissing === true)
      || (testCase.openclawSignal !== undefined && testCase.openclawMissing === true)
    ) {
      throw new Error(`compat fixture case[${index}] openclaw simulation fields are mutually exclusive (openclawExitCode/openclawSignal/openclawMissing)`);
    }

    if (
      (
        (testCase.openclawExitCode !== undefined && testCase.openclawExitCode !== 0)
        || testCase.openclawSignal !== undefined
        || testCase.openclawMissing === true
      )
      && testCase.expectedCheckStatuses?.['openclaw CLI available'] !== 'warn'
    ) {
      throw new Error(`compat fixture case[${index}] non-ready openclaw simulation requires expectedCheckStatuses[\"openclaw CLI available\"] = \"warn\"`);
    }
  }

  return {
    schemaVersion: parsed.schemaVersion,
    expectedCheckLabels,
    cases
  };
}

export function loadCases(casesPath) {
  return loadCaseManifest(casesPath).cases;
}

export function selectCases(cases, rawSelection) {
  if (!rawSelection || !rawSelection.trim()) {
    return cases;
  }

  const selected = rawSelection
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (selected.length === 0) {
    throw new Error('COMPAT_CASES did not include any case names');
  }

  const duplicateSelections = selected
    .filter((name, index, values) => values.indexOf(name) !== index)
    .filter((name, index, values) => values.indexOf(name) === index);
  if (duplicateSelections.length > 0) {
    throw new Error(`Duplicate COMPAT_CASES entries: ${duplicateSelections.join(', ')}`);
  }

  const selectedSet = new Set(selected);
  const missing = selected.filter((name) => !cases.some((testCase) => testCase.name === name));
  if (missing.length > 0) {
    throw new Error(`Unknown COMPAT_CASES entries: ${missing.join(', ')}`);
  }

  return cases.filter((testCase) => selectedSet.has(testCase.name));
}

export function ensureCompatReportShape(report, caseName) {
  if (!report || typeof report !== 'object') {
    throw new Error(`fixture=${caseName} emitted non-object JSON report`);
  }
  if (typeof report.generatedAt !== 'string') {
    throw new Error(`fixture=${caseName} report missing generatedAt`);
  }
  if (!Array.isArray(report.checks)) {
    throw new Error(`fixture=${caseName} report missing checks[]`);
  }
  if (typeof report.warnings !== 'number' || typeof report.errors !== 'number') {
    throw new Error(`fixture=${caseName} report missing warnings/errors counts`);
  }
}

export function parseCompatReport(stdout, caseName) {
  try {
    const parsed = JSON.parse(stdout);
    ensureCompatReportShape(parsed, caseName);
    return parsed;
  } catch (err) {
    throw new Error(`fixture=${caseName} produced invalid JSON report: ${err?.message || String(err)}`);
  }
}

function loadJsonObject(filePath, label) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`${label} must be a JSON object`);
    }
    return parsed;
  } catch (err) {
    throw new Error(`Unable to read ${label} at ${filePath}: ${err?.message || String(err)}`);
  }
}

function collectDuplicateValues(values) {
  return values
    .filter((value, index, array) => array.indexOf(value) !== index)
    .filter((value, index, array) => array.indexOf(value) === index);
}

function assertUniqueNonEmptyStringArray(values, fieldName) {
  if (!Array.isArray(values) || values.some((value) => typeof value !== 'string' || value.length === 0)) {
    throw new Error(`Invalid summary header field: ${fieldName}`);
  }
  const duplicates = collectDuplicateValues(values);
  if (duplicates.length > 0) {
    throw new Error(`Duplicate summary header entries in ${fieldName}: ${duplicates.join(', ')}`);
  }
}

function ensureSummaryResultEntryShape(entry, index) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    throw new Error(`compat summary results[${index}] must be an object`);
  }
  if (typeof entry.name !== 'string' || entry.name.length === 0) {
    throw new Error(`compat summary results[${index}] missing name`);
  }
  if (!Number.isInteger(entry.expectedExitCode) || (entry.expectedExitCode !== 0 && entry.expectedExitCode !== 1)) {
    throw new Error(`compat summary results[${index}] has invalid expectedExitCode`);
  }
  if (!Number.isInteger(entry.actualExitCode) || (entry.actualExitCode !== 0 && entry.actualExitCode !== 1)) {
    throw new Error(`compat summary results[${index}] has invalid actualExitCode`);
  }
  if (typeof entry.passed !== 'boolean') {
    throw new Error(`compat summary results[${index}] missing passed flag`);
  }
  if (!Number.isFinite(entry.durationMs) || entry.durationMs < 0) {
    throw new Error(`compat summary results[${index}] has invalid durationMs`);
  }
  if (!Array.isArray(entry.mismatches) || entry.mismatches.some((value) => typeof value !== 'string' || value.length === 0)) {
    throw new Error(`compat summary results[${index}] has invalid mismatches[]`);
  }
  if (entry.passed && entry.mismatches.length > 0) {
    throw new Error(`compat summary results[${index}] passed cases must not include mismatches`);
  }
  if (!entry.passed && entry.mismatches.length === 0) {
    throw new Error(`compat summary results[${index}] failed cases must include mismatch details`);
  }
  if (entry.passed && entry.actualExitCode !== entry.expectedExitCode) {
    throw new Error(`compat summary results[${index}] passed cases must match expected and actual exit codes`);
  }
}

export function evaluateCaseReport(testCase, report, actualExitCode) {
  const mismatches = [];

  if (actualExitCode !== testCase.expectedExitCode) {
    mismatches.push(`exit code mismatch (expected ${testCase.expectedExitCode}, received ${actualExitCode})`);
  }

  if (report.warnings !== testCase.expectedWarnings) {
    mismatches.push(`warnings mismatch (expected ${testCase.expectedWarnings}, received ${report.warnings})`);
  }

  if (report.errors !== testCase.expectedErrors) {
    mismatches.push(`errors mismatch (expected ${testCase.expectedErrors}, received ${report.errors})`);
  }

  for (const [label, expectedStatus] of Object.entries(testCase.expectedCheckStatuses)) {
    const check = report.checks.find((candidate) => candidate?.label === label);
    if (!check) {
      mismatches.push(`missing check "${label}"`);
      continue;
    }
    if (check.status !== expectedStatus) {
      mismatches.push(`check "${label}" status mismatch (expected ${expectedStatus}, received ${check.status})`);
    }
  }

  for (const [label, expectedSnippet] of Object.entries(testCase.expectedDetailIncludes ?? {})) {
    const check = report.checks.find((candidate) => candidate?.label === label);
    if (!check) {
      mismatches.push(`missing check "${label}" for detail assertion`);
      continue;
    }
    if (typeof check.detail !== 'string' || !check.detail.includes(expectedSnippet)) {
      mismatches.push(`check "${label}" detail missing snippet "${expectedSnippet}"`);
    }
  }

  for (const [label, expectedSnippet] of Object.entries(testCase.expectedHintIncludes ?? {})) {
    const check = report.checks.find((candidate) => candidate?.label === label);
    if (!check) {
      mismatches.push(`missing check "${label}" for hint assertion`);
      continue;
    }
    if (typeof check.hint !== 'string' || !check.hint.includes(expectedSnippet)) {
      mismatches.push(`check "${label}" hint missing snippet "${expectedSnippet}"`);
    }
  }

  return {
    passed: mismatches.length === 0,
    mismatches
  };
}

export function validateExpectedCheckLabels(cases, availableLabels) {
  const knownLabels = new Set(availableLabels);
  const unknownByCase = [];

  for (const testCase of cases) {
    const expectedLabels = new Set([
      ...Object.keys(testCase.expectedCheckStatuses ?? {}),
      ...Object.keys(testCase.expectedDetailIncludes ?? {}),
      ...Object.keys(testCase.expectedHintIncludes ?? {})
    ]);
    const unknownLabels = [...expectedLabels].filter((label) => !knownLabels.has(label));
    if (unknownLabels.length > 0) {
      unknownByCase.push({
        caseName: testCase.name,
        labels: unknownLabels
      });
    }
  }

  if (unknownByCase.length > 0) {
    const formatted = unknownByCase
      .map((entry) => `${entry.caseName}: ${entry.labels.join(', ')}`)
      .join('; ');
    throw new Error(`compat fixture cases reference unknown check labels: ${formatted}`);
  }
}

export function validateDeclaredCheckLabels(expectedLabels, availableLabels) {
  const missing = expectedLabels.filter((label) => !availableLabels.includes(label));
  const unexpected = availableLabels.filter((label) => !expectedLabels.includes(label));

  if (missing.length > 0 || unexpected.length > 0) {
    const parts = [];
    if (missing.length > 0) {
      parts.push(`missing: ${missing.join(', ')}`);
    }
    if (unexpected.length > 0) {
      parts.push(`unexpected: ${unexpected.join(', ')}`);
    }
    throw new Error(`compat check label contract mismatch (${parts.join('; ')})`);
  }

  const orderMismatch = expectedLabels.some((label, index) => label !== availableLabels[index]);
  if (orderMismatch) {
    throw new Error('compat check label order mismatch between manifest and runtime output');
  }
}

export function validateCheckStatusCoverage(cases, expectedLabels) {
  const covered = new Set();
  for (const testCase of cases) {
    for (const label of Object.keys(testCase.expectedCheckStatuses ?? {})) {
      covered.add(label);
    }
  }

  const uncovered = expectedLabels.filter((label) => !covered.has(label));
  if (uncovered.length > 0) {
    throw new Error(`compat fixture expectedCheckStatuses do not cover labels: ${uncovered.join(', ')}`);
  }
}

export function ensureReportDir(compatReportDir) {
  if (!compatReportDir) return;
  fs.mkdirSync(compatReportDir, { recursive: true });
}

export function writeCaseReport(compatReportDir, testCase, report, options = {}) {
  if (!compatReportDir || !report) return;
  if (options.validate !== false) {
    ensureCompatReportShape(report, testCase.name);
  }
  const reportPath = path.join(compatReportDir, `${testCase.name}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
}

export function writeSummaryReport(compatReportDir, summary, options = {}) {
  if (!compatReportDir) return;
  if (options.validate !== false) {
    ensureCompatSummaryShape(summary);
  }
  const summaryPath = path.join(compatReportDir, 'summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');
}

export function buildFixtureRunTelemetry(results, preflightDurationMs) {
  const normalizedPreflight = Math.max(0, Number(preflightDurationMs) || 0);
  const totalDurationMs = results.reduce((sum, result) => sum + Math.max(0, Number(result.durationMs) || 0), 0);
  const averageDurationMs = results.length > 0
    ? Math.round(totalDurationMs / results.length)
    : 0;
  const overallDurationMs = normalizedPreflight + totalDurationMs;
  const slowestCases = [...results]
    .map((result) => ({
      name: String(result.name ?? ''),
      durationMs: Math.max(0, Number(result.durationMs) || 0)
    }))
    .sort((left, right) => right.durationMs - left.durationMs)
    .slice(0, 3);

  return {
    preflightDurationMs: normalizedPreflight,
    totalDurationMs,
    averageDurationMs,
    overallDurationMs,
    slowestCases
  };
}

export function summarizeFixtureResults(results) {
  const failedCases = results
    .filter((result) => !result.passed)
    .map((result) => String(result.name ?? ''));
  const passedCases = results
    .filter((result) => result.passed)
    .map((result) => String(result.name ?? ''));

  return {
    total: results.length,
    failures: failedCases.length,
    passedCases,
    failedCases
  };
}

export function buildCompatSummaryHeader({
  generatedAt,
  mode,
  schemaVersion,
  selectedCases,
  expectedCheckLabels,
  runtimeCheckLabels
}) {
  const fields = [
    ['selectedCases', selectedCases],
    ['expectedCheckLabels', expectedCheckLabels],
    ['runtimeCheckLabels', runtimeCheckLabels]
  ];
  for (const [fieldName, values] of fields) {
    assertUniqueNonEmptyStringArray(values, fieldName);
  }

  if (mode !== 'contract' && mode !== 'fixtures') {
    throw new Error(`Unsupported summary mode: ${String(mode)}`);
  }

  return {
    summarySchemaVersion: COMPAT_SUMMARY_SCHEMA_VERSION,
    generatedAt,
    mode,
    schemaVersion,
    selectedCases,
    selectedTotal: selectedCases.length,
    expectedCheckLabels,
    runtimeCheckLabels
  };
}

export function ensureCompatSummaryShape(summary) {
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) {
    throw new Error('compat summary must be an object');
  }
  if (summary.summarySchemaVersion !== COMPAT_SUMMARY_SCHEMA_VERSION) {
    throw new Error(`compat summary schemaVersion must be ${COMPAT_SUMMARY_SCHEMA_VERSION}`);
  }
  if (summary.mode !== 'contract' && summary.mode !== 'fixtures') {
    throw new Error(`compat summary has unsupported mode: ${String(summary.mode)}`);
  }
  if (summary.schemaVersion !== COMPAT_FIXTURE_SCHEMA_VERSION) {
    throw new Error(`compat summary schemaVersion must match fixture schema ${COMPAT_FIXTURE_SCHEMA_VERSION}`);
  }
  if (typeof summary.generatedAt !== 'string' || summary.generatedAt.length === 0) {
    throw new Error('compat summary missing generatedAt');
  }

  assertUniqueNonEmptyStringArray(summary.selectedCases, 'selectedCases');
  assertUniqueNonEmptyStringArray(summary.expectedCheckLabels, 'expectedCheckLabels');
  assertUniqueNonEmptyStringArray(summary.runtimeCheckLabels, 'runtimeCheckLabels');

  if (!Number.isInteger(summary.selectedTotal) || summary.selectedTotal !== summary.selectedCases.length) {
    throw new Error('compat summary selectedTotal must equal selectedCases.length');
  }

  const numericFields = [
    'total',
    'preflightDurationMs',
    'totalDurationMs',
    'averageDurationMs',
    'overallDurationMs',
    'failures'
  ];
  for (const fieldName of numericFields) {
    if (!Number.isFinite(summary[fieldName]) || summary[fieldName] < 0) {
      throw new Error(`compat summary has invalid numeric field: ${fieldName}`);
    }
  }

  if (!Array.isArray(summary.slowestCases)) {
    throw new Error('compat summary missing slowestCases[]');
  }
  for (const [index, entry] of summary.slowestCases.entries()) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`compat summary slowestCases[${index}] must be an object`);
    }
    if (typeof entry.name !== 'string' || entry.name.length === 0) {
      throw new Error(`compat summary slowestCases[${index}] missing name`);
    }
    if (!Number.isFinite(entry.durationMs) || entry.durationMs < 0) {
      throw new Error(`compat summary slowestCases[${index}] has invalid durationMs`);
    }
  }

  assertUniqueNonEmptyStringArray(summary.passedCases, 'passedCases');
  assertUniqueNonEmptyStringArray(summary.failedCases, 'failedCases');
  const selectedCaseSet = new Set(summary.selectedCases);
  const passedCaseSet = new Set(summary.passedCases);
  const failedCaseSet = new Set(summary.failedCases);
  for (const name of summary.passedCases) {
    if (!selectedCaseSet.has(name)) {
      throw new Error(`compat summary passedCases contains case outside selection: ${name}`);
    }
    if (failedCaseSet.has(name)) {
      throw new Error(`compat summary case cannot be both passed and failed: ${name}`);
    }
  }
  for (const name of summary.failedCases) {
    if (!selectedCaseSet.has(name)) {
      throw new Error(`compat summary failedCases contains case outside selection: ${name}`);
    }
  }

  if (!Array.isArray(summary.results)) {
    throw new Error('compat summary missing results[]');
  }
  const resultNameSet = new Set();
  for (const [index, result] of summary.results.entries()) {
    ensureSummaryResultEntryShape(result, index);
    if (resultNameSet.has(result.name)) {
      throw new Error(`compat summary results contains duplicate case: ${result.name}`);
    }
    resultNameSet.add(result.name);

    if (!selectedCaseSet.has(result.name)) {
      throw new Error(`compat summary results contains case outside selection: ${result.name}`);
    }
    if (result.passed && !passedCaseSet.has(result.name)) {
      throw new Error(`compat summary result marked passed but absent from passedCases: ${result.name}`);
    }
    if (!result.passed && !failedCaseSet.has(result.name)) {
      throw new Error(`compat summary result marked failed but absent from failedCases: ${result.name}`);
    }
  }
  if (summary.failures !== summary.failedCases.length) {
    throw new Error('compat summary failures must equal failedCases.length');
  }
  if (summary.total !== summary.results.length) {
    throw new Error('compat summary total must equal results.length');
  }
  if (summary.total !== summary.passedCases.length + summary.failedCases.length) {
    throw new Error('compat summary total must equal passedCases.length + failedCases.length');
  }

  if (summary.mode === 'contract') {
    if (summary.total !== 0 || summary.failures !== 0) {
      throw new Error('contract summary must report zero total/failures');
    }
    if (summary.passedCases.length > 0 || summary.failedCases.length > 0 || summary.results.length > 0) {
      throw new Error('contract summary must not include case result entries');
    }
    if (summary.slowestCases.length > 0) {
      throw new Error('contract summary must not include slowestCases entries');
    }
  } else {
    if (summary.total !== summary.selectedTotal) {
      throw new Error('fixtures summary total must equal selectedTotal');
    }
    const resultNamesInSelectionOrder = summary.results.map((result) => result.name);
    const orderMismatch = resultNamesInSelectionOrder.some((name, index) => name !== summary.selectedCases[index]);
    if (orderMismatch) {
      throw new Error('fixtures summary results order must match selectedCases order');
    }
    const expectedSlowestCount = Math.min(3, summary.total);
    if (summary.slowestCases.length !== expectedSlowestCount) {
      throw new Error('fixtures summary slowestCases length must equal min(3, total)');
    }
    const durationByCase = new Map(summary.results.map((result) => [result.name, result.durationMs]));
    let previousDurationMs = Number.POSITIVE_INFINITY;
    for (const entry of summary.slowestCases) {
      const resultDurationMs = durationByCase.get(entry.name);
      if (resultDurationMs === undefined) {
        throw new Error(`fixtures summary slowestCases references unknown case: ${entry.name}`);
      }
      if (entry.durationMs !== resultDurationMs) {
        throw new Error(`fixtures summary slowestCases duration mismatch for case: ${entry.name}`);
      }
      if (entry.durationMs > previousDurationMs) {
        throw new Error('fixtures summary slowestCases must be sorted by descending durationMs');
      }
      previousDurationMs = entry.durationMs;
    }
  }
}

export function loadCompatSummary(summaryPath) {
  const summary = loadJsonObject(summaryPath, 'compat summary');
  ensureCompatSummaryShape(summary);
  return summary;
}

export function validateCompatSummaryCaseReports(summary, reportDir) {
  if (summary.mode !== 'fixtures') return;
  if (!Array.isArray(summary.results) || summary.results.length === 0) return;

  for (const result of summary.results) {
    const reportPath = path.join(reportDir, `${result.name}.json`);
    if (!fs.existsSync(reportPath)) {
      throw new Error(`Missing case report for summary result: ${result.name}`);
    }
    const report = loadJsonObject(reportPath, `compat case report (${result.name})`);
    ensureCompatReportShape(report, result.name);
  }
}

export function assertBuildFreshness(sourcePath, buildPath, label = 'build artifact') {
  if (!fs.existsSync(buildPath)) {
    throw new Error(`Missing ${label}: ${buildPath}. Run \`npm run build\` before compatibility checks.`);
  }
  if (!fs.existsSync(sourcePath)) {
    return;
  }

  const sourceMtime = fs.statSync(sourcePath).mtimeMs;
  const buildMtime = fs.statSync(buildPath).mtimeMs;
  if (sourceMtime > buildMtime) {
    throw new Error(`Stale ${label}: ${buildPath} is older than ${sourcePath}. Run \`npm run build\` before compatibility checks.`);
  }
}

export function assertFixtureFiles(caseName, fixturePath, requiredPaths = REQUIRED_FIXTURE_FILES, allowMissingFiles = []) {
  const allowedMissing = new Set(allowMissingFiles);
  const missing = requiredPaths
    .filter((relativePath) => !allowedMissing.has(relativePath))
    .filter((relativePath) => !fs.existsSync(path.join(fixturePath, relativePath)));
  if (missing.length > 0) {
    throw new Error(`fixture=${caseName} missing required files: ${missing.join(', ')}`);
  }
}

export function validateFixtureDirectoryCoverage(fixturesRoot, cases) {
  const entries = fs.readdirSync(fixturesRoot, { withFileTypes: true });
  const fixtureDirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  const caseNames = cases.map((testCase) => testCase.name);
  const caseNameSet = new Set(caseNames);
  const fixtureDirSet = new Set(fixtureDirs);

  const missingFixtureDirs = caseNames.filter((name) => !fixtureDirSet.has(name));
  if (missingFixtureDirs.length > 0) {
    throw new Error(`Missing fixture directories for cases: ${missingFixtureDirs.join(', ')}`);
  }

  const unreferencedDirs = fixtureDirs.filter((name) => !caseNameSet.has(name));
  if (unreferencedDirs.length > 0) {
    throw new Error(`Unreferenced fixture directories found: ${unreferencedDirs.join(', ')}`);
  }
}

export function validateFixtureReadmeCoverage(readmePath, cases) {
  const readme = fs.readFileSync(readmePath, 'utf-8');
  const documentedEntries = readme
    .split(/\r?\n/)
    .map((line) => {
      const match = /^\s*-\s+`([^`]+)`\s+—\s+(.+?)\s*$/.exec(line);
      if (!match) return null;
      return { name: match[1], description: match[2] };
    })
    .filter(Boolean);

  const duplicateEntries = documentedEntries
    .map((entry) => entry.name)
    .filter((name, index, values) => values.indexOf(name) !== index)
    .filter((name, index, values) => values.indexOf(name) === index);
  if (duplicateEntries.length > 0) {
    throw new Error(`README lists duplicate fixture cases: ${duplicateEntries.join(', ')}`);
  }

  const documented = new Map(
    documentedEntries
      .map((entry) => [entry.name, entry.description])
  );

  const caseNames = cases.map((testCase) => testCase.name);
  const caseNameSet = new Set(caseNames);
  const missingReadmeEntries = caseNames.filter((name) => !documented.has(name));
  if (missingReadmeEntries.length > 0) {
    throw new Error(`Undocumented fixture cases in README: ${missingReadmeEntries.join(', ')}`);
  }

  const unknownReadmeEntries = [...documented.keys()].filter((name) => !caseNameSet.has(name));
  if (unknownReadmeEntries.length > 0) {
    throw new Error(`README lists unknown fixture cases: ${unknownReadmeEntries.join(', ')}`);
  }

  const documentedCaseOrder = documentedEntries
    .map((entry) => entry.name)
    .filter((name) => caseNameSet.has(name));
  const orderMismatch = documentedCaseOrder.length !== caseNames.length
    || documentedCaseOrder.some((name, index) => name !== caseNames[index]);
  if (orderMismatch) {
    throw new Error('README scenario order is out of sync with declarative case order');
  }

  const descriptionMismatches = cases
    .filter((testCase) => documented.get(testCase.name) !== testCase.description)
    .map((testCase) => testCase.name);
  if (descriptionMismatches.length > 0) {
    throw new Error(`README descriptions out of sync for cases: ${descriptionMismatches.join(', ')}`);
  }
}
