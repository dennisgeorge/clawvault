import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const {
  hasQmdMock,
  listQmdCollectionsMock,
  removeQmdCollectionMock,
  execFileSyncMock,
  scanVaultLinksMock,
  getObserverStalenessMock,
  spawnSyncMock
} = vi.hoisted(() => ({
  hasQmdMock: vi.fn(),
  listQmdCollectionsMock: vi.fn(),
  removeQmdCollectionMock: vi.fn(),
  execFileSyncMock: vi.fn(),
  scanVaultLinksMock: vi.fn(),
  getObserverStalenessMock: vi.fn(),
  spawnSyncMock: vi.fn()
}));

vi.mock('../lib/search.js', async () => {
  const actual = await vi.importActual<typeof import('../lib/search.js')>('../lib/search.js');
  return {
    ...actual,
    hasQmd: hasQmdMock
  };
});

vi.mock('../lib/qmd-collections.js', () => ({
  listQmdCollections: listQmdCollectionsMock,
  removeQmdCollection: removeQmdCollectionMock,
  findCollectionByRoot: vi.fn().mockReturnValue(undefined),
  collectionExists: vi.fn().mockReturnValue(true),
  getFirstCollection: vi.fn().mockReturnValue(undefined)
}));

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    execFileSync: execFileSyncMock,
    spawnSync: spawnSyncMock
  };
});

vi.mock('../lib/backlinks.js', () => ({
  scanVaultLinks: scanVaultLinksMock
}));

vi.mock('../observer/active-session-observer.js', () => ({
  getObserverStaleness: getObserverStalenessMock
}));

let mockQmdCollection = 'vault';
let mockQmdRoot = '/tmp/vault';
let mockStats = { documents: 0, categories: {} as Record<string, number> };
let mockDocuments: Array<{
  id: string;
  path: string;
  category: string;
  title: string;
  content: string;
  frontmatter: Record<string, unknown>;
  links: string[];
  tags: string[];
  modified: Date;
}> = [];
let mockHandoffs: typeof mockDocuments = [];
let mockInbox: typeof mockDocuments = [];

vi.mock('../lib/vault.js', () => ({
  ClawVault: class {
    private vaultPath: string;

    constructor(vaultPath: string) {
      this.vaultPath = vaultPath;
    }

    async load(): Promise<void> {
      return;
    }

    async stats(): Promise<{ documents: number; categories: Record<string, number> }> {
      return mockStats;
    }

    async list(category?: string) {
      if (category === 'handoffs') return mockHandoffs;
      if (category === 'inbox') return mockInbox;
      if (category) return [];
      return mockDocuments;
    }

    getPath(): string {
      return this.vaultPath;
    }

    getQmdCollection(): string {
      return mockQmdCollection;
    }

    getQmdRoot(): string {
      return mockQmdRoot;
    }
  },
  findVault: async () => null
}));

import { migrate } from './migrate.js';

function makeTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function makeDoc(category: string, modified: Date) {
  return {
    id: `${category}/doc`,
    path: `/tmp/${category}/doc.md`,
    category,
    title: 'doc',
    content: '',
    frontmatter: {},
    links: [],
    tags: [],
    modified
  };
}

const envSnapshot = {
  HOME: process.env.HOME,
  SHELL: process.env.SHELL,
  CLAWVAULT_PATH: process.env.CLAWVAULT_PATH
};

afterEach(() => {
  vi.clearAllMocks();
  process.env.HOME = envSnapshot.HOME;
  process.env.SHELL = envSnapshot.SHELL;
  process.env.CLAWVAULT_PATH = envSnapshot.CLAWVAULT_PATH;
});

beforeEach(() => {
  hasQmdMock.mockReturnValue(true);
  listQmdCollectionsMock.mockReturnValue([]);
  scanVaultLinksMock.mockReturnValue({
    backlinks: new Map(),
    orphans: [],
    linkCount: 0
  });
  getObserverStalenessMock.mockReturnValue({
    staleCount: 0,
    oldestMs: 0,
    newestMs: 0
  });
  spawnSyncMock.mockReturnValue({ status: 0, error: null });
  mockStats = { documents: 10, categories: {} };
  mockDocuments = [makeDoc('projects', new Date())];
  mockHandoffs = [makeDoc('handoffs', new Date())];
  mockInbox = [];
});

describe('migrate', () => {
  it('reports no issues when vault is properly configured', async () => {
    const vaultPath = makeTempDir('clawvault-migrate-ok-');
    const homePath = makeTempDir('clawvault-home-ok-');
    process.env.HOME = homePath;
    process.env.SHELL = '/bin/bash';
    fs.writeFileSync(path.join(homePath, '.bashrc'), 'export CLAWVAULT_PATH="/tmp/vault"');

    mockQmdCollection = 'my-vault';
    mockQmdRoot = vaultPath;

    listQmdCollectionsMock.mockReturnValue([
      { name: 'my-vault', uri: 'qmd://my-vault', root: vaultPath, details: {} }
    ]);

    try {
      const result = await migrate({ vaultPath });
      expect(result.issuesFound).toBe(0);
      expect(result.actions).toHaveLength(0);
    } finally {
      fs.rmSync(vaultPath, { recursive: true, force: true });
      fs.rmSync(homePath, { recursive: true, force: true });
    }
  });

  it('returns error when qmd is not installed', async () => {
    hasQmdMock.mockReturnValue(false);
    const vaultPath = makeTempDir('clawvault-migrate-noqmd-');
    process.env.CLAWVAULT_PATH = vaultPath;

    try {
      const result = await migrate({ vaultPath });
      expect(result.issuesFound).toBe(1);
      expect(result.issuesFixed).toBe(0);
      expect(result.actions[0].error).toContain('Install qmd');
    } finally {
      fs.rmSync(vaultPath, { recursive: true, force: true });
    }
  });

  it('fixes missing qmd collection in dry run mode', async () => {
    const vaultPath = makeTempDir('clawvault-migrate-missing-');
    const homePath = makeTempDir('clawvault-home-missing-');
    process.env.HOME = homePath;
    process.env.SHELL = '/bin/bash';
    fs.writeFileSync(path.join(homePath, '.bashrc'), 'export CLAWVAULT_PATH="/tmp/vault"');

    mockQmdCollection = 'my-vault';
    mockQmdRoot = vaultPath;
    listQmdCollectionsMock.mockReturnValue([]);

    try {
      const result = await migrate({ vaultPath, dryRun: true });
      expect(result.issuesFound).toBeGreaterThan(0);
      expect(result.dryRun).toBe(true);
      
      const createAction = result.actions.find(a => a.type === 'missing_qmd_collection');
      expect(createAction).toBeDefined();
      expect(createAction?.success).toBe(true);
      expect(createAction?.description).toContain('dry run');
      
      expect(execFileSyncMock).not.toHaveBeenCalled();
    } finally {
      fs.rmSync(vaultPath, { recursive: true, force: true });
      fs.rmSync(homePath, { recursive: true, force: true });
    }
  });

  it('creates missing qmd collection when not in dry run', async () => {
    const vaultPath = makeTempDir('clawvault-migrate-create-');
    const homePath = makeTempDir('clawvault-home-create-');
    process.env.HOME = homePath;
    process.env.SHELL = '/bin/bash';
    fs.writeFileSync(path.join(homePath, '.bashrc'), 'export CLAWVAULT_PATH="/tmp/vault"');

    mockQmdCollection = 'my-vault';
    mockQmdRoot = vaultPath;
    listQmdCollectionsMock.mockReturnValue([]);

    try {
      const result = await migrate({ vaultPath, dryRun: false });
      expect(result.issuesFound).toBeGreaterThan(0);
      
      const createAction = result.actions.find(a => a.type === 'missing_qmd_collection');
      expect(createAction).toBeDefined();
      expect(createAction?.success).toBe(true);
      
      expect(execFileSyncMock).toHaveBeenCalledWith(
        'qmd',
        ['collection', 'add', 'my-vault', vaultPath],
        expect.any(Object)
      );
    } finally {
      fs.rmSync(vaultPath, { recursive: true, force: true });
      fs.rmSync(homePath, { recursive: true, force: true });
    }
  });

  it('renames stale v2 collection to new name', async () => {
    const vaultPath = makeTempDir('clawvault-migrate-rename-');
    const homePath = makeTempDir('clawvault-home-rename-');
    process.env.HOME = homePath;
    process.env.SHELL = '/bin/bash';
    fs.writeFileSync(path.join(homePath, '.bashrc'), 'export CLAWVAULT_PATH="/tmp/vault"');

    mockQmdCollection = 'my-new-vault';
    mockQmdRoot = vaultPath;
    listQmdCollectionsMock.mockReturnValue([
      { name: 'clawvault', uri: 'qmd://clawvault', root: vaultPath, details: {} }
    ]);

    try {
      const result = await migrate({ vaultPath, dryRun: false });
      
      const renameAction = result.actions.find(a => a.type === 'stale_collection_name');
      expect(renameAction).toBeDefined();
      expect(renameAction?.success).toBe(true);
      
      expect(removeQmdCollectionMock).toHaveBeenCalledWith('clawvault');
      expect(execFileSyncMock).toHaveBeenCalledWith(
        'qmd',
        ['collection', 'add', 'my-new-vault', vaultPath],
        expect.any(Object)
      );
    } finally {
      fs.rmSync(vaultPath, { recursive: true, force: true });
      fs.rmSync(homePath, { recursive: true, force: true });
    }
  });

  it('fixes wrong vault path by recreating collection', async () => {
    const vaultPath = makeTempDir('clawvault-migrate-wrongpath-');
    const homePath = makeTempDir('clawvault-home-wrongpath-');
    const wrongPath = '/some/wrong/path';
    process.env.HOME = homePath;
    process.env.SHELL = '/bin/bash';
    fs.writeFileSync(path.join(homePath, '.bashrc'), 'export CLAWVAULT_PATH="/tmp/vault"');

    mockQmdCollection = 'my-vault';
    mockQmdRoot = vaultPath;
    listQmdCollectionsMock.mockReturnValue([
      { name: 'my-vault', uri: 'qmd://my-vault', root: wrongPath, details: {} }
    ]);

    try {
      const result = await migrate({ vaultPath, dryRun: false });
      
      const pathAction = result.actions.find(a => a.type === 'wrong_vault_path');
      expect(pathAction).toBeDefined();
      expect(pathAction?.success).toBe(true);
      
      expect(removeQmdCollectionMock).toHaveBeenCalledWith('my-vault');
      expect(execFileSyncMock).toHaveBeenCalledWith(
        'qmd',
        ['collection', 'add', 'my-vault', vaultPath],
        expect.any(Object)
      );
    } finally {
      fs.rmSync(vaultPath, { recursive: true, force: true });
      fs.rmSync(homePath, { recursive: true, force: true });
    }
  });

  it('removes orphaned collections pointing to vault path', async () => {
    const vaultPath = makeTempDir('clawvault-migrate-orphan-');
    const homePath = makeTempDir('clawvault-home-orphan-');
    process.env.HOME = homePath;
    process.env.SHELL = '/bin/bash';
    fs.writeFileSync(path.join(homePath, '.bashrc'), 'export CLAWVAULT_PATH="/tmp/vault"');

    mockQmdCollection = 'my-vault';
    mockQmdRoot = vaultPath;
    listQmdCollectionsMock.mockReturnValue([
      { name: 'my-vault', uri: 'qmd://my-vault', root: vaultPath, details: {} },
      { name: 'old-vault', uri: 'qmd://old-vault', root: vaultPath, details: {} }
    ]);

    try {
      const result = await migrate({ vaultPath, dryRun: false });
      
      const orphanAction = result.actions.find(a => a.type === 'orphaned_collection');
      expect(orphanAction).toBeDefined();
      expect(orphanAction?.success).toBe(true);
      
      expect(removeQmdCollectionMock).toHaveBeenCalledWith('old-vault');
    } finally {
      fs.rmSync(vaultPath, { recursive: true, force: true });
      fs.rmSync(homePath, { recursive: true, force: true });
    }
  });

  it('updates vault config with missing qmd settings', async () => {
    const vaultPath = makeTempDir('clawvault-migrate-config-');
    const homePath = makeTempDir('clawvault-home-config-');
    process.env.HOME = homePath;
    process.env.SHELL = '/bin/bash';
    fs.writeFileSync(path.join(homePath, '.bashrc'), 'export CLAWVAULT_PATH="/tmp/vault"');

    fs.writeFileSync(
      path.join(vaultPath, '.clawvault.json'),
      JSON.stringify({ name: 'my-vault', version: '1.0.0' }, null, 2)
    );

    mockQmdCollection = 'my-vault';
    mockQmdRoot = vaultPath;
    listQmdCollectionsMock.mockReturnValue([
      { name: 'my-vault', uri: 'qmd://my-vault', root: vaultPath, details: {} }
    ]);

    try {
      const result = await migrate({ vaultPath, dryRun: false });
      
      const configAction = result.actions.find(a => a.type === 'missing_qmd_config');
      expect(configAction).toBeDefined();
      expect(configAction?.success).toBe(true);
      
      const updatedConfig = JSON.parse(
        fs.readFileSync(path.join(vaultPath, '.clawvault.json'), 'utf-8')
      );
      expect(updatedConfig.qmdCollection).toBeDefined();
      expect(updatedConfig.qmdRoot).toBeDefined();
    } finally {
      fs.rmSync(vaultPath, { recursive: true, force: true });
      fs.rmSync(homePath, { recursive: true, force: true });
    }
  });
});
