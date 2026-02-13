import * as fs from 'fs';
import * as path from 'path';

export const COMPAT_FIXTURE_SCHEMA_VERSION = 1;
export const VALID_CHECK_STATUSES = new Set(['ok', 'warn', 'error']);
export const REQUIRED_FIXTURE_FILES = [
  'package.json',
  'SKILL.md',
  path.join('hooks', 'clawvault', 'HOOK.md'),
  path.join('hooks', 'clawvault', 'handler.js')
];

export function loadCases(casesPath) {
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
    if (names.has(testCase.name)) {
      throw new Error(`compat fixture case[${index}] duplicates name "${testCase.name}"`);
    }
    names.add(testCase.name);
    if (!Number.isInteger(testCase.expectedExitCode)) {
      throw new Error(`compat fixture case[${index}] missing expectedExitCode`);
    }
    if (!Number.isInteger(testCase.expectedWarnings)) {
      throw new Error(`compat fixture case[${index}] missing expectedWarnings`);
    }
    if (!Number.isInteger(testCase.expectedErrors)) {
      throw new Error(`compat fixture case[${index}] missing expectedErrors`);
    }
    if (!testCase.expectedCheckStatuses || typeof testCase.expectedCheckStatuses !== 'object') {
      throw new Error(`compat fixture case[${index}] missing expectedCheckStatuses`);
    }
    for (const [label, status] of Object.entries(testCase.expectedCheckStatuses)) {
      if (typeof label !== 'string' || !label) {
        throw new Error(`compat fixture case[${index}] has invalid status label`);
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
      }
    }
  }

  return cases;
}

export function selectCases(cases, rawSelection) {
  if (!rawSelection || !rawSelection.trim()) {
    return cases;
  }

  const selected = rawSelection
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

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

export function assertFixtureFiles(caseName, fixturePath, requiredPaths = REQUIRED_FIXTURE_FILES) {
  const missing = requiredPaths.filter((relativePath) => !fs.existsSync(path.join(fixturePath, relativePath)));
  if (missing.length > 0) {
    throw new Error(`fixture=${caseName} missing required files: ${missing.join(', ')}`);
  }
}
