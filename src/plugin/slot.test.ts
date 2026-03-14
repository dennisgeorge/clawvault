import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createVault } from '../lib/vault.js';
import { createMemorySlot, createMemorySlotPlugin } from './slot.js';

const tempDirs: string[] = [];

function makeTempVaultPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawvault-slot-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('memory slot plugin', () => {
  it('registers memory slot under plugins.slots.memory', () => {
    const plugin = createMemorySlotPlugin();
    expect(plugin.plugins.slots.memory).toBeDefined();
    expect(typeof plugin.plugins.slots.memory.recall).toBe('function');
  });

  it('stores and searches memory through slot API', async () => {
    const vaultPath = makeTempVaultPath();
    await createVault(vaultPath, { name: 'slot-store-search' }, { skipGraph: true, skipBases: true });
    const slot = createMemorySlot({ vaultPath });

    await slot.store('Alice prefers concise release notes.', {
      type: 'preference',
      title: 'release note preference'
    });
    const results = await slot.search('concise release notes', { limit: 3 });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].document.category).toBe('preferences');
  }, 20_000);

  it('captures assistant responses and returns recall context', async () => {
    const vaultPath = makeTempVaultPath();
    await createVault(vaultPath, { name: 'slot-capture-recall' }, { skipGraph: true, skipBases: true });
    const slot = createMemorySlot({ vaultPath });

    const captureResult = await slot.capture([
      {
        role: 'assistant',
        content: 'We decided to deploy canary releases first. <memory_note type="lesson">We learned alerts must include owner routing.</memory_note>'
      }
    ]);
    expect(captureResult.stored).toBeGreaterThanOrEqual(2);

    const context = await slot.recall('verify source for canary release decision');
    expect(context).toContain('strategy: verification');
    expect(context).toContain('canary');
  }, 20_000);
});

