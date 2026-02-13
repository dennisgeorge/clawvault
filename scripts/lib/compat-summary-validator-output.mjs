import * as fs from 'fs';

export const COMPAT_SUMMARY_VALIDATOR_OUTPUT_SCHEMA_VERSION = 1;

const VALID_SUMMARY_MODES = new Set(['contract', 'fixtures']);
const VALID_CASE_REPORT_MODES = new Set(['validated-case-reports', 'skipped-case-reports']);

function assertNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`compat summary validator payload field "${fieldName}" must be a non-empty string`);
  }
}

function assertNonNegativeInteger(value, fieldName) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`compat summary validator payload field "${fieldName}" must be a non-negative integer`);
  }
}

export function ensureSummaryValidatorPayloadShape(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('compat summary validator payload must be an object');
  }
  if (payload.outputSchemaVersion !== COMPAT_SUMMARY_VALIDATOR_OUTPUT_SCHEMA_VERSION) {
    throw new Error(`compat summary validator payload outputSchemaVersion must be ${COMPAT_SUMMARY_VALIDATOR_OUTPUT_SCHEMA_VERSION}`);
  }
  if (payload.status !== 'ok' && payload.status !== 'error') {
    throw new Error(`compat summary validator payload status must be "ok" or "error"`);
  }

  if (payload.status === 'ok') {
    if (!VALID_SUMMARY_MODES.has(payload.mode)) {
      throw new Error('compat summary validator payload mode must be "contract" or "fixtures"');
    }
    assertNonNegativeInteger(payload.summarySchemaVersion, 'summarySchemaVersion');
    assertNonNegativeInteger(payload.fixtureSchemaVersion, 'fixtureSchemaVersion');
    assertNonNegativeInteger(payload.selectedTotal, 'selectedTotal');
    assertNonNegativeInteger(payload.resultCount, 'resultCount');
    assertNonEmptyString(payload.summaryPath, 'summaryPath');
    assertNonEmptyString(payload.reportDir, 'reportDir');
    if (!VALID_CASE_REPORT_MODES.has(payload.caseReportMode)) {
      throw new Error('compat summary validator payload caseReportMode has invalid value');
    }
    return;
  }

  assertNonEmptyString(payload.error, 'error');
}

export function buildSummaryValidatorSuccessPayload({
  mode,
  summarySchemaVersion,
  fixtureSchemaVersion,
  selectedTotal,
  resultCount,
  summaryPath,
  reportDir,
  caseReportMode
}) {
  const payload = {
    outputSchemaVersion: COMPAT_SUMMARY_VALIDATOR_OUTPUT_SCHEMA_VERSION,
    status: 'ok',
    mode,
    summarySchemaVersion,
    fixtureSchemaVersion,
    selectedTotal,
    resultCount,
    summaryPath,
    reportDir,
    caseReportMode
  };
  ensureSummaryValidatorPayloadShape(payload);
  return payload;
}

export function buildSummaryValidatorErrorPayload(error) {
  const payload = {
    outputSchemaVersion: COMPAT_SUMMARY_VALIDATOR_OUTPUT_SCHEMA_VERSION,
    status: 'error',
    error: String(error ?? '')
  };
  ensureSummaryValidatorPayloadShape(payload);
  return payload;
}

export function loadSummaryValidatorPayload(payloadPath) {
  try {
    const raw = fs.readFileSync(payloadPath, 'utf-8');
    const parsed = JSON.parse(raw);
    ensureSummaryValidatorPayloadShape(parsed);
    return parsed;
  } catch (err) {
    throw new Error(`Unable to read validator result payload at ${payloadPath}: ${err?.message || String(err)}`);
  }
}
