import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { buildSummaryValidatorSuccessPayload } from './lib/compat-summary-validator-output.mjs';
import {
  JSON_SCHEMA_VALIDATOR_OUTPUT_SCHEMA_VERSION
} from './lib/json-schema-validator-output.mjs';

const schemaValidatorScript = path.resolve(process.cwd(), 'scripts', 'validate-json-schema.mjs');

function runSchemaValidator(args = []) {
  return spawnSync(
    process.execPath,
    [schemaValidatorScript, ...args],
    {
      cwd: process.cwd(),
      encoding: 'utf-8'
    }
  );
}

function parseJsonLine(stdout) {
  return JSON.parse(stdout.trim());
}

describe('validate-json-schema script', () => {
  it('validates payload against schema with json and out output', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'compat-schema-validate-'));
    try {
      const schemaPath = path.resolve(process.cwd(), 'schemas', 'compat-summary-validator-output.schema.json');
      const dataPath = path.join(root, 'validator-result.json');
      const outPath = path.join(root, 'schema-validator-result.json');

      fs.writeFileSync(dataPath, JSON.stringify(buildSummaryValidatorSuccessPayload({
        mode: 'fixtures',
        summarySchemaVersion: 1,
        fixtureSchemaVersion: 2,
        selectedTotal: 1,
        resultCount: 1,
        summaryPath: '/tmp/summary.json',
        reportDir: '/tmp',
        caseReportMode: 'validated-case-reports'
      }), null, 2), 'utf-8');

      const result = runSchemaValidator(['--schema', schemaPath, '--data', dataPath, '--json', '--out', outPath]);
      expect(result.status).toBe(0);
      const payload = parseJsonLine(result.stdout);
      expect(payload.status).toBe('ok');
      expect(JSON.parse(fs.readFileSync(outPath, 'utf-8'))).toEqual(payload);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('returns structured validation errors and argument errors', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'compat-schema-validate-'));
    try {
      const schemaPath = path.resolve(process.cwd(), 'schemas', 'compat-summary-validator-output.schema.json');
      const dataPath = path.join(root, 'invalid-validator-result.json');
      const outPath = path.join(root, 'schema-validator-error.json');
      fs.writeFileSync(dataPath, JSON.stringify({ outputSchemaVersion: 1, status: 'ok' }, null, 2), 'utf-8');

      const invalidResult = runSchemaValidator(['--schema', schemaPath, '--data', dataPath, '--json', '--out', outPath]);
      expect(invalidResult.status).toBe(1);
      const invalidPayload = parseJsonLine(invalidResult.stdout);
      expect(invalidPayload.status).toBe('error');
      expect(invalidPayload.validationErrors.length).toBeGreaterThan(0);
      expect(JSON.parse(fs.readFileSync(outPath, 'utf-8'))).toEqual(invalidPayload);

      const parseErrorOutPath = path.join(root, 'schema-validator-parse-error.json');
      const parseErrorResult = runSchemaValidator(['--json', '--schema', '--out', parseErrorOutPath]);
      expect(parseErrorResult.status).toBe(1);
      expect(parseJsonLine(parseErrorResult.stdout)).toEqual({
        outputSchemaVersion: JSON_SCHEMA_VALIDATOR_OUTPUT_SCHEMA_VERSION,
        status: 'error',
        error: 'Missing value for --schema'
      });
      expect(JSON.parse(fs.readFileSync(parseErrorOutPath, 'utf-8'))).toEqual({
        outputSchemaVersion: JSON_SCHEMA_VALIDATOR_OUTPUT_SCHEMA_VERSION,
        status: 'error',
        error: 'Missing value for --schema'
      });
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('prints help output successfully', () => {
    const result = runSchemaValidator(['--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Usage: node scripts/validate-json-schema.mjs');
    expect(result.stdout).toContain('--schema <schema.json>');
  });
});
