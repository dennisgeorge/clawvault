import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import {
  buildSummaryValidatorErrorPayload
} from './lib/compat-summary-validator-output.mjs';

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

describe('validate-compat-validator-result script', () => {
  it('validates payload via explicit path argument', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'compat-validator-result-'));
    const payloadPath = path.join(root, 'validator-result.json');
    try {
      fs.writeFileSync(payloadPath, JSON.stringify(buildSummaryValidatorErrorPayload('boom'), null, 2), 'utf-8');
      const result = runValidatorResult([payloadPath]);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('Validator result payload is valid');
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
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
