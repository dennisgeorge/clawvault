import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createVault } from '../lib/vault.js';
import { LiveCaptureService } from './service.js';

const tempDirs: string[] = [];

function tempVaultPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawvault-live-capture-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('LiveCaptureService', () => {
  it('captures assistant memories into markdown categories', async () => {
    const vaultPath = tempVaultPath();
    await createVault(vaultPath, { name: 'capture-test' }, { skipGraph: true, skipBases: true });
    const service = new LiveCaptureService();

    const result = await service.captureTurn([
      { role: 'assistant', content: 'We decided to use feature flags for gradual rollout. <memory_note type="lesson">We learned to monitor error budgets daily.</memory_note>' }
    ], { vaultPath });

    expect(result.stored).toBeGreaterThanOrEqual(2);
    expect(result.rejected).toBeGreaterThanOrEqual(0);

    const decisionDir = path.join(vaultPath, 'decisions');
    const lessonDir = path.join(vaultPath, 'lessons');
    expect(fs.existsSync(decisionDir)).toBe(true);
    expect(fs.existsSync(lessonDir)).toBe(true);
    expect(fs.readdirSync(decisionDir).some((name) => name.endsWith('.md'))).toBe(true);
    expect(fs.readdirSync(lessonDir).some((name) => name.endsWith('.md'))).toBe(true);
  });

  it('rejects duplicates on repeated capture', async () => {
    const vaultPath = tempVaultPath();
    await createVault(vaultPath, { name: 'capture-dedupe' }, { skipGraph: true, skipBases: true });
    const service = new LiveCaptureService();
    const messages = [{ role: 'assistant', content: 'We decided to enforce semantic commit messages for CI releases.' }];

    const firstRun = await service.captureTurn(messages, { vaultPath });
    const secondRun = await service.captureTurn(messages, { vaultPath });

    expect(firstRun.stored).toBeGreaterThan(0);
    expect(secondRun.rejected).toBeGreaterThan(0);
  });
});

