import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  buildSummaryValidatorErrorPayload,
  buildSummaryValidatorSuccessPayload,
  COMPAT_SUMMARY_VALIDATOR_OUTPUT_SCHEMA_VERSION,
  ensureSummaryValidatorPayloadShape,
  loadSummaryValidatorPayload
} from './compat-summary-validator-output.mjs';

describe('compat summary validator output payload contracts', () => {
  it('builds and validates success payloads', () => {
    const payload = buildSummaryValidatorSuccessPayload({
      mode: 'fixtures',
      summarySchemaVersion: 1,
      fixtureSchemaVersion: 2,
      selectedTotal: 3,
      resultCount: 3,
      summaryPath: '/tmp/summary.json',
      reportDir: '/tmp',
      caseReportMode: 'validated-case-reports'
    });
    expect(payload.outputSchemaVersion).toBe(COMPAT_SUMMARY_VALIDATOR_OUTPUT_SCHEMA_VERSION);
    expect(() => ensureSummaryValidatorPayloadShape(payload)).not.toThrow();
  });

  it('builds and validates error payloads', () => {
    const payload = buildSummaryValidatorErrorPayload('boom');
    expect(payload).toEqual({
      outputSchemaVersion: COMPAT_SUMMARY_VALIDATOR_OUTPUT_SCHEMA_VERSION,
      status: 'error',
      error: 'boom'
    });
    expect(() => ensureSummaryValidatorPayloadShape(payload)).not.toThrow();
  });

  it('rejects malformed payload shapes', () => {
    expect(() => ensureSummaryValidatorPayloadShape({
      outputSchemaVersion: COMPAT_SUMMARY_VALIDATOR_OUTPUT_SCHEMA_VERSION,
      status: 'ok',
      mode: 'fixtures'
    })).toThrow('summarySchemaVersion');

    expect(() => ensureSummaryValidatorPayloadShape({
      outputSchemaVersion: COMPAT_SUMMARY_VALIDATOR_OUTPUT_SCHEMA_VERSION,
      status: 'error',
      error: ''
    })).toThrow('field "error"');

    expect(() => buildSummaryValidatorSuccessPayload({
      mode: 'fixtures',
      summarySchemaVersion: 1,
      fixtureSchemaVersion: 2,
      selectedTotal: 3,
      resultCount: 3,
      summaryPath: '/tmp/summary.json',
      reportDir: '/tmp',
      caseReportMode: 'unknown'
    })).toThrow('caseReportMode');
  });

  it('loads and validates payloads from disk', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'compat-validator-payload-'));
    const payloadPath = path.join(root, 'validator-result.json');
    try {
      const payload = buildSummaryValidatorErrorPayload('bad');
      fs.writeFileSync(payloadPath, JSON.stringify(payload, null, 2), 'utf-8');
      expect(loadSummaryValidatorPayload(payloadPath)).toEqual(payload);

      fs.writeFileSync(payloadPath, '{"status":"ok"', 'utf-8');
      expect(() => loadSummaryValidatorPayload(payloadPath)).toThrow('Unable to read validator result payload');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
