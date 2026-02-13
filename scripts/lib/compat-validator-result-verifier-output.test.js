import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  buildValidatorResultVerifierErrorPayload,
  buildValidatorResultVerifierSuccessPayload,
  COMPAT_VALIDATOR_RESULT_VERIFIER_OUTPUT_SCHEMA_VERSION,
  ensureValidatorResultVerifierPayloadShape,
  loadValidatorResultVerifierPayload
} from './compat-validator-result-verifier-output.mjs';

describe('compat validator-result verifier output payload contracts', () => {
  it('builds and validates success payloads', () => {
    const payload = buildValidatorResultVerifierSuccessPayload({
      payloadPath: '/tmp/validator-result.json',
      payloadStatus: 'ok',
      validatorPayloadOutputSchemaVersion: 1
    });
    expect(payload.outputSchemaVersion).toBe(COMPAT_VALIDATOR_RESULT_VERIFIER_OUTPUT_SCHEMA_VERSION);
    expect(() => ensureValidatorResultVerifierPayloadShape(payload)).not.toThrow();
  });

  it('builds and validates error payloads', () => {
    const payload = buildValidatorResultVerifierErrorPayload('boom');
    expect(payload).toEqual({
      outputSchemaVersion: COMPAT_VALIDATOR_RESULT_VERIFIER_OUTPUT_SCHEMA_VERSION,
      status: 'error',
      error: 'boom'
    });
    expect(() => ensureValidatorResultVerifierPayloadShape(payload)).not.toThrow();
  });

  it('rejects malformed payload shapes', () => {
    expect(() => ensureValidatorResultVerifierPayloadShape({
      outputSchemaVersion: COMPAT_VALIDATOR_RESULT_VERIFIER_OUTPUT_SCHEMA_VERSION,
      status: 'ok',
      payloadPath: '/tmp/x.json',
      payloadStatus: 'bad',
      validatorPayloadOutputSchemaVersion: 1
    })).toThrow('payloadStatus');

    expect(() => ensureValidatorResultVerifierPayloadShape({
      outputSchemaVersion: COMPAT_VALIDATOR_RESULT_VERIFIER_OUTPUT_SCHEMA_VERSION,
      status: 'error',
      error: ''
    })).toThrow('field "error"');
  });

  it('loads and validates payloads from disk', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'validator-result-verifier-payload-'));
    const payloadPath = path.join(root, 'validator-result-verifier-result.json');
    try {
      const payload = buildValidatorResultVerifierErrorPayload('bad');
      fs.writeFileSync(payloadPath, JSON.stringify(payload, null, 2), 'utf-8');
      expect(loadValidatorResultVerifierPayload(payloadPath)).toEqual(payload);

      fs.writeFileSync(payloadPath, '{"status":"ok"', 'utf-8');
      expect(() => loadValidatorResultVerifierPayload(payloadPath)).toThrow(
        'Unable to read validator-result verifier payload'
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
