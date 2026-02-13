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
    artifactCount: 6,
    artifacts: [
      'summary.json',
      'report-schema-validator-result.json',
      'validator-result.json',
      'schema-validator-result.json',
      'validator-result-verifier-result.json',
      'artifact-bundle-manifest-validator-result.json'
    ],
    schemaContracts: [
      {
        artifactName: 'summary.json',
        artifactFile: 'summary.json',
        schemaPath: path.resolve(process.cwd(), 'schemas', 'compat-summary.schema.json'),
        schemaId: 'https://clawvault.dev/schemas/compat-summary.schema.json',
        versionField: 'summarySchemaVersion',
        expectedSchemaVersion: 1
      },
      {
        artifactName: 'report-schema-validator-result.json',
        artifactFile: 'report-schema-validator-result.json',
        schemaPath: path.resolve(process.cwd(), 'schemas', 'compat-report-schema-validator-output.schema.json'),
        schemaId: 'https://clawvault.dev/schemas/compat-report-schema-validator-output.schema.json',
        versionField: 'outputSchemaVersion',
        expectedSchemaVersion: 1
      },
      {
        artifactName: 'validator-result.json',
        artifactFile: 'validator-result.json',
        schemaPath: path.resolve(process.cwd(), 'schemas', 'compat-summary-validator-output.schema.json'),
        schemaId: 'https://clawvault.dev/schemas/compat-summary-validator-output.schema.json',
        versionField: 'outputSchemaVersion',
        expectedSchemaVersion: 1
      },
      {
        artifactName: 'schema-validator-result.json',
        artifactFile: 'schema-validator-result.json',
        schemaPath: path.resolve(process.cwd(), 'schemas', 'json-schema-validator-output.schema.json'),
        schemaId: 'https://clawvault.dev/schemas/json-schema-validator-output.schema.json',
        versionField: 'outputSchemaVersion',
        expectedSchemaVersion: 1
      },
      {
        artifactName: 'validator-result-verifier-result.json',
        artifactFile: 'validator-result-verifier-result.json',
        schemaPath: path.resolve(process.cwd(), 'schemas', 'compat-validator-result-verifier-output.schema.json'),
        schemaId: 'https://clawvault.dev/schemas/compat-validator-result-verifier-output.schema.json',
        versionField: 'outputSchemaVersion',
        expectedSchemaVersion: 1
      },
      {
        artifactName: 'artifact-bundle-manifest-validator-result.json',
        artifactFile: 'artifact-bundle-manifest-validator-result.json',
        schemaPath: path.resolve(process.cwd(), 'schemas', 'compat-artifact-bundle-manifest-validator-output.schema.json'),
        schemaId: 'https://clawvault.dev/schemas/compat-artifact-bundle-manifest-validator-output.schema.json',
        versionField: 'outputSchemaVersion',
        expectedSchemaVersion: 1
      }
    ]
  });
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
        verifiedArtifacts: [
          'summary.json',
          'report-schema-validator-result.json',
          'validator-result.json',
          'schema-validator-result.json',
          'validator-result-verifier-result.json',
          'artifact-bundle-manifest-validator-result.json'
        ],
        artifactContracts: [
          {
            artifactName: 'summary.json',
            artifactPath: path.join(root, 'summary.json'),
            schemaPath: path.resolve(process.cwd(), 'schemas', 'compat-summary.schema.json'),
            schemaId: 'https://clawvault.dev/schemas/compat-summary.schema.json',
            versionField: 'summarySchemaVersion',
            expectedSchemaVersion: 1,
            actualSchemaVersion: 1
          },
          {
            artifactName: 'report-schema-validator-result.json',
            artifactPath: path.join(root, 'report-schema-validator-result.json'),
            schemaPath: path.resolve(process.cwd(), 'schemas', 'compat-report-schema-validator-output.schema.json'),
            schemaId: 'https://clawvault.dev/schemas/compat-report-schema-validator-output.schema.json',
            versionField: 'outputSchemaVersion',
            expectedSchemaVersion: 1,
            actualSchemaVersion: 1
          },
          {
            artifactName: 'validator-result.json',
            artifactPath: path.join(root, 'validator-result.json'),
            schemaPath: path.resolve(process.cwd(), 'schemas', 'compat-summary-validator-output.schema.json'),
            schemaId: 'https://clawvault.dev/schemas/compat-summary-validator-output.schema.json',
            versionField: 'outputSchemaVersion',
            expectedSchemaVersion: 1,
            actualSchemaVersion: 1
          },
          {
            artifactName: 'schema-validator-result.json',
            artifactPath: path.join(root, 'schema-validator-result.json'),
            schemaPath: path.resolve(process.cwd(), 'schemas', 'json-schema-validator-output.schema.json'),
            schemaId: 'https://clawvault.dev/schemas/json-schema-validator-output.schema.json',
            versionField: 'outputSchemaVersion',
            expectedSchemaVersion: 1,
            actualSchemaVersion: 1
          },
          {
            artifactName: 'validator-result-verifier-result.json',
            artifactPath: path.join(root, 'validator-result-verifier-result.json'),
            schemaPath: path.resolve(process.cwd(), 'schemas', 'compat-validator-result-verifier-output.schema.json'),
            schemaId: 'https://clawvault.dev/schemas/compat-validator-result-verifier-output.schema.json',
            versionField: 'outputSchemaVersion',
            expectedSchemaVersion: 1,
            actualSchemaVersion: 1
          },
          {
            artifactName: 'artifact-bundle-manifest-validator-result.json',
            artifactPath: path.join(root, 'artifact-bundle-manifest-validator-result.json'),
            schemaPath: path.resolve(process.cwd(), 'schemas', 'compat-artifact-bundle-manifest-validator-output.schema.json'),
            schemaId: 'https://clawvault.dev/schemas/compat-artifact-bundle-manifest-validator-output.schema.json',
            versionField: 'outputSchemaVersion',
            expectedSchemaVersion: 1,
            actualSchemaVersion: 1
          }
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

  it('fails when manifest-validator artifact list drifts from active manifest', () => {
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
      manifestValidatorPayload.artifacts = [
        ...manifestValidatorPayload.artifacts.slice(0, -1),
        'drifted-artifact.json'
      ];
      manifestValidatorPayload.schemaContracts = manifestValidatorPayload.schemaContracts.map((entry, index, allEntries) => {
        if (index !== allEntries.length - 1) {
          return entry;
        }
        return {
          ...entry,
          artifactName: 'drifted-artifact.json',
          artifactFile: 'drifted-artifact.json'
        };
      });
      fs.writeFileSync(manifestValidatorResultPath, JSON.stringify(manifestValidatorPayload, null, 2), 'utf-8');

      const result = runArtifactBundleValidator([], { COMPAT_REPORT_DIR: root });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('artifact-bundle manifest validator artifacts list does not match active manifest order');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
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
      fs.writeFileSync(manifestPath, JSON.stringify({
        schemaVersion: 1,
        artifacts: [
          {
            artifactName: 'summary.json',
            artifactFile: 'summary.json',
            schemaPath: 'schemas/compat-summary.schema.json',
            schemaId: 'https://clawvault.dev/schemas/compat-summary.schema.json',
            versionField: 'summarySchemaVersion'
          },
          {
            artifactName: 'report-schema-validator-result.json',
            artifactFile: 'report-schema-validator-result.json',
            schemaPath: 'schemas/compat-report-schema-validator-output.schema.json',
            schemaId: 'https://clawvault.dev/schemas/compat-report-schema-validator-output.schema.json',
            versionField: 'outputSchemaVersion'
          },
          {
            artifactName: 'validator-result.json',
            artifactFile: 'validator-result.json',
            schemaPath: 'schemas/compat-summary-validator-output.schema.json',
            schemaId: 'https://clawvault.dev/schemas/compat-summary-validator-output.schema.json',
            versionField: 'outputSchemaVersion'
          },
          {
            artifactName: 'schema-validator-result.json',
            artifactFile: 'schema-validator-result.json',
            schemaPath: 'schemas/json-schema-validator-output.schema.json',
            schemaId: 'https://clawvault.dev/schemas/json-schema-validator-output.schema.json',
            versionField: 'outputSchemaVersion'
          },
          {
            artifactName: 'validator-result-verifier-result.json',
            artifactFile: 'validator-result-verifier-result.json',
            schemaPath: 'schemas/compat-validator-result-verifier-output.schema.json',
            schemaId: 'https://clawvault.dev/schemas/compat-validator-result-verifier-output.schema.json',
            versionField: 'outputSchemaVersion'
          },
          {
            artifactName: 'artifact-bundle-manifest-validator-result.json',
            artifactFile: 'artifact-bundle-manifest-validator-result.json',
            schemaPath: 'schemas/compat-artifact-bundle-manifest-validator-output.schema.json',
            schemaId: 'https://clawvault.dev/schemas/compat-artifact-bundle-manifest-validator-output.schema.json',
            versionField: 'outputSchemaVersion'
          }
        ]
      }, null, 2), 'utf-8');

      const result = runArtifactBundleValidator(['--manifest', manifestPath], { COMPAT_REPORT_DIR: root });
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('Compatibility artifact bundle validation passed');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
