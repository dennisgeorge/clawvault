import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  buildCompatArtifactBundleManifestValidatorErrorPayload,
  buildCompatArtifactBundleManifestValidatorSuccessPayload,
  COMPAT_ARTIFACT_BUNDLE_MANIFEST_VALIDATOR_OUTPUT_SCHEMA_VERSION,
  ensureCompatArtifactBundleManifestValidatorPayloadShape,
  loadCompatArtifactBundleManifestValidatorPayload
} from './compat-artifact-bundle-manifest-validator-output.mjs';
import {
  REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_COUNT,
  REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_DEFINITIONS,
  REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES
} from './compat-artifact-bundle-contracts.mjs';

function buildRequiredSchemaContracts() {
  return REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_DEFINITIONS.map((definition) => ({
    artifactName: definition.artifactName,
    artifactFile: definition.artifactFile,
    schemaPath: path.resolve(process.cwd(), definition.schemaPath),
    schemaId: definition.schemaId,
    versionField: definition.versionField,
    expectedSchemaVersion: 1
  }));
}

describe('compat artifact bundle manifest validator output payload contracts', () => {
  it('builds and validates success payloads', () => {
    const schemaContracts = buildRequiredSchemaContracts();
    const payload = buildCompatArtifactBundleManifestValidatorSuccessPayload({
      manifestPath: '/tmp/manifest.json',
      artifactCount: schemaContracts.length,
      artifacts: schemaContracts.map((entry) => entry.artifactName),
      schemaContracts
    });
    expect(payload.outputSchemaVersion).toBe(COMPAT_ARTIFACT_BUNDLE_MANIFEST_VALIDATOR_OUTPUT_SCHEMA_VERSION);
    expect(() => ensureCompatArtifactBundleManifestValidatorPayloadShape(payload)).not.toThrow();
  });

  it('builds and validates error payloads', () => {
    const payload = buildCompatArtifactBundleManifestValidatorErrorPayload('boom');
    expect(payload).toEqual({
      outputSchemaVersion: COMPAT_ARTIFACT_BUNDLE_MANIFEST_VALIDATOR_OUTPUT_SCHEMA_VERSION,
      status: 'error',
      error: 'boom'
    });
    expect(() => ensureCompatArtifactBundleManifestValidatorPayloadShape(payload)).not.toThrow();
  });

  it('rejects malformed payload shapes', () => {
    expect(() => ensureCompatArtifactBundleManifestValidatorPayloadShape({
      outputSchemaVersion: COMPAT_ARTIFACT_BUNDLE_MANIFEST_VALIDATOR_OUTPUT_SCHEMA_VERSION,
      status: 'ok',
      manifestPath: '/tmp/manifest.json',
      artifactCount: REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES.length,
      artifacts: REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES,
      schemaContracts: []
    })).toThrow('schemaContracts.length');

    expect(() => ensureCompatArtifactBundleManifestValidatorPayloadShape({
      outputSchemaVersion: COMPAT_ARTIFACT_BUNDLE_MANIFEST_VALIDATOR_OUTPUT_SCHEMA_VERSION,
      status: 'ok',
      manifestPath: '/tmp/manifest.json',
      artifactCount: 2,
      artifacts: ['summary.json', 'validator-result.json'],
      schemaContracts: [
        {
          artifactName: 'summary.json',
          artifactFile: 'summary.json',
          schemaPath: '/tmp/schemas/compat-summary.schema.json',
          schemaId: 'https://clawvault.dev/schemas/compat-summary.schema.json',
          versionField: 'summarySchemaVersion',
          expectedSchemaVersion: 1
        },
        {
          artifactName: 'validator-result.json',
          artifactFile: 'validator-result.json',
          schemaPath: '/tmp/schemas/compat-summary-validator-output.schema.json',
          schemaId: 'https://clawvault.dev/schemas/compat-summary-validator-output.schema.json',
          versionField: 'outputSchemaVersion',
          expectedSchemaVersion: 1
        }
      ]
    })).toThrow(`artifactCount must be ${REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_COUNT}`);

    expect(() => ensureCompatArtifactBundleManifestValidatorPayloadShape({
      outputSchemaVersion: COMPAT_ARTIFACT_BUNDLE_MANIFEST_VALIDATOR_OUTPUT_SCHEMA_VERSION,
      status: 'ok',
      manifestPath: '/tmp/manifest.json',
      artifactCount: REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES.length,
      artifacts: [
        ...REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES.slice(0, -1),
        'extra-artifact.json'
      ],
      schemaContracts: [
        ...buildRequiredSchemaContracts().slice(0, -1),
        {
          artifactName: 'extra-artifact.json',
          artifactFile: 'extra-artifact.json',
          schemaPath: '/tmp/schemas/extra-artifact.schema.json',
          schemaId: 'https://clawvault.dev/schemas/extra-artifact.schema.json',
          versionField: 'outputSchemaVersion',
          expectedSchemaVersion: 1
        }
      ]
    })).toThrow('artifacts contains unsupported artifactName values');

    expect(() => ensureCompatArtifactBundleManifestValidatorPayloadShape({
      outputSchemaVersion: COMPAT_ARTIFACT_BUNDLE_MANIFEST_VALIDATOR_OUTPUT_SCHEMA_VERSION,
      status: 'ok',
      manifestPath: '/tmp/manifest.json',
      artifactCount: REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES.length,
      artifacts: REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES,
      schemaContracts: [
        ...buildRequiredSchemaContracts().slice(0, -1),
        {
          artifactName: 'extra-artifact.json',
          artifactFile: 'extra-artifact.json',
          schemaPath: '/tmp/schemas/extra-artifact.schema.json',
          schemaId: 'https://clawvault.dev/schemas/extra-artifact.schema.json',
          versionField: 'outputSchemaVersion',
          expectedSchemaVersion: 1
        }
      ]
    })).toThrow('schemaContracts contains unsupported artifactName values');

    expect(() => ensureCompatArtifactBundleManifestValidatorPayloadShape({
      outputSchemaVersion: COMPAT_ARTIFACT_BUNDLE_MANIFEST_VALIDATOR_OUTPUT_SCHEMA_VERSION,
      status: 'ok',
      manifestPath: '/tmp/manifest.json',
      artifactCount: REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES.length,
      artifacts: REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES,
      schemaContracts: buildRequiredSchemaContracts().map((entry) => (
        entry.artifactName === 'summary.json'
          ? { ...entry, versionField: 'outputSchemaVersion' }
          : entry
      ))
    })).toThrow('schemaContracts entry for summary.json must use versionField=summarySchemaVersion');

    expect(() => ensureCompatArtifactBundleManifestValidatorPayloadShape({
      outputSchemaVersion: COMPAT_ARTIFACT_BUNDLE_MANIFEST_VALIDATOR_OUTPUT_SCHEMA_VERSION,
      status: 'ok',
      manifestPath: '/tmp/manifest.json',
      artifactCount: REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES.length,
      artifacts: REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES,
      schemaContracts: buildRequiredSchemaContracts().map((entry) => (
        entry.artifactName === 'summary.json'
          ? { ...entry, artifactFile: 'summary-v2.json' }
          : entry
      ))
    })).toThrow('schemaContracts entry for summary.json must use artifactFile=summary.json');

    expect(() => ensureCompatArtifactBundleManifestValidatorPayloadShape({
      outputSchemaVersion: COMPAT_ARTIFACT_BUNDLE_MANIFEST_VALIDATOR_OUTPUT_SCHEMA_VERSION,
      status: 'ok',
      manifestPath: '/tmp/manifest.json',
      artifactCount: REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES.length,
      artifacts: REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES,
      schemaContracts: buildRequiredSchemaContracts().map((entry) => (
        entry.artifactName === 'summary.json'
          ? { ...entry, schemaPath: '/tmp/drifted-summary.schema.json' }
          : entry
      ))
    })).toThrow('schemaContracts entry for summary.json must reference schemaPath ending with schemas/compat-summary.schema.json');

    expect(() => ensureCompatArtifactBundleManifestValidatorPayloadShape({
      outputSchemaVersion: COMPAT_ARTIFACT_BUNDLE_MANIFEST_VALIDATOR_OUTPUT_SCHEMA_VERSION,
      status: 'ok',
      manifestPath: '/tmp/manifest.json',
      artifactCount: REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES.length,
      artifacts: REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES,
      schemaContracts: buildRequiredSchemaContracts().map((entry) => (
        entry.artifactName === 'summary.json'
          ? { ...entry, schemaId: 'https://example.dev/drifted-summary.schema.json' }
          : entry
      ))
    })).toThrow('schemaContracts entry for summary.json must use schemaId=https://clawvault.dev/schemas/compat-summary.schema.json');

    expect(() => ensureCompatArtifactBundleManifestValidatorPayloadShape({
      outputSchemaVersion: COMPAT_ARTIFACT_BUNDLE_MANIFEST_VALIDATOR_OUTPUT_SCHEMA_VERSION,
      status: 'ok',
      manifestPath: '/tmp/manifest.json',
      artifactCount: REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES.length,
      artifacts: [
        REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES[1],
        REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES[0],
        ...REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES.slice(2)
      ],
      schemaContracts: buildRequiredSchemaContracts()
    })).toThrow('artifacts must follow required canonical artifactName order');

    const reorderedSchemaContracts = buildRequiredSchemaContracts();
    [reorderedSchemaContracts[0], reorderedSchemaContracts[1]] = [reorderedSchemaContracts[1], reorderedSchemaContracts[0]];
    expect(() => ensureCompatArtifactBundleManifestValidatorPayloadShape({
      outputSchemaVersion: COMPAT_ARTIFACT_BUNDLE_MANIFEST_VALIDATOR_OUTPUT_SCHEMA_VERSION,
      status: 'ok',
      manifestPath: '/tmp/manifest.json',
      artifactCount: REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES.length,
      artifacts: REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES,
      schemaContracts: reorderedSchemaContracts
    })).toThrow('artifactName order must match artifacts');

    expect(() => ensureCompatArtifactBundleManifestValidatorPayloadShape({
      outputSchemaVersion: COMPAT_ARTIFACT_BUNDLE_MANIFEST_VALIDATOR_OUTPUT_SCHEMA_VERSION,
      status: 'ok',
      manifestPath: '/tmp/manifest.json',
      artifactCount: REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES.length,
      artifacts: REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES,
      schemaContracts: [
        buildRequiredSchemaContracts()[0],
        { ...buildRequiredSchemaContracts()[0], artifactFile: 'summary-v2.json' },
        ...buildRequiredSchemaContracts().slice(2)
      ]
    })).toThrow('duplicate artifactName values');

    expect(() => ensureCompatArtifactBundleManifestValidatorPayloadShape({
      outputSchemaVersion: COMPAT_ARTIFACT_BUNDLE_MANIFEST_VALIDATOR_OUTPUT_SCHEMA_VERSION,
      status: 'error',
      error: ''
    })).toThrow('field "error"');
  });

  it('loads and validates payloads from disk', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'compat-artifact-bundle-manifest-validator-payload-'));
    const payloadPath = path.join(root, 'manifest-validator-result.json');
    try {
      const payload = buildCompatArtifactBundleManifestValidatorErrorPayload('bad');
      fs.writeFileSync(payloadPath, JSON.stringify(payload, null, 2), 'utf-8');
      expect(loadCompatArtifactBundleManifestValidatorPayload(payloadPath)).toEqual(payload);

      fs.writeFileSync(payloadPath, '{"status":"ok"', 'utf-8');
      expect(() => loadCompatArtifactBundleManifestValidatorPayload(payloadPath)).toThrow(
        'Unable to read compat artifact bundle manifest validator payload'
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
