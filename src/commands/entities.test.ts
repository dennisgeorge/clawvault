import { afterEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createVault } from '../lib/vault.js';
import { entitiesCommand, entityCommand } from './entities.js';

const createdTempDirs: string[] = [];

function makeTempVault(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawvault-entities-cmd-'));
  createdTempDirs.push(dir);
  return dir;
}

function writeEntityFile(vaultPath: string, relativePath: string, content: string): void {
  const filePath = path.join(vaultPath, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
}

function collectLogs(logSpy: { mock: { calls: unknown[][] } }): string {
  return logSpy.mock.calls.map((call) => call.join(' ')).join('\n');
}

afterEach(() => {
  vi.restoreAllMocks();
  while (createdTempDirs.length > 0) {
    const dir = createdTempDirs.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('entitiesCommand', () => {
  it('prints JSON output mapping paths to aliases', async () => {
    const vaultPath = makeTempVault();
    writeEntityFile(
      vaultPath,
      'people/alice.md',
      `---
title: Alice Johnson
aliases:
  - AJ
---

# Alice
`
    );

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await entitiesCommand({ vaultPath, json: true });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(logSpy.mock.calls[0][0])) as Record<string, string[]>;
    expect(payload['people/alice']).toEqual(['alice', 'Alice Johnson', 'AJ']);
  });

  it('prints grouped markdown output by entity folder', async () => {
    const vaultPath = makeTempVault();
    writeEntityFile(
      vaultPath,
      'people/bob.md',
      `---
title: Bob
aliases:
  - Robert
---

# Bob
`
    );
    writeEntityFile(
      vaultPath,
      'projects/phoenix.md',
      `---
title: Project Phoenix
---

# Project Phoenix
`
    );

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await entitiesCommand({ vaultPath });

    const output = collectLogs(logSpy);
    expect(output).toContain('Linkable Entities');
    expect(output).toContain('## people/');
    expect(output).toContain('## projects/');
    expect(output).toContain('- bob (Robert)');
    expect(output).toContain('- phoenix (Project Phoenix)');
  });

  it('prints total entity and alias counts in markdown output', async () => {
    const vaultPath = makeTempVault();
    writeEntityFile(vaultPath, 'people/alice.md', '# Alice');
    writeEntityFile(vaultPath, 'agents/clawdious.md', '# Clawdious');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await entitiesCommand({ vaultPath });

    const output = collectLogs(logSpy);
    expect(output).toContain('Total: 2 entities');
    expect(output).toContain('linkable aliases');
  });

  it('handles empty vault folders without throwing', async () => {
    const vaultPath = makeTempVault();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await expect(entitiesCommand({ vaultPath })).resolves.toBeUndefined();

    const output = collectLogs(logSpy);
    expect(output).toContain('Linkable Entities');
    expect(output).toContain('Total: 0 entities, 0 linkable aliases');
  });

  it('resolves relative vault paths before indexing entities', async () => {
    const root = makeTempVault();
    const vaultPath = path.join(root, 'vault');
    fs.mkdirSync(vaultPath, { recursive: true });
    writeEntityFile(vaultPath, 'decisions/cache-policy.md', '# Cache Policy');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const relativeVaultPath = path.relative(process.cwd(), vaultPath);
    await entitiesCommand({ vaultPath: relativeVaultPath, json: true });

    const payload = JSON.parse(String(logSpy.mock.calls[0][0])) as Record<string, string[]>;
    expect(payload['decisions/cache-policy']).toEqual(['cache-policy']);
  });

  it('prints synthesized entity profile details in markdown mode', async () => {
    const vaultPath = makeTempVault();
    const vault = await createVault(vaultPath, { name: 'entity-command-md' }, { skipGraph: true, skipBases: true });
    await vault.store({
      category: 'people',
      title: 'Alice Johnson',
      content: '[[Alice Johnson]] works with [[Bob Lee]] on incident response.'
    });
    await vault.store({
      category: 'projects',
      title: 'Project Orion',
      content: '[[Project Orion]] is led by [[Alice Johnson]].'
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await entityCommand('Alice Johnson', { vaultPath });

    const output = collectLogs(logSpy);
    expect(output).toContain('Alice Johnson');
    expect(output).toContain('Relationships:');
    expect(output).toContain('Bob Lee');
  });

  it('prints synthesized entity profile as JSON', async () => {
    const vaultPath = makeTempVault();
    const vault = await createVault(vaultPath, { name: 'entity-command-json' }, { skipGraph: true, skipBases: true });
    await vault.store({
      category: 'people',
      title: 'Alice',
      content: '[[Alice]] works with [[Bob]].'
    });
    await vault.store({
      category: 'people',
      title: 'Bob',
      content: '[[Bob]] supports [[Alice]].'
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await entityCommand('alice', { vaultPath, json: true });

    const payload = JSON.parse(String(logSpy.mock.calls[0][0])) as {
      name: string;
      relationships: Array<{ target: string }>;
    };
    expect(payload.name.toLowerCase()).toContain('alice');
    expect(payload.relationships.length).toBeGreaterThan(0);
  });
});
