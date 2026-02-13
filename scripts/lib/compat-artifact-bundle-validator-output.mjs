import * as fs from 'fs';

export const COMPAT_ARTIFACT_BUNDLE_VALIDATOR_OUTPUT_SCHEMA_VERSION = 1;

const VALID_SUMMARY_MODES = new Set(['contract', 'fixtures']);

function assertNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`compat artifact bundle validator payload field "${fieldName}" must be a non-empty string`);
  }
}

function assertUniqueNonEmptyStringArray(values, fieldName) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error(`compat artifact bundle validator payload field "${fieldName}" must be a non-empty array`);
  }
  if (values.some((value) => typeof value !== 'string' || value.length === 0)) {
    throw new Error(`compat artifact bundle validator payload field "${fieldName}" must contain only non-empty strings`);
  }
  const duplicates = values
    .filter((value, index, allValues) => allValues.indexOf(value) !== index)
    .filter((value, index, allValues) => allValues.indexOf(value) === index);
  if (duplicates.length > 0) {
    throw new Error(`compat artifact bundle validator payload field "${fieldName}" contains duplicates: ${duplicates.join(', ')}`);
  }
}

export function ensureCompatArtifactBundleValidatorPayloadShape(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('compat artifact bundle validator payload must be an object');
  }
  if (payload.outputSchemaVersion !== COMPAT_ARTIFACT_BUNDLE_VALIDATOR_OUTPUT_SCHEMA_VERSION) {
    throw new Error(
      `compat artifact bundle validator payload outputSchemaVersion must be ${COMPAT_ARTIFACT_BUNDLE_VALIDATOR_OUTPUT_SCHEMA_VERSION}`
    );
  }
  if (payload.status !== 'ok' && payload.status !== 'error') {
    throw new Error('compat artifact bundle validator payload status must be "ok" or "error"');
  }

  if (payload.status === 'ok') {
    assertNonEmptyString(payload.reportDir, 'reportDir');
    if (!VALID_SUMMARY_MODES.has(payload.summaryMode)) {
      throw new Error('compat artifact bundle validator payload field "summaryMode" must be "contract" or "fixtures"');
    }
    if (typeof payload.requireOk !== 'boolean') {
      throw new Error('compat artifact bundle validator payload field "requireOk" must be a boolean');
    }

    const pathFields = [
      'summaryPath',
      'validatorResultPath',
      'reportSchemaValidatorResultPath',
      'schemaValidatorResultPath',
      'validatorResultVerifierResultPath'
    ];
    for (const fieldName of pathFields) {
      assertNonEmptyString(payload[fieldName], fieldName);
    }

    assertUniqueNonEmptyStringArray(payload.verifiedArtifacts, 'verifiedArtifacts');
    return;
  }

  assertNonEmptyString(payload.error, 'error');
}

export function buildCompatArtifactBundleValidatorSuccessPayload({
  reportDir,
  summaryMode,
  requireOk,
  summaryPath,
  validatorResultPath,
  reportSchemaValidatorResultPath,
  schemaValidatorResultPath,
  validatorResultVerifierResultPath,
  verifiedArtifacts
}) {
  const payload = {
    outputSchemaVersion: COMPAT_ARTIFACT_BUNDLE_VALIDATOR_OUTPUT_SCHEMA_VERSION,
    status: 'ok',
    reportDir,
    summaryMode,
    requireOk,
    summaryPath,
    validatorResultPath,
    reportSchemaValidatorResultPath,
    schemaValidatorResultPath,
    validatorResultVerifierResultPath,
    verifiedArtifacts
  };
  ensureCompatArtifactBundleValidatorPayloadShape(payload);
  return payload;
}

export function buildCompatArtifactBundleValidatorErrorPayload(error) {
  const payload = {
    outputSchemaVersion: COMPAT_ARTIFACT_BUNDLE_VALIDATOR_OUTPUT_SCHEMA_VERSION,
    status: 'error',
    error: String(error ?? '')
  };
  ensureCompatArtifactBundleValidatorPayloadShape(payload);
  return payload;
}

export function loadCompatArtifactBundleValidatorPayload(payloadPath) {
  try {
    const raw = fs.readFileSync(payloadPath, 'utf-8');
    const parsed = JSON.parse(raw);
    ensureCompatArtifactBundleValidatorPayloadShape(parsed);
    return parsed;
  } catch (err) {
    throw new Error(`Unable to read compat artifact bundle validator payload at ${payloadPath}: ${err?.message || String(err)}`);
  }
}
