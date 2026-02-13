import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  bestEffortOutPath,
  isJsonModeRequestedFromArgv,
  writeValidatedJsonPayload
} from './validator-cli-utils.mjs';

describe('validator cli utility helpers', () => {
  it('detects json mode and best-effort out path', () => {
    expect(isJsonModeRequestedFromArgv(['--json'])).toBe(true);
    expect(isJsonModeRequestedFromArgv(['--help'])).toBe(false);

    expect(bestEffortOutPath(['--out', 'result.json'])).toBe('result.json');
    expect(bestEffortOutPath(['--out'])).toBe('');
    expect(bestEffortOutPath(['--out', '--json'])).toBe('');
    expect(bestEffortOutPath(['--json'])).toBe('');
  });

  it('writes validated payloads to output path', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'validator-cli-utils-'));
    try {
      const outPath = path.join(root, 'nested', 'payload.json');
      const payload = { status: 'ok' };
      writeValidatedJsonPayload(outPath, payload, (candidate) => {
        if (!candidate || candidate.status !== 'ok') {
          throw new Error('invalid payload');
        }
      });
      expect(JSON.parse(fs.readFileSync(outPath, 'utf-8'))).toEqual(payload);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
