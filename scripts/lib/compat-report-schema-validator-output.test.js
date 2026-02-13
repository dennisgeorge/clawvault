import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  buildCompatReportSchemaValidatorErrorPayload,
  buildCompatReportSchemaValidatorSuccessPayload,
  COMPAT_REPORT_SCHEMA_VALIDATOR_OUTPUT_SCHEMA_VERSION,
  ensureCompatReportSchemaValidatorPayloadShape,
  loadCompatReportSchemaValidatorPayload
} from './compat-report-schema-validator-output.mjs';

describe('compat report schema validator output payload contracts', () => {
  it('builds and validates success payloads', () => {
    const payload = buildCompatReportSchemaValidatorSuccessPayload({
      mode: 'fixtures',
      summaryPath: '/tmp/summary.json',
      reportDir: '/tmp/reports',
      summarySchemaPath: '/tmp/compat-summary.schema.json',
      caseSchemaPath: '/tmp/compat-case-report.schema.json',
      validatedCaseReports: 3,
      caseReportMode: 'validated-case-reports'
    });
    expect(payload.outputSchemaVersion).toBe(COMPAT_REPORT_SCHEMA_VALIDATOR_OUTPUT_SCHEMA_VERSION);
    expect(() => ensureCompatReportSchemaValidatorPayloadShape(payload)).not.toThrow();
  });

  it('builds and validates error payloads', () => {
    const payload = buildCompatReportSchemaValidatorErrorPayload('boom');
    expect(payload).toEqual({
      outputSchemaVersion: COMPAT_REPORT_SCHEMA_VALIDATOR_OUTPUT_SCHEMA_VERSION,
      status: 'error',
      error: 'boom'
    });
    expect(() => ensureCompatReportSchemaValidatorPayloadShape(payload)).not.toThrow();
  });

  it('rejects malformed payload shapes', () => {
    expect(() => ensureCompatReportSchemaValidatorPayloadShape({
      outputSchemaVersion: COMPAT_REPORT_SCHEMA_VALIDATOR_OUTPUT_SCHEMA_VERSION,
      status: 'ok',
      mode: 'fixtures'
    })).toThrow('summaryPath');

    expect(() => ensureCompatReportSchemaValidatorPayloadShape({
      outputSchemaVersion: COMPAT_REPORT_SCHEMA_VALIDATOR_OUTPUT_SCHEMA_VERSION,
      status: 'error',
      error: ''
    })).toThrow('field "error"');

    expect(() => buildCompatReportSchemaValidatorSuccessPayload({
      mode: 'fixtures',
      summaryPath: '/tmp/summary.json',
      reportDir: '/tmp/reports',
      summarySchemaPath: '/tmp/compat-summary.schema.json',
      caseSchemaPath: '/tmp/compat-case-report.schema.json',
      validatedCaseReports: 3,
      caseReportMode: 'unknown'
    })).toThrow('caseReportMode');
  });

  it('loads and validates payloads from disk', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'compat-report-schema-validator-payload-'));
    const payloadPath = path.join(root, 'report-schema-validator-result.json');
    try {
      const payload = buildCompatReportSchemaValidatorErrorPayload('bad');
      fs.writeFileSync(payloadPath, JSON.stringify(payload, null, 2), 'utf-8');
      expect(loadCompatReportSchemaValidatorPayload(payloadPath)).toEqual(payload);

      fs.writeFileSync(payloadPath, '{"status":"ok"', 'utf-8');
      expect(() => loadCompatReportSchemaValidatorPayload(payloadPath)).toThrow(
        'Unable to read compat report schema validator payload'
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
