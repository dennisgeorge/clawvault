import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import {
  buildCompatSummaryHeader,
  COMPAT_FIXTURE_SCHEMA_VERSION
} from './lib/compat-fixture-runner.mjs';
import {
  buildSummaryValidatorSuccessPayload
} from './lib/compat-summary-validator-output.mjs';
import {
  buildJsonSchemaValidatorSuccessPayload
} from './lib/json-schema-validator-output.mjs';
import {
  buildValidatorResultVerifierErrorPayload,
  buildValidatorResultVerifierSuccessPayload
} from './lib/compat-validator-result-verifier-output.mjs';
import {
  buildCompatReportSchemaValidatorSuccessPayload
} from './lib/compat-report-schema-validator-output.mjs';
import {
  COMPAT_ARTIFACT_BUNDLE_VALIDATOR_OUTPUT_SCHEMA_VERSION
} from './lib/compat-artifact-bundle-validator-output.mjs';

const artifactBundleValidatorScript = path.resolve(process.cwd(), 'scripts', 'validate-compat-artifact-bundle.mjs');

function runArtifactBundleValidator(args = [], env = {}) {
  return spawnSync(
    process.execPath,
    [artifactBundleValidatorScript, ...args],
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

function writeArtifacts(root, { verifierPayload }) {
  const summaryPath = path.join(root, 'summary.json');
  const validatorResultPath = path.join(root, 'validator-result.json');
  const reportSchemaValidatorResultPath = path.join(root, 'report-schema-validator-result.json');
  const schemaValidatorResultPath = path.join(root, 'schema-validator-result.json');
  const validatorResultVerifierResultPath = path.join(root, 'validator-result-verifier-result.json');

  fs.writeFileSync(summaryPath, JSON.stringify(buildFixturesSummary(), null, 2), 'utf-8');
  fs.writeFileSync(validatorResultPath, JSON.stringify(buildSummaryValidatorSuccessPayload({
    mode: 'fixtures',
    summarySchemaVersion: 1,
    fixtureSchemaVersion: 2,
    selectedTotal: 1,
    resultCount: 1,
    summaryPath,
    reportDir: root,
    caseReportMode: 'validated-case-reports'
  }), null, 2), 'utf-8');
  fs.writeFileSync(reportSchemaValidatorResultPath, JSON.stringify(buildCompatReportSchemaValidatorSuccessPayload({
    mode: 'fixtures',
    summaryPath,
    reportDir: root,
    summarySchemaPath: path.resolve(process.cwd(), 'schemas', 'compat-summary.schema.json'),
    caseSchemaPath: path.resolve(process.cwd(), 'schemas', 'compat-case-report.schema.json'),
    validatedCaseReports: 1,
    caseReportMode: 'validated-case-reports'
  }), null, 2), 'utf-8');
  fs.writeFileSync(schemaValidatorResultPath, JSON.stringify(buildJsonSchemaValidatorSuccessPayload({
    schemaPath: path.resolve(process.cwd(), 'schemas', 'compat-summary-validator-output.schema.json'),
    dataPath: validatorResultPath
  }), null, 2), 'utf-8');
  fs.writeFileSync(validatorResultVerifierResultPath, JSON.stringify(verifierPayload, null, 2), 'utf-8');
}

describe('validate-compat-artifact-bundle script', () => {
  it('validates complete artifact bundle and emits json payload', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'compat-artifact-bundle-'));
    try {
      const validatorResultPath = path.join(root, 'validator-result.json');
      writeArtifacts(root, {
        verifierPayload: buildValidatorResultVerifierSuccessPayload({
          payloadPath: validatorResultPath,
          payloadStatus: 'ok',
          validatorPayloadOutputSchemaVersion: 1
        })
      });

      const outputPath = path.join(root, 'artifact-bundle-validator-result.json');
      const result = runArtifactBundleValidator(['--json', '--out', outputPath], { COMPAT_REPORT_DIR: root });
      expect(result.status).toBe(0);
      const payload = parseJsonLine(result.stdout);
      expect(payload).toEqual({
        outputSchemaVersion: COMPAT_ARTIFACT_BUNDLE_VALIDATOR_OUTPUT_SCHEMA_VERSION,
        status: 'ok',
        reportDir: root,
        summaryMode: 'fixtures',
        requireOk: true,
        summaryPath: path.join(root, 'summary.json'),
        validatorResultPath: path.join(root, 'validator-result.json'),
        reportSchemaValidatorResultPath: path.join(root, 'report-schema-validator-result.json'),
        schemaValidatorResultPath: path.join(root, 'schema-validator-result.json'),
        validatorResultVerifierResultPath: path.join(root, 'validator-result-verifier-result.json'),
        verifiedArtifacts: [
          'summary.json',
          'report-schema-validator-result.json',
          'validator-result.json',
          'schema-validator-result.json',
          'validator-result-verifier-result.json'
        ]
      });
      expect(JSON.parse(fs.readFileSync(outputPath, 'utf-8'))).toEqual(payload);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails by default on non-ok status and supports allow-error-status', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'compat-artifact-bundle-'));
    try {
      writeArtifacts(root, {
        verifierPayload: buildValidatorResultVerifierErrorPayload('bad validator result payload')
      });

      const result = runArtifactBundleValidator([], { COMPAT_REPORT_DIR: root });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('validator-result-verifier-result status is "error"');

      const allowErrorResult = runArtifactBundleValidator(['--allow-error-status'], { COMPAT_REPORT_DIR: root });
      expect(allowErrorResult.status).toBe(0);
      expect(allowErrorResult.stdout).toContain('requireOk=false');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('prints help and writes structured parse-error payloads', () => {
    const helpResult = runArtifactBundleValidator(['--help']);
    expect(helpResult.status).toBe(0);
    expect(helpResult.stdout).toContain('Usage: node scripts/validate-compat-artifact-bundle.mjs');
    expect(helpResult.stdout).toContain('--allow-error-status');

    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'compat-artifact-bundle-'));
    try {
      const outputPath = path.join(root, 'artifact-bundle-validator-error.json');
      const parseErrorResult = runArtifactBundleValidator(['--json', '--report-dir', '--out', outputPath]);
      expect(parseErrorResult.status).toBe(1);
      const expectedPayload = {
        outputSchemaVersion: COMPAT_ARTIFACT_BUNDLE_VALIDATOR_OUTPUT_SCHEMA_VERSION,
        status: 'error',
        error: 'Missing value for --report-dir'
      };
      expect(parseJsonLine(parseErrorResult.stdout)).toEqual(expectedPayload);
      expect(JSON.parse(fs.readFileSync(outputPath, 'utf-8'))).toEqual(expectedPayload);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
