import { describe, expect, it } from 'vitest';
import { createHash } from 'crypto';
import * as fs from 'fs';
import {
  resolveExecutablePath,
  sanitizeExecArgs,
  verifyExecutableIntegrity
} from './integrity.js';

describe('hook executable integrity helpers', () => {
  it('resolves an explicit executable path', () => {
    const resolved = resolveExecutablePath('clawvault', { explicitPath: process.execPath });
    expect(resolved).toBe(process.execPath);
  });

  it('rejects non-array arguments', () => {
    expect(() => sanitizeExecArgs('not-an-array')).toThrow('Arguments must be an array');
  });

  it('rejects null-byte arguments', () => {
    expect(() => sanitizeExecArgs(['ok', 'bad\0arg'])).toThrow('contains a null byte');
  });

  it('verifies expected executable sha256', () => {
    const expected = createHash('sha256')
      .update(fs.readFileSync(process.execPath))
      .digest('hex');
    const result = verifyExecutableIntegrity(process.execPath, expected);
    expect(result.ok).toBe(true);
    expect(result.actualSha256).toBe(expected);
  });
});
