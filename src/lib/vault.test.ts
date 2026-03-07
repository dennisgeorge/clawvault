import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const {
  hasQmdMock,
  qmdUpdateMock,
  qmdEmbedMock,
  buildGraphMock,
  loadVaultQmdConfigMock,
} = vi.hoisted(() => ({
  hasQmdMock: vi.fn(),
  qmdUpdateMock: vi.fn(),
  qmdEmbedMock: vi.fn(),
  buildGraphMock: vi.fn(),
  loadVaultQmdConfigMock: vi.fn(),
}));

vi.mock('./search.js', async () => {
  const actual = await vi.importActual<typeof import('./search.js')>('./search.js');
  return {
    ...actual,
    hasQmd: hasQmdMock,
    qmdUpdate: qmdUpdateMock,
    qmdEmbed: qmdEmbedMock,
  };
});

vi.mock('./memory-graph.js', async () => {
  const actual = await vi.importActual<typeof import('./memory-graph.js')>('./memory-graph.js');
  return {
    ...actual,
    buildOrUpdateMemoryGraphIndex: buildGraphMock,
  };
});

vi.mock('./vault-qmd-config.js', () => ({
  loadVaultQmdConfig: loadVaultQmdConfigMock,
}));

import { ClawVault, createVault, findVault } from './vault.js';
import { QmdUnavailableError } from './search.js';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'clawvault-vault-core-'));
}

describe('vault core', () => {
  let tempDir: string;
  let consoleErrorSpy: MockInstance<[message?: any, ...optionalParams: any[]], void>;
  let consoleWarnSpy: MockInstance<[message?: any, ...optionalParams: any[]], void>;

  beforeEach(() => {
    tempDir = makeTempDir();
    hasQmdMock.mockReturnValue(true);
    buildGraphMock.mockResolvedValue(undefined);
    loadVaultQmdConfigMock.mockImplementation((vaultPath: string) => {
      const resolved = path.resolve(vaultPath);
      return {
        vaultPath: resolved,
        qmdCollection: path.basename(resolved),
        qmdRoot: resolved,
        autoDetected: false,
      };
    });
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    vi.clearAllMocks();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('throws when qmd is unavailable', () => {
    hasQmdMock.mockReturnValue(false);
    expect(() => new ClawVault(tempDir)).toThrow(QmdUnavailableError);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('initializes a vault with skip flags and writes key bootstrap files', async () => {
    const vault = await createVault(
      tempDir,
      { name: 'My Vault' },
      { skipTasks: true, skipBases: true, skipGraph: true }
    );

    expect(vault.isInitialized()).toBe(true);
    expect(vault.getName()).toBe('My Vault');
    expect(vault.getPath()).toBe(path.resolve(tempDir));
    expect(vault.getCategories()).not.toContain('tasks');
    expect(vault.getCategories()).not.toContain('backlog');
    expect(fs.existsSync(path.join(tempDir, 'tasks'))).toBe(false);
    expect(fs.existsSync(path.join(tempDir, 'README.md'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'inbox', 'welcome.md'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'templates'))).toBe(true);
    expect(buildGraphMock).not.toHaveBeenCalled();

    const config = JSON.parse(fs.readFileSync(path.join(tempDir, '.clawvault.json'), 'utf-8')) as {
      name: string;
      categories: string[];
    };
    expect(config.name).toBe('My Vault');
    expect(config.categories).not.toContain('tasks');
  });

  it('stores, captures, remembers, and returns document stats', async () => {
    const vault = await createVault(tempDir, { name: 'Ops Vault' }, { skipGraph: true, skipBases: true });

    const decision = await vault.store({
      category: 'decisions',
      title: 'Use API',
      content: 'Link [[people/alice]] #design',
    });
    expect(decision.id).toBe('decisions/use-api');
    expect(await vault.get('decisions/use-api')).not.toBeNull();

    await expect(
      vault.store({
        category: 'decisions',
        title: 'Use API',
        content: 'Duplicate',
      })
    ).rejects.toThrow('Document already exists');

    const captured = await vault.capture('Quick note');
    expect(captured.category).toBe('inbox');
    expect(captured.id.startsWith('inbox/note-')).toBe(true);

    const remembered = await vault.remember('lesson', 'Cache lesson', 'Use TTL');
    expect(remembered.category).toBe('lessons');
    expect(remembered.frontmatter.memoryType).toBe('lesson');

    const stats = await vault.stats();
    expect(stats.documents).toBeGreaterThanOrEqual(3);
    expect(stats.categories.decisions).toBe(1);
    expect(stats.links).toBeGreaterThanOrEqual(1);
    expect(stats.tags).toContain('design');
  });

  it('triggers qmd update/embed when requested during store', async () => {
    const vault = await createVault(tempDir, { name: 'Qmd Trigger Vault' }, { skipGraph: true, skipBases: true });

    await vault.store({
      category: 'inbox',
      title: 'Trigger qmd',
      content: 'trigger',
      qmdUpdate: true,
      qmdEmbed: true,
      qmdIndexName: 'secondary-index',
    });

    expect(qmdUpdateMock).toHaveBeenCalledWith(vault.getQmdCollection(), 'secondary-index');
    expect(qmdEmbedMock).toHaveBeenCalledWith(vault.getQmdCollection(), 'secondary-index');
  });

  it('syncs files with dry-run and orphan deletion support', async () => {
    const vault = await createVault(tempDir, { name: 'Sync Vault' }, { skipGraph: true, skipBases: true });
    await vault.store({
      category: 'decisions',
      title: 'Sync this',
      content: 'body',
    });

    const target = path.join(tempDir, 'sync-target');
    const dryRun = await vault.sync({ target, dryRun: true });
    expect(dryRun.copied).toContain('decisions/sync-this.md');
    expect(fs.existsSync(target)).toBe(false);

    const realSync = await vault.sync({ target });
    expect(realSync.copied).toContain('decisions/sync-this.md');
    expect(fs.existsSync(path.join(target, 'decisions', 'sync-this.md'))).toBe(true);

    fs.writeFileSync(path.join(target, 'orphan.md'), '# orphan\n', 'utf-8');
    const withDeletion = await vault.sync({ target, deleteOrphans: true });
    expect(withDeletion.deleted).toContain('orphan.md');
    expect(fs.existsSync(path.join(target, 'orphan.md'))).toBe(false);
  });

  it('creates handoffs and generates/formats a recap', async () => {
    const vault = await createVault(tempDir, { name: 'Recap Vault' }, { skipGraph: true, skipBases: true });

    await vault.store({
      category: 'projects',
      title: 'Project Alpha',
      content: 'ship it',
      frontmatter: { status: 'active' },
    });
    await vault.store({
      category: 'commitments',
      title: 'Follow up with client',
      content: 'pending',
      frontmatter: { status: 'open' },
    });
    await vault.store({
      category: 'decisions',
      title: 'Adopt queue',
      content: 'reasoning',
    });
    await vault.store({
      category: 'lessons',
      title: 'Retries need jitter',
      content: 'lesson details',
    });
    await vault.store({
      category: 'people',
      title: 'Alice',
      content: 'contact',
      frontmatter: { role: 'Staff Engineer' },
    });

    const handoff = await vault.createHandoff({
      sessionKey: 'agent:core:main',
      workingOn: ['recap testing'],
      blocked: [],
      nextSteps: ['ship tests'],
      decisions: ['Keep markdown schema'],
      openQuestions: ['Need migration?'],
      feeling: 'focused',
    });
    expect(handoff.category).toBe('handoffs');

    const recap = await vault.generateRecap({ handoffLimit: 3 });
    expect(recap.recentHandoffs.length).toBeGreaterThanOrEqual(1);
    expect(recap.activeProjects).toContain('Project Alpha');
    expect(recap.pendingCommitments).toContain('Follow up with client');
    expect(recap.recentDecisions).toContain('Adopt queue');
    expect(recap.recentLessons).toContain('Retries need jitter');
    expect(recap.keyRelationships.some((entry) => entry.includes('Alice'))).toBe(true);
    expect(recap.emotionalArc).toContain('focused');

    const formatted = vault.formatRecap(recap, { brief: true });
    expect(formatted).toContain('# Who I Was');
    expect(formatted).toContain('## Recent Sessions');
    expect(formatted).toContain('## Active Projects');
  });

  it('finds the nearest vault and loads it', async () => {
    const vault = await createVault(tempDir, { name: 'Finder Vault' }, { skipGraph: true, skipBases: true });
    expect(vault.isInitialized()).toBe(true);

    const nested = path.join(tempDir, 'a', 'b', 'c');
    fs.mkdirSync(nested, { recursive: true });

    const found = await findVault(nested);
    expect(found).not.toBeNull();
    expect(found?.getPath()).toBe(path.resolve(tempDir));
    expect(found?.isInitialized()).toBe(true);

    const emptyDir = makeTempDir();
    try {
      const missing = await findVault(emptyDir);
      expect(missing).toBeNull();
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  });
});
