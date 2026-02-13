import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  buildCompatArtifactBundleValidatorErrorPayload,
  buildCompatArtifactBundleValidatorSuccessPayload,
  COMPAT_ARTIFACT_BUNDLE_VALIDATOR_OUTPUT_SCHEMA_VERSION,
  ensureCompatArtifactBundleValidatorPayloadShape,
  loadCompatArtifactBundleValidatorPayload
} from './compat-artifact-bundle-validator-output.mjs';
import {
  REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_DEFINITIONS
} from './compat-artifact-bundle-contracts.mjs';

function buildValidArtifactContracts() {
  return REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_DEFINITIONS.map((definition) => ({
    artifactName: definition.artifactName,
    artifactPath: `/tmp/reports/${definition.artifactFile}`,
    schemaPath: path.resolve(process.cwd(), definition.schemaPath),
    schemaId: definition.schemaId,
    versionField: definition.versionField,
    expectedSchemaVersion: 1,
    actualSchemaVersion: 1
  }));
}

describe('compat artifact bundle validator output payload contracts', () => {
  it('builds and validates success payloads', () => {
    const artifactContracts = buildValidArtifactContracts();
    const payload = buildCompatArtifactBundleValidatorSuccessPayload({
      reportDir: '/tmp/reports',
      summaryMode: 'fixtures',
      requireOk: true,
      summaryPath: '/tmp/reports/summary.json',
      validatorResultPath: '/tmp/reports/validator-result.json',
      reportSchemaValidatorResultPath: '/tmp/reports/report-schema-validator-result.json',
      schemaValidatorResultPath: '/tmp/reports/schema-validator-result.json',
      validatorResultVerifierResultPath: '/tmp/reports/validator-result-verifier-result.json',
      artifactBundleManifestValidatorResultPath: '/tmp/reports/artifact-bundle-manifest-validator-result.json',
      verifiedArtifacts: artifactContracts.map((entry) => entry.artifactName),
      artifactContracts
    });
    expect(payload.outputSchemaVersion).toBe(COMPAT_ARTIFACT_BUNDLE_VALIDATOR_OUTPUT_SCHEMA_VERSION);
    expect(() => ensureCompatArtifactBundleValidatorPayloadShape(payload)).not.toThrow();
  });

  it('builds and validates error payloads', () => {
    const payload = buildCompatArtifactBundleValidatorErrorPayload('boom');
    expect(payload).toEqual({
      outputSchemaVersion: COMPAT_ARTIFACT_BUNDLE_VALIDATOR_OUTPUT_SCHEMA_VERSION,
      status: 'error',
      error: 'boom'
    });
    expect(() => ensureCompatArtifactBundleValidatorPayloadShape(payload)).not.toThrow();
  });

  it('rejects malformed payload shapes', () => {
    expect(() => ensureCompatArtifactBundleValidatorPayloadShape({
      outputSchemaVersion: COMPAT_ARTIFACT_BUNDLE_VALIDATOR_OUTPUT_SCHEMA_VERSION,
      status: 'ok',
      reportDir: '/tmp'
    })).toThrow('summaryMode');

    expect(() => ensureCompatArtifactBundleValidatorPayloadShape({
      outputSchemaVersion: COMPAT_ARTIFACT_BUNDLE_VALIDATOR_OUTPUT_SCHEMA_VERSION,
      status: 'ok',
      reportDir: '/tmp/reports',
      summaryMode: 'fixtures',
      requireOk: true,
      summaryPath: '/tmp/reports/summary.json',
      validatorResultPath: '/tmp/reports/validator-result.json',
      reportSchemaValidatorResultPath: '/tmp/reports/report-schema-validator-result.json',
      schemaValidatorResultPath: '/tmp/reports/schema-validator-result.json',
      validatorResultVerifierResultPath: '/tmp/reports/validator-result-verifier-result.json',
      artifactBundleManifestValidatorResultPath: '/tmp/reports/artifact-bundle-manifest-validator-result.json',
      verifiedArtifacts: ['summary.json'],
      artifactContracts: []
    })).toThrow('artifactContracts');

    const artifactContracts = buildValidArtifactContracts();
    expect(() => ensureCompatArtifactBundleValidatorPayloadShape({
      outputSchemaVersion: COMPAT_ARTIFACT_BUNDLE_VALIDATOR_OUTPUT_SCHEMA_VERSION,
      status: 'ok',
      reportDir: '/tmp/reports',
      summaryMode: 'fixtures',
      requireOk: true,
      summaryPath: '/tmp/reports/summary.json',
      validatorResultPath: '/tmp/reports/validator-result.json',
      reportSchemaValidatorResultPath: '/tmp/reports/report-schema-validator-result.json',
      schemaValidatorResultPath: '/tmp/reports/schema-validator-result.json',
      validatorResultVerifierResultPath: '/tmp/reports/validator-result-verifier-result.json',
      artifactBundleManifestValidatorResultPath: '/tmp/reports/artifact-bundle-manifest-validator-result.json',
      verifiedArtifacts: artifactContracts.map((entry) => entry.artifactName),
      artifactContracts: [
        ...artifactContracts,
        {
          artifactName: 'extra-artifact.json',
          artifactPath: '/tmp/reports/extra-artifact.json',
          schemaPath: '/tmp/schemas/extra-artifact.schema.json',
          schemaId: 'https://clawvault.dev/schemas/extra-artifact.schema.json',
          versionField: 'outputSchemaVersion',
          expectedSchemaVersion: 1,
          actualSchemaVersion: 1
        }
      ]
    })).toThrow('artifactContracts must contain exactly');

    expect(() => ensureCompatArtifactBundleValidatorPayloadShape({
      outputSchemaVersion: COMPAT_ARTIFACT_BUNDLE_VALIDATOR_OUTPUT_SCHEMA_VERSION,
      status: 'ok',
      reportDir: '/tmp/reports',
      summaryMode: 'fixtures',
      requireOk: true,
      summaryPath: '/tmp/reports/summary.json',
      validatorResultPath: '/tmp/reports/validator-result.json',
      reportSchemaValidatorResultPath: '/tmp/reports/report-schema-validator-result.json',
      schemaValidatorResultPath: '/tmp/reports/schema-validator-result.json',
      validatorResultVerifierResultPath: '/tmp/reports/validator-result-verifier-result.json',
      artifactBundleManifestValidatorResultPath: '/tmp/reports/artifact-bundle-manifest-validator-result.json',
      verifiedArtifacts: ['summary.json', 'validator-result.json'],
      artifactContracts
    })).toThrow('verifiedArtifacts must have one entry per artifactContracts item');

    expect(() => ensureCompatArtifactBundleValidatorPayloadShape({
      outputSchemaVersion: COMPAT_ARTIFACT_BUNDLE_VALIDATOR_OUTPUT_SCHEMA_VERSION,
      status: 'ok',
      reportDir: '/tmp/reports',
      summaryMode: 'fixtures',
      requireOk: true,
      summaryPath: '/tmp/reports/summary.json',
      validatorResultPath: '/tmp/reports/validator-result.json',
      reportSchemaValidatorResultPath: '/tmp/reports/report-schema-validator-result.json',
      schemaValidatorResultPath: '/tmp/reports/schema-validator-result.json',
      validatorResultVerifierResultPath: '/tmp/reports/validator-result-verifier-result.json',
      artifactBundleManifestValidatorResultPath: '/tmp/reports/artifact-bundle-manifest-validator-result.json',
      verifiedArtifacts: [
        ...artifactContracts.slice(0, -1).map((entry) => entry.artifactName),
        'extra-artifact.json'
      ],
      artifactContracts: [
        ...artifactContracts.slice(0, -1),
        {
          artifactName: 'extra-artifact.json',
          artifactPath: '/tmp/reports/extra-artifact.json',
          schemaPath: '/tmp/schemas/extra-artifact.schema.json',
          schemaId: 'https://clawvault.dev/schemas/extra-artifact.schema.json',
          versionField: 'outputSchemaVersion',
          expectedSchemaVersion: 1,
          actualSchemaVersion: 1
        }
      ]
    })).toThrow('artifactContracts contains unsupported artifactName values');

    const reorderedArtifactContracts = buildValidArtifactContracts();
    [reorderedArtifactContracts[0], reorderedArtifactContracts[1]] = [reorderedArtifactContracts[1], reorderedArtifactContracts[0]];
    expect(() => ensureCompatArtifactBundleValidatorPayloadShape({
      outputSchemaVersion: COMPAT_ARTIFACT_BUNDLE_VALIDATOR_OUTPUT_SCHEMA_VERSION,
      status: 'ok',
      reportDir: '/tmp/reports',
      summaryMode: 'fixtures',
      requireOk: true,
      summaryPath: '/tmp/reports/summary.json',
      validatorResultPath: '/tmp/reports/validator-result.json',
      reportSchemaValidatorResultPath: '/tmp/reports/report-schema-validator-result.json',
      schemaValidatorResultPath: '/tmp/reports/schema-validator-result.json',
      validatorResultVerifierResultPath: '/tmp/reports/validator-result-verifier-result.json',
      artifactBundleManifestValidatorResultPath: '/tmp/reports/artifact-bundle-manifest-validator-result.json',
      verifiedArtifacts: reorderedArtifactContracts.map((entry) => entry.artifactName),
      artifactContracts: reorderedArtifactContracts
    })).toThrow('artifactContracts must follow required canonical artifactName order');

    expect(() => ensureCompatArtifactBundleValidatorPayloadShape({
      outputSchemaVersion: COMPAT_ARTIFACT_BUNDLE_VALIDATOR_OUTPUT_SCHEMA_VERSION,
      status: 'ok',
      reportDir: '/tmp/reports',
      summaryMode: 'fixtures',
      requireOk: true,
      summaryPath: '/tmp/reports/summary.json',
      validatorResultPath: '/tmp/reports/validator-result.json',
      reportSchemaValidatorResultPath: '/tmp/reports/report-schema-validator-result.json',
      schemaValidatorResultPath: '/tmp/reports/schema-validator-result.json',
      validatorResultVerifierResultPath: '/tmp/reports/validator-result-verifier-result.json',
      artifactBundleManifestValidatorResultPath: '/tmp/reports/artifact-bundle-manifest-validator-result.json',
      verifiedArtifacts: artifactContracts.map((entry) => entry.artifactName),
      artifactContracts: artifactContracts.map((entry) => (
        entry.artifactName === 'summary.json'
          ? { ...entry, artifactPath: '/tmp/reports/drifted-summary.json' }
          : entry
      ))
    })).toThrow('summaryPath must match artifactContracts path for summary.json');

    expect(() => ensureCompatArtifactBundleValidatorPayloadShape({
      outputSchemaVersion: COMPAT_ARTIFACT_BUNDLE_VALIDATOR_OUTPUT_SCHEMA_VERSION,
      status: 'ok',
      reportDir: '/tmp/reports',
      summaryMode: 'fixtures',
      requireOk: true,
      summaryPath: '/tmp/reports/summary.json',
      validatorResultPath: '/tmp/reports/validator-result.json',
      reportSchemaValidatorResultPath: '/tmp/reports/report-schema-validator-result.json',
      schemaValidatorResultPath: '/tmp/reports/schema-validator-result.json',
      validatorResultVerifierResultPath: '/tmp/reports/validator-result-verifier-result.json',
      artifactBundleManifestValidatorResultPath: '/tmp/reports/artifact-bundle-manifest-validator-result.json',
      verifiedArtifacts: artifactContracts.map((entry) => entry.artifactName),
      artifactContracts: artifactContracts.map((entry) => (
        entry.artifactName === 'summary.json'
          ? { ...entry, versionField: 'outputSchemaVersion' }
          : entry
      ))
    })).toThrow('artifactContracts entry for summary.json must use versionField=summarySchemaVersion');

    expect(() => ensureCompatArtifactBundleValidatorPayloadShape({
      outputSchemaVersion: COMPAT_ARTIFACT_BUNDLE_VALIDATOR_OUTPUT_SCHEMA_VERSION,
      status: 'ok',
      reportDir: '/tmp/reports',
      summaryMode: 'fixtures',
      requireOk: true,
      summaryPath: '/tmp/reports/summary.json',
      validatorResultPath: '/tmp/reports/validator-result.json',
      reportSchemaValidatorResultPath: '/tmp/reports/report-schema-validator-result.json',
      schemaValidatorResultPath: '/tmp/reports/schema-validator-result.json',
      validatorResultVerifierResultPath: '/tmp/reports/validator-result-verifier-result.json',
      artifactBundleManifestValidatorResultPath: '/tmp/reports/artifact-bundle-manifest-validator-result.json',
      verifiedArtifacts: artifactContracts.map((entry) => entry.artifactName),
      artifactContracts: artifactContracts.map((entry) => (
        entry.artifactName === 'summary.json'
          ? { ...entry, schemaPath: '/tmp/drifted-summary.schema.json' }
          : entry
      ))
    })).toThrow('artifactContracts entry for summary.json must reference schemaPath ending with schemas/compat-summary.schema.json');

    expect(() => ensureCompatArtifactBundleValidatorPayloadShape({
      outputSchemaVersion: COMPAT_ARTIFACT_BUNDLE_VALIDATOR_OUTPUT_SCHEMA_VERSION,
      status: 'ok',
      reportDir: '/tmp/reports',
      summaryMode: 'fixtures',
      requireOk: true,
      summaryPath: '/tmp/reports/summary.json',
      validatorResultPath: '/tmp/reports/validator-result.json',
      reportSchemaValidatorResultPath: '/tmp/reports/report-schema-validator-result.json',
      schemaValidatorResultPath: '/tmp/reports/schema-validator-result.json',
      validatorResultVerifierResultPath: '/tmp/reports/validator-result-verifier-result.json',
      artifactBundleManifestValidatorResultPath: '/tmp/reports/artifact-bundle-manifest-validator-result.json',
      verifiedArtifacts: artifactContracts.map((entry) => entry.artifactName),
      artifactContracts: artifactContracts.map((entry) => (
        entry.artifactName === 'summary.json'
          ? { ...entry, schemaId: 'https://example.dev/drifted-summary.schema.json' }
          : entry
      ))
    })).toThrow('artifactContracts entry for summary.json must use schemaId=https://clawvault.dev/schemas/compat-summary.schema.json');

    expect(() => ensureCompatArtifactBundleValidatorPayloadShape({
      outputSchemaVersion: COMPAT_ARTIFACT_BUNDLE_VALIDATOR_OUTPUT_SCHEMA_VERSION,
      status: 'error',
      error: ''
    })).toThrow('field "error"');
  });

  it('loads and validates payloads from disk', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'compat-artifact-bundle-validator-payload-'));
    const payloadPath = path.join(root, 'artifact-bundle-validator-result.json');
    try {
      const payload = buildCompatArtifactBundleValidatorErrorPayload('bad');
      fs.writeFileSync(payloadPath, JSON.stringify(payload, null, 2), 'utf-8');
      expect(loadCompatArtifactBundleValidatorPayload(payloadPath)).toEqual(payload);

      fs.writeFileSync(payloadPath, '{"status":"ok"', 'utf-8');
      expect(() => loadCompatArtifactBundleValidatorPayload(payloadPath)).toThrow(
        'Unable to read compat artifact bundle validator payload'
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
