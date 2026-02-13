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

describe('compat artifact bundle manifest validator output payload contracts', () => {
  it('builds and validates success payloads', () => {
    const payload = buildCompatArtifactBundleManifestValidatorSuccessPayload({
      manifestPath: '/tmp/manifest.json',
      artifactCount: 1,
      artifacts: ['summary.json'],
      schemaContracts: [
        {
          artifactName: 'summary.json',
          artifactFile: 'summary.json',
          schemaPath: '/tmp/schemas/compat-summary.schema.json',
          schemaId: 'https://clawvault.dev/schemas/compat-summary.schema.json',
          versionField: 'summarySchemaVersion',
          expectedSchemaVersion: 1
        }
      ]
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
      artifactCount: 1,
      artifacts: ['summary.json'],
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
          artifactName: 'validator-result.json',
          artifactFile: 'validator-result.json',
          schemaPath: '/tmp/schemas/compat-summary-validator-output.schema.json',
          schemaId: 'https://clawvault.dev/schemas/compat-summary-validator-output.schema.json',
          versionField: 'outputSchemaVersion',
          expectedSchemaVersion: 1
        },
        {
          artifactName: 'summary.json',
          artifactFile: 'summary.json',
          schemaPath: '/tmp/schemas/compat-summary.schema.json',
          schemaId: 'https://clawvault.dev/schemas/compat-summary.schema.json',
          versionField: 'summarySchemaVersion',
          expectedSchemaVersion: 1
        }
      ]
    })).toThrow('artifactName order must match artifacts');

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
          artifactName: 'summary.json',
          artifactFile: 'summary-v2.json',
          schemaPath: '/tmp/schemas/compat-summary.schema.json',
          schemaId: 'https://clawvault.dev/schemas/compat-summary.schema.json',
          versionField: 'summarySchemaVersion',
          expectedSchemaVersion: 1
        }
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
