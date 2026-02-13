import * as fs from 'fs';

export const JSON_SCHEMA_VALIDATOR_OUTPUT_SCHEMA_VERSION = 1;

function assertNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`json schema validator payload field "${fieldName}" must be a non-empty string`);
  }
}

export function ensureJsonSchemaValidatorPayloadShape(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('json schema validator payload must be an object');
  }
  if (payload.outputSchemaVersion !== JSON_SCHEMA_VALIDATOR_OUTPUT_SCHEMA_VERSION) {
    throw new Error(`json schema validator payload outputSchemaVersion must be ${JSON_SCHEMA_VALIDATOR_OUTPUT_SCHEMA_VERSION}`);
  }
  if (payload.status !== 'ok' && payload.status !== 'error') {
    throw new Error('json schema validator payload status must be "ok" or "error"');
  }

  if (payload.status === 'ok') {
    assertNonEmptyString(payload.schemaPath, 'schemaPath');
    assertNonEmptyString(payload.dataPath, 'dataPath');
    return;
  }

  assertNonEmptyString(payload.error, 'error');
  if (payload.validationErrors !== undefined) {
    if (!Array.isArray(payload.validationErrors)) {
      throw new Error('json schema validator payload field "validationErrors" must be an array when present');
    }
    for (const [index, entry] of payload.validationErrors.entries()) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        throw new Error(`json schema validator payload validationErrors[${index}] must be an object`);
      }
      assertNonEmptyString(entry.keyword, `validationErrors[${index}].keyword`);
      assertNonEmptyString(entry.message, `validationErrors[${index}].message`);
      if (typeof entry.instancePath !== 'string') {
        throw new Error(`json schema validator payload validationErrors[${index}].instancePath must be a string`);
      }
      if (typeof entry.schemaPath !== 'string') {
        throw new Error(`json schema validator payload validationErrors[${index}].schemaPath must be a string`);
      }
    }
  }
}

export function buildJsonSchemaValidatorSuccessPayload({ schemaPath, dataPath }) {
  const payload = {
    outputSchemaVersion: JSON_SCHEMA_VALIDATOR_OUTPUT_SCHEMA_VERSION,
    status: 'ok',
    schemaPath,
    dataPath
  };
  ensureJsonSchemaValidatorPayloadShape(payload);
  return payload;
}

export function buildJsonSchemaValidatorErrorPayload({ error, validationErrors }) {
  const payload = {
    outputSchemaVersion: JSON_SCHEMA_VALIDATOR_OUTPUT_SCHEMA_VERSION,
    status: 'error',
    error: String(error ?? '')
  };
  if (Array.isArray(validationErrors) && validationErrors.length > 0) {
    payload.validationErrors = validationErrors;
  }
  ensureJsonSchemaValidatorPayloadShape(payload);
  return payload;
}

export function loadJsonSchemaValidatorPayload(payloadPath) {
  try {
    const raw = fs.readFileSync(payloadPath, 'utf-8');
    const parsed = JSON.parse(raw);
    ensureJsonSchemaValidatorPayloadShape(parsed);
    return parsed;
  } catch (err) {
    throw new Error(`Unable to read JSON schema validator payload at ${payloadPath}: ${err?.message || String(err)}`);
  }
}
