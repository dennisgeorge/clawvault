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
  buildCompatArtifactBundleManifestValidatorSuccessPayload
} from './lib/compat-artifact-bundle-manifest-validator-output.mjs';
import {
  COMPAT_ARTIFACT_BUNDLE_VALIDATOR_OUTPUT_SCHEMA_VERSION
} from './lib/compat-artifact-bundle-validator-output.mjs';
import {
  REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_COUNT,
  REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_DEFINITIONS,
  REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES
} from './lib/compat-artifact-bundle-contracts.mjs';

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

function buildManifestValidatorSuccessPayload(root, manifestPath) {
  return buildCompatArtifactBundleManifestValidatorSuccessPayload({
    manifestPath,
    artifactCount: REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_COUNT,
    artifacts: REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES,
    schemaContracts: REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_DEFINITIONS.map((definition) => ({
      artifactName: definition.artifactName,
      artifactFile: definition.artifactFile,
      schemaPath: path.resolve(process.cwd(), definition.schemaPath),
      schemaId: definition.schemaId,
      versionField: definition.versionField,
      expectedSchemaVersion: 1
    }))
  });
}

function buildExpectedBundleArtifactContracts(root) {
  return REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_DEFINITIONS.map((definition) => ({
    artifactName: definition.artifactName,
    artifactPath: path.join(root, definition.artifactFile),
    schemaPath: path.resolve(process.cwd(), definition.schemaPath),
    schemaId: definition.schemaId,
    versionField: definition.versionField,
    expectedSchemaVersion: 1,
    actualSchemaVersion: 1
  }));
}

function buildCanonicalManifestPayload() {
  return {
    schemaVersion: 1,
    artifacts: REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_DEFINITIONS.map((definition) => ({
      artifactName: definition.artifactName,
      artifactFile: definition.artifactFile,
      schemaPath: definition.schemaPath,
      schemaId: definition.schemaId,
      versionField: definition.versionField
    }))
  };
}

function writeArtifacts(root, { verifierPayload, manifestPath = path.resolve(process.cwd(), 'schemas', 'compat-artifact-bundle.manifest.json') }) {
  const summaryPath = path.join(root, 'summary.json');
  const validatorResultPath = path.join(root, 'validator-result.json');
  const reportSchemaValidatorResultPath = path.join(root, 'report-schema-validator-result.json');
  const schemaValidatorResultPath = path.join(root, 'schema-validator-result.json');
  const validatorResultVerifierResultPath = path.join(root, 'validator-result-verifier-result.json');
  const artifactBundleManifestValidatorResultPath = path.join(root, 'artifact-bundle-manifest-validator-result.json');

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
  fs.writeFileSync(
    artifactBundleManifestValidatorResultPath,
    JSON.stringify(buildManifestValidatorSuccessPayload(root, manifestPath), null, 2),
    'utf-8'
  );
}

function runManifestValidatorPayloadDriftScenario({
  mutatePayload,
  assertFailure
}) {
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
    const manifestValidatorResultPath = path.join(root, 'artifact-bundle-manifest-validator-result.json');
    const manifestValidatorPayload = JSON.parse(fs.readFileSync(manifestValidatorResultPath, 'utf-8'));
    mutatePayload(manifestValidatorPayload);
    fs.writeFileSync(manifestValidatorResultPath, JSON.stringify(manifestValidatorPayload, null, 2), 'utf-8');

    const result = runArtifactBundleValidator([], { COMPAT_REPORT_DIR: root });
    expect(result.status).toBe(1);
    assertFailure(result);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
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
        artifactBundleManifestValidatorResultPath: path.join(root, 'artifact-bundle-manifest-validator-result.json'),
        verifiedArtifacts: REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES,
        artifactContracts: buildExpectedBundleArtifactContracts(root)
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

  it('fails when manifest-validator artifact list drifts from canonical order', () => {
    runManifestValidatorPayloadDriftScenario({
      mutatePayload: (manifestValidatorPayload) => {
        const reorderedArtifacts = [
          manifestValidatorPayload.artifacts[1],
          manifestValidatorPayload.artifacts[0],
          ...manifestValidatorPayload.artifacts.slice(2)
        ];
        manifestValidatorPayload.artifacts = reorderedArtifacts;
        manifestValidatorPayload.schemaContracts = reorderedArtifacts.map((artifactName) => (
          manifestValidatorPayload.schemaContracts.find((entry) => entry.artifactName === artifactName)
        ));
      },
      assertFailure: (result) => {
        expect(result.stderr).toContain('artifacts must follow required canonical artifactName order');
      }
    });
  });

  it('fails when manifest-validator schemaPath drifts from active manifest resolution', () => {
    runManifestValidatorPayloadDriftScenario({
      mutatePayload: (manifestValidatorPayload) => {
        manifestValidatorPayload.schemaContracts = manifestValidatorPayload.schemaContracts.map((entry) => (
          entry.artifactName === 'summary.json'
            ? { ...entry, schemaPath: '/tmp/drifted-root/schemas/compat-summary.schema.json' }
            : entry
        ));
      },
      assertFailure: (result) => {
        expect(result.stderr).toContain('artifact-bundle manifest validator schemaPath mismatch for summary.json');
      }
    });
  });

  it('fails when manifest-validator schemaId drift violates payload contract', () => {
    runManifestValidatorPayloadDriftScenario({
      mutatePayload: (manifestValidatorPayload) => {
        manifestValidatorPayload.schemaContracts = manifestValidatorPayload.schemaContracts.map((entry) => (
          entry.artifactName === 'summary.json'
            ? { ...entry, schemaId: 'https://example.dev/drifted-summary.schema.json' }
            : entry
        ));
      },
      assertFailure: (result) => {
        expect(result.stderr).toContain('schemaContracts entry for summary.json must use schemaId=');
      }
    });
  });

  it('fails when validator-result verifier payload drifts from validator-result artifact', () => {
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
      const verifierResultPath = path.join(root, 'validator-result-verifier-result.json');
      const verifierPayload = JSON.parse(fs.readFileSync(verifierResultPath, 'utf-8'));
      verifierPayload.payloadStatus = 'error';
      fs.writeFileSync(verifierResultPath, JSON.stringify(verifierPayload, null, 2), 'utf-8');

      const result = runArtifactBundleValidator([], { COMPAT_REPORT_DIR: root });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('validator-result verifier payloadStatus mismatch');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails when summary-validator totals drift from summary artifact', () => {
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
      const summaryValidatorResultPath = path.join(root, 'validator-result.json');
      const summaryValidatorPayload = JSON.parse(fs.readFileSync(summaryValidatorResultPath, 'utf-8'));
      summaryValidatorPayload.selectedTotal = 42;
      fs.writeFileSync(summaryValidatorResultPath, JSON.stringify(summaryValidatorPayload, null, 2), 'utf-8');

      const result = runArtifactBundleValidator([], { COMPAT_REPORT_DIR: root });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('selected total mismatch between summary and validator-result payload');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails when report-schema-validator summary-schema path drifts from summary contract', () => {
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
      const reportSchemaValidatorResultPath = path.join(root, 'report-schema-validator-result.json');
      const reportSchemaValidatorPayload = JSON.parse(fs.readFileSync(reportSchemaValidatorResultPath, 'utf-8'));
      reportSchemaValidatorPayload.summarySchemaPath = '/tmp/drifted-summary.schema.json';
      fs.writeFileSync(reportSchemaValidatorResultPath, JSON.stringify(reportSchemaValidatorPayload, null, 2), 'utf-8');

      const result = runArtifactBundleValidator([], { COMPAT_REPORT_DIR: root });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('report-schema-validator summarySchemaPath mismatch for summary artifact contract');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails when report-schema-validator case-schema path drifts from active case contract', () => {
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
      const reportSchemaValidatorResultPath = path.join(root, 'report-schema-validator-result.json');
      const reportSchemaValidatorPayload = JSON.parse(fs.readFileSync(reportSchemaValidatorResultPath, 'utf-8'));
      reportSchemaValidatorPayload.caseSchemaPath = '/tmp/drifted-case.schema.json';
      fs.writeFileSync(reportSchemaValidatorResultPath, JSON.stringify(reportSchemaValidatorPayload, null, 2), 'utf-8');

      const result = runArtifactBundleValidator([], { COMPAT_REPORT_DIR: root });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('report-schema-validator caseSchemaPath mismatch for active case-report contract');
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

  it('supports explicit manifest override path', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'compat-artifact-bundle-'));
    try {
      const manifestPath = path.join(root, 'bundle-manifest.json');
      const validatorResultPath = path.join(root, 'validator-result.json');
      writeArtifacts(root, {
        verifierPayload: buildValidatorResultVerifierSuccessPayload({
          payloadPath: validatorResultPath,
          payloadStatus: 'ok',
          validatorPayloadOutputSchemaVersion: 1
        }),
        manifestPath
      });
      fs.writeFileSync(manifestPath, JSON.stringify(buildCanonicalManifestPayload(), null, 2), 'utf-8');

      const result = runArtifactBundleValidator(['--manifest', manifestPath], { COMPAT_REPORT_DIR: root });
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('Compatibility artifact bundle validation passed');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails explicit manifest override when required schemaPath mapping drifts', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'compat-artifact-bundle-'));
    try {
      const manifestPath = path.join(root, 'bundle-manifest.json');
      const validatorResultPath = path.join(root, 'validator-result.json');
      writeArtifacts(root, {
        verifierPayload: buildValidatorResultVerifierSuccessPayload({
          payloadPath: validatorResultPath,
          payloadStatus: 'ok',
          validatorPayloadOutputSchemaVersion: 1
        }),
        manifestPath
      });
      const manifestPayload = buildCanonicalManifestPayload();
      manifestPayload.artifacts = manifestPayload.artifacts.map((entry) => (
        entry.artifactName === 'summary.json'
          ? { ...entry, schemaPath: 'schemas/drifted-summary.schema.json' }
          : entry
      ));
      fs.writeFileSync(manifestPath, JSON.stringify(manifestPayload, null, 2), 'utf-8');

      const result = runArtifactBundleValidator(['--manifest', manifestPath], { COMPAT_REPORT_DIR: root });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('required artifact summary.json must use schemaPath=schemas/compat-summary.schema.json');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails explicit manifest override when required schemaId mapping drifts', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'compat-artifact-bundle-'));
    try {
      const manifestPath = path.join(root, 'bundle-manifest.json');
      const validatorResultPath = path.join(root, 'validator-result.json');
      writeArtifacts(root, {
        verifierPayload: buildValidatorResultVerifierSuccessPayload({
          payloadPath: validatorResultPath,
          payloadStatus: 'ok',
          validatorPayloadOutputSchemaVersion: 1
        }),
        manifestPath
      });
      const manifestPayload = buildCanonicalManifestPayload();
      manifestPayload.artifacts = manifestPayload.artifacts.map((entry) => (
        entry.artifactName === 'summary.json'
          ? { ...entry, schemaId: 'https://example.dev/drifted-summary.schema.json' }
          : entry
      ));
      fs.writeFileSync(manifestPath, JSON.stringify(manifestPayload, null, 2), 'utf-8');

      const result = runArtifactBundleValidator(['--manifest', manifestPath], { COMPAT_REPORT_DIR: root });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        'required artifact summary.json must use schemaId=https://clawvault.dev/schemas/compat-summary.schema.json'
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
