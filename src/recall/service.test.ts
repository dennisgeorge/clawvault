import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createVault, ClawVault } from '../lib/vault.js';
import { buildRecallResult } from './service.js';

const tempDirs: string[] = [];

function makeTempVaultPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawvault-recall-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

async function seedVault(vaultPath: string): Promise<ClawVault> {
  const vault = await createVault(vaultPath, { name: 'recall-test' }, { skipGraph: true, skipBases: true });
  await vault.store({
    category: 'decisions',
    title: 'Cache strategy',
    content: 'We decided to cache profile lookups for five minutes to reduce load.',
    frontmatter: { memoryType: 'decision', date: new Date().toISOString() }
  });
  await vault.store({
    category: 'people',
    title: 'Alice',
    content: '[[Alice]] works with [[Bob]] to improve observability and incident response.',
    frontmatter: { memoryType: 'relationship', date: new Date().toISOString() }
  });
  await vault.store({
    category: 'projects',
    title: 'Project Phoenix',
    content: 'Project Phoenix focuses on zero-downtime deploys and robust verification steps.',
    frontmatter: { date: new Date().toISOString() }
  });
  return vault;
}

describe('buildRecallResult', () => {
  it('returns quick strategy context by default', async () => {
    const vault = await seedVault(makeTempVaultPath());
    const result = await buildRecallResult(vault, 'cache profile lookups');
    expect(result.strategy).toBe('quick');
    expect(result.sources.length).toBeGreaterThan(0);
    expect(result.context).toContain('ClawVault memory recall');
  });

  it('returns verification-focused context with sources', async () => {
    const vault = await seedVault(makeTempVaultPath());
    const result = await buildRecallResult(vault, 'verify source for cache decision', { includeSources: true });
    expect(result.strategy).toBe('verification');
    expect(result.context).toContain('Verification-oriented evidence');
    expect(result.context).toContain('decisions/cache-strategy');
  });

  it('returns relationship strategy results', async () => {
    const vault = await seedVault(makeTempVaultPath());
    const result = await buildRecallResult(vault, 'relationship between Alice and Bob');
    expect(result.strategy).toBe('relationship');
    expect(result.sources.some((source) => source.path.startsWith('people/'))).toBe(true);
  });
});

