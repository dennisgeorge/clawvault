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

describe('compat artifact bundle validator output payload contracts', () => {
  it('builds and validates success payloads', () => {
    const payload = buildCompatArtifactBundleValidatorSuccessPayload({
      reportDir: '/tmp/reports',
      summaryMode: 'fixtures',
      requireOk: true,
      summaryPath: '/tmp/reports/summary.json',
      validatorResultPath: '/tmp/reports/validator-result.json',
      reportSchemaValidatorResultPath: '/tmp/reports/report-schema-validator-result.json',
      schemaValidatorResultPath: '/tmp/reports/schema-validator-result.json',
      validatorResultVerifierResultPath: '/tmp/reports/validator-result-verifier-result.json',
      verifiedArtifacts: [
        'summary.json',
        'validator-result.json'
      ]
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
