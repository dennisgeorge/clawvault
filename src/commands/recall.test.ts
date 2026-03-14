import { afterEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createVault } from '../lib/vault.js';
import { recallCommand } from './recall.js';

const tempDirs: string[] = [];

function makeTempVaultPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawvault-recall-command-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  vi.restoreAllMocks();
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('recallCommand', () => {
  it('prints markdown recall context by default', async () => {
    const vaultPath = makeTempVaultPath();
    const vault = await createVault(vaultPath, { name: 'recall-cmd-md' }, { skipGraph: true, skipBases: true });
    await vault.store({
      category: 'decisions',
      title: 'Release strategy',
      content: 'We decided to use blue/green deploys for safe rollbacks.',
      frontmatter: { memoryType: 'decision', date: new Date().toISOString() }
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const result = await recallCommand('release strategy', { vaultPath, limit: 4 });
    expect(result.sources.length).toBeGreaterThan(0);
    expect(logSpy).toHaveBeenCalled();
    expect(String(logSpy.mock.calls[0][0])).toContain('ClawVault memory recall');
  });

  it('supports json output', async () => {
    const vaultPath = makeTempVaultPath();
    const vault = await createVault(vaultPath, { name: 'recall-cmd-json' }, { skipGraph: true, skipBases: true });
    await vault.store({
      category: 'people',
      title: 'Alice',
      content: '[[Alice]] works with [[Bob]] on infrastructure migrations.',
      frontmatter: { memoryType: 'relationship', date: new Date().toISOString() }
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await recallCommand('relationship between Alice and Bob', {
      vaultPath,
      json: true,
      limit: 5
    });
    const payload = JSON.parse(String(logSpy.mock.calls[0][0])) as {
      strategy: string;
      context: string;
      sources: unknown[];
    };
    expect(payload.strategy).toBe('relationship');
    expect(payload.sources.length).toBeGreaterThan(0);
    expect(payload.context).toContain('Relationship-focused recall');
  });
});

