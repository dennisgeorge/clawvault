import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import {
  buildSummaryValidatorErrorPayload
} from './lib/compat-summary-validator-output.mjs';
import { COMPAT_VALIDATOR_RESULT_VERIFIER_OUTPUT_SCHEMA_VERSION } from './lib/compat-validator-result-verifier-output.mjs';

const validatorResultScript = path.resolve(process.cwd(), 'scripts', 'validate-compat-validator-result.mjs');

function runValidatorResult(args = [], env = {}) {
  return spawnSync(
    process.execPath,
    [validatorResultScript, ...args],
    {
      cwd: process.cwd(),
      env: { ...process.env, ...env },
      encoding: 'utf-8'
    }
  );
}

function parseJsonLine(stdout) {
  return JSON.parse(stdout.trim());
}

describe('validate-compat-validator-result script', () => {
  it('validates payload via explicit path argument', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'compat-validator-result-'));
    const payloadPath = path.join(root, 'validator-result.json');
    try {
      fs.writeFileSync(payloadPath, JSON.stringify(buildSummaryValidatorErrorPayload('boom'), null, 2), 'utf-8');
      const result = runValidatorResult([payloadPath]);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('Validator result payload is valid');

      const requireOkFailure = runValidatorResult(['--validator-result', payloadPath, '--require-ok']);
      expect(requireOkFailure.status).toBe(1);
      expect(requireOkFailure.stderr).toContain('--require-ok');

      const outPath = path.join(root, 'validator-verify-result.json');
      const jsonResult = runValidatorResult(['--validator-result', payloadPath, '--json', '--out', outPath]);
      expect(jsonResult.status).toBe(0);
      const expectedPayload = {
        outputSchemaVersion: COMPAT_VALIDATOR_RESULT_VERIFIER_OUTPUT_SCHEMA_VERSION,
        status: 'ok',
        payloadPath,
        payloadStatus: 'error',
        validatorPayloadOutputSchemaVersion: 1
      };
      expect(parseJsonLine(jsonResult.stdout)).toEqual(expectedPayload);
      expect(JSON.parse(fs.readFileSync(outPath, 'utf-8'))).toEqual(expectedPayload);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('supports COMPAT_REPORT_DIR fallback and fails cleanly for invalid payloads', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'compat-validator-result-'));
    try {
      const payloadPath = path.join(root, 'validator-result.json');
      fs.writeFileSync(payloadPath, JSON.stringify(buildSummaryValidatorErrorPayload('bad'), null, 2), 'utf-8');
      const success = runValidatorResult([], { COMPAT_REPORT_DIR: root });
      expect(success.status).toBe(0);

      fs.writeFileSync(payloadPath, '{"status":"ok"', 'utf-8');
      const failure = runValidatorResult([], { COMPAT_REPORT_DIR: root });
      expect(failure.status).toBe(1);
      expect(failure.stderr).toContain('Unable to read validator result payload');

      const errorOutPath = path.join(root, 'validator-verify-error.json');
      const jsonFailure = runValidatorResult(['--json', '--out', errorOutPath], { COMPAT_REPORT_DIR: root });
      expect(jsonFailure.status).toBe(1);
      const expectedErrorPayload = {
        outputSchemaVersion: COMPAT_VALIDATOR_RESULT_VERIFIER_OUTPUT_SCHEMA_VERSION,
        status: 'error',
        error: expect.stringContaining('Unable to read validator result payload')
      };
      expect(parseJsonLine(jsonFailure.stdout)).toEqual(expectedErrorPayload);
      expect(JSON.parse(fs.readFileSync(errorOutPath, 'utf-8'))).toEqual(expectedErrorPayload);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('prints usage help and validates argument error messaging', () => {
    const helpResult = runValidatorResult(['--help']);
    expect(helpResult.status).toBe(0);
    expect(helpResult.stdout).toContain('Usage: node scripts/validate-compat-validator-result.mjs');
    expect(helpResult.stdout).toContain('--validator-result <path>');
    expect(helpResult.stdout).toContain('--json');
    expect(helpResult.stdout).toContain('--require-ok');

    const unknownOptionResult = runValidatorResult(['--unknown']);
    expect(unknownOptionResult.status).toBe(1);
    expect(unknownOptionResult.stderr).toContain('Unknown option');

    const missingValueResult = runValidatorResult(['--validator-result']);
    expect(missingValueResult.status).toBe(1);
    expect(missingValueResult.stderr).toContain('Missing value for --validator-result');
  });
});
