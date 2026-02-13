import * as fs from 'fs';

export const COMPAT_REPORT_SCHEMA_VALIDATOR_OUTPUT_SCHEMA_VERSION = 1;

const VALID_SUMMARY_MODES = new Set(['contract', 'fixtures']);
const VALID_CASE_REPORT_MODES = new Set(['validated-case-reports', 'skipped-case-reports']);

function assertNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`compat report schema validator payload field "${fieldName}" must be a non-empty string`);
  }
}

function assertNonNegativeInteger(value, fieldName) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`compat report schema validator payload field "${fieldName}" must be a non-negative integer`);
  }
}

export function ensureCompatReportSchemaValidatorPayloadShape(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('compat report schema validator payload must be an object');
  }
  if (payload.outputSchemaVersion !== COMPAT_REPORT_SCHEMA_VALIDATOR_OUTPUT_SCHEMA_VERSION) {
    throw new Error(
      `compat report schema validator payload outputSchemaVersion must be ${COMPAT_REPORT_SCHEMA_VALIDATOR_OUTPUT_SCHEMA_VERSION}`
    );
  }
  if (payload.status !== 'ok' && payload.status !== 'error') {
    throw new Error('compat report schema validator payload status must be "ok" or "error"');
  }

  if (payload.status === 'ok') {
    if (!VALID_SUMMARY_MODES.has(payload.mode)) {
      throw new Error('compat report schema validator payload mode must be "contract" or "fixtures"');
    }
    assertNonEmptyString(payload.summaryPath, 'summaryPath');
    assertNonEmptyString(payload.reportDir, 'reportDir');
    assertNonEmptyString(payload.summarySchemaPath, 'summarySchemaPath');
    assertNonEmptyString(payload.caseSchemaPath, 'caseSchemaPath');
    assertNonNegativeInteger(payload.validatedCaseReports, 'validatedCaseReports');
    if (!VALID_CASE_REPORT_MODES.has(payload.caseReportMode)) {
      throw new Error('compat report schema validator payload caseReportMode has invalid value');
    }
    return;
  }

  assertNonEmptyString(payload.error, 'error');
}

export function buildCompatReportSchemaValidatorSuccessPayload({
  mode,
  summaryPath,
  reportDir,
  summarySchemaPath,
  caseSchemaPath,
  validatedCaseReports,
  caseReportMode
}) {
  const payload = {
    outputSchemaVersion: COMPAT_REPORT_SCHEMA_VALIDATOR_OUTPUT_SCHEMA_VERSION,
    status: 'ok',
    mode,
    summaryPath,
    reportDir,
    summarySchemaPath,
    caseSchemaPath,
    validatedCaseReports,
    caseReportMode
  };
  ensureCompatReportSchemaValidatorPayloadShape(payload);
  return payload;
}

export function buildCompatReportSchemaValidatorErrorPayload(error) {
  const payload = {
    outputSchemaVersion: COMPAT_REPORT_SCHEMA_VALIDATOR_OUTPUT_SCHEMA_VERSION,
    status: 'error',
    error: String(error ?? '')
  };
  ensureCompatReportSchemaValidatorPayloadShape(payload);
  return payload;
}

export function loadCompatReportSchemaValidatorPayload(payloadPath) {
  try {
    const raw = fs.readFileSync(payloadPath, 'utf-8');
    const parsed = JSON.parse(raw);
    ensureCompatReportSchemaValidatorPayloadShape(parsed);
    return parsed;
  } catch (err) {
    throw new Error(`Unable to read compat report schema validator payload at ${payloadPath}: ${err?.message || String(err)}`);
  }
}
