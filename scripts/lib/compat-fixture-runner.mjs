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

    if (testCase.expectedHintIncludes !== undefined) {
      if (!testCase.expectedHintIncludes || typeof testCase.expectedHintIncludes !== 'object') {
        throw new Error(`compat fixture case[${index}] expectedHintIncludes must be an object`);
      }
      for (const [label, snippet] of Object.entries(testCase.expectedHintIncludes)) {
        if (typeof label !== 'string' || !label || typeof snippet !== 'string' || !snippet) {
          throw new Error(`compat fixture case[${index}] has invalid hint expectation`);
        }
      }
    }

    if (testCase.allowMissingFiles !== undefined) {
      if (!Array.isArray(testCase.allowMissingFiles) || testCase.allowMissingFiles.some((value) => typeof value !== 'string' || !value)) {
        throw new Error(`compat fixture case[${index}] allowMissingFiles must be an array of non-empty strings`);
      }
    }
  }

  return {
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
