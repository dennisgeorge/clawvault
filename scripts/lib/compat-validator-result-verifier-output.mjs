import * as fs from 'fs';

export const COMPAT_VALIDATOR_RESULT_VERIFIER_OUTPUT_SCHEMA_VERSION = 1;

function assertNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`compat validator-result verifier payload field "${fieldName}" must be a non-empty string`);
  }
}

function assertNonNegativeInteger(value, fieldName) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`compat validator-result verifier payload field "${fieldName}" must be a non-negative integer`);
  }
}

export function ensureValidatorResultVerifierPayloadShape(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('compat validator-result verifier payload must be an object');
  }
  if (payload.outputSchemaVersion !== COMPAT_VALIDATOR_RESULT_VERIFIER_OUTPUT_SCHEMA_VERSION) {
    throw new Error(`compat validator-result verifier payload outputSchemaVersion must be ${COMPAT_VALIDATOR_RESULT_VERIFIER_OUTPUT_SCHEMA_VERSION}`);
  }
  if (payload.status !== 'ok' && payload.status !== 'error') {
    throw new Error('compat validator-result verifier payload status must be "ok" or "error"');
  }

  if (payload.status === 'ok') {
    assertNonEmptyString(payload.payloadPath, 'payloadPath');
    if (payload.payloadStatus !== 'ok' && payload.payloadStatus !== 'error') {
      throw new Error('compat validator-result verifier payload field "payloadStatus" must be "ok" or "error"');
    }
    assertNonNegativeInteger(payload.validatorPayloadOutputSchemaVersion, 'validatorPayloadOutputSchemaVersion');
    return;
  }

  assertNonEmptyString(payload.error, 'error');
}

export function buildValidatorResultVerifierSuccessPayload({
  payloadPath,
  payloadStatus,
  validatorPayloadOutputSchemaVersion
}) {
  const payload = {
    outputSchemaVersion: COMPAT_VALIDATOR_RESULT_VERIFIER_OUTPUT_SCHEMA_VERSION,
    status: 'ok',
    payloadPath,
    payloadStatus,
    validatorPayloadOutputSchemaVersion
  };
  ensureValidatorResultVerifierPayloadShape(payload);
  return payload;
}

export function buildValidatorResultVerifierErrorPayload(error) {
  const payload = {
    outputSchemaVersion: COMPAT_VALIDATOR_RESULT_VERIFIER_OUTPUT_SCHEMA_VERSION,
    status: 'error',
    error: String(error ?? '')
  };
  ensureValidatorResultVerifierPayloadShape(payload);
  return payload;
}

export function loadValidatorResultVerifierPayload(payloadPath) {
  try {
    const raw = fs.readFileSync(payloadPath, 'utf-8');
    const parsed = JSON.parse(raw);
    ensureValidatorResultVerifierPayloadShape(parsed);
    return parsed;
  } catch (err) {
    throw new Error(`Unable to read validator-result verifier payload at ${payloadPath}: ${err?.message || String(err)}`);
  }
}
