import { describe, expect, it } from 'vitest';
import {
  buildValidatorResultVerifierErrorPayload,
  buildValidatorResultVerifierSuccessPayload,
  COMPAT_VALIDATOR_RESULT_VERIFIER_OUTPUT_SCHEMA_VERSION,
  ensureValidatorResultVerifierPayloadShape
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
});
