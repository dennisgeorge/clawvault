import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createVault } from '../lib/vault.js';
import { readEntityProfile, readEntityProfiles, synthesizeEntityProfiles } from './synthesis.js';

const tempDirs: string[] = [];

function makeTempVaultPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawvault-entities-synth-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('synthesizeEntityProfiles', () => {
  it('creates markdown profiles from wiki-link mentions', async () => {
    const vaultPath = makeTempVaultPath();
    const vault = await createVault(vaultPath, { name: 'entity-synth' }, { skipGraph: true, skipBases: true });

    await vault.store({
      category: 'projects',
      title: 'Project Aurora',
      content: '[[Alice Johnson]] launched [[Project Aurora]] with [[Bob Lee]].',
      frontmatter: { date: new Date().toISOString() }
    });
    await vault.store({
      category: 'people',
      title: 'Alice Johnson',
      content: '[[Alice Johnson]] works with [[Bob Lee]] on observability.',
      frontmatter: { date: new Date().toISOString() }
    });

    const profiles = await synthesizeEntityProfiles(vaultPath, { writeFiles: true });
    expect(profiles.length).toBeGreaterThanOrEqual(3);

    const entitiesDir = path.join(vaultPath, 'entities');
    expect(fs.existsSync(entitiesDir)).toBe(true);
    expect(fs.readdirSync(entitiesDir).some((file) => file.endsWith('.md'))).toBe(true);

    const alice = await readEntityProfile(vaultPath, 'Alice Johnson');
    expect(alice).toBeTruthy();
    expect(alice?.relationships.some((relationship) => relationship.target === 'Bob Lee')).toBe(true);
  });

  it('reads existing synthesized profiles', async () => {
    const vaultPath = makeTempVaultPath();
    const vault = await createVault(vaultPath, { name: 'entity-read' }, { skipGraph: true, skipBases: true });
    await vault.store({
      category: 'projects',
      title: 'Nova',
      content: '[[Nova]] depends on [[Gateway]] release sequencing.',
      frontmatter: { date: new Date().toISOString() }
    });

    await synthesizeEntityProfiles(vaultPath, { writeFiles: true });
    const profiles = readEntityProfiles(vaultPath);
    expect(profiles.length).toBeGreaterThan(0);
    expect(profiles.some((profile) => profile.name === 'Nova')).toBe(true);
  });
});

