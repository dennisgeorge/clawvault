import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const { hasQmdMock, scanVaultLinksMock, getObserverStalenessMock, listQmdCollectionsMock } = vi.hoisted(() => ({
  hasQmdMock: vi.fn(),
  scanVaultLinksMock: vi.fn(),
  getObserverStalenessMock: vi.fn(),
  listQmdCollectionsMock: vi.fn()
}));

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

vi.mock('../lib/search.js', async () => {
  const actual = await vi.importActual<typeof import('../lib/search.js')>('../lib/search.js');
  return {
    ...actual,
    hasQmd: hasQmdMock
  };
});

vi.mock('../lib/backlinks.js', () => ({
  scanVaultLinks: scanVaultLinksMock
}));

vi.mock('../observer/active-session-observer.js', () => ({
  getObserverStaleness: getObserverStalenessMock
}));

vi.mock('../lib/qmd-collections.js', () => ({
  listQmdCollections: listQmdCollectionsMock,
  removeQmdCollection: vi.fn()
}));

let mockQmdCollection = 'vault';
let mockQmdRoot = '/tmp/vault';

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

import { doctor } from './doctor.js';

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

function makeTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

const envSnapshot = {
  HOME: process.env.HOME,
  SHELL: process.env.SHELL
};

afterEach(() => {
  vi.clearAllMocks();
  process.env.HOME = envSnapshot.HOME;
  process.env.SHELL = envSnapshot.SHELL;
});

beforeEach(() => {
  getObserverStalenessMock.mockReturnValue({
    staleCount: 0,
    oldestMs: 0,
    newestMs: 0
  });
  listQmdCollectionsMock.mockReturnValue([]);
  mockQmdCollection = 'vault';
  mockQmdRoot = '/tmp/vault';
});

describe('doctor', () => {
  it('reports when qmd is unavailable', async () => {
    hasQmdMock.mockReturnValue(false);
    const report = await doctor('/tmp/vault');
    const qmdCheck = report.checks.find(check => check.label === 'qmd installed');
    expect(qmdCheck?.status).toBe('error');
    expect(report.errors).toBeGreaterThan(0);
  });

  it('warns on stale handoff/checkpoint and backlog', async () => {
    hasQmdMock.mockReturnValue(true);
    scanVaultLinksMock.mockReturnValue({
      backlinks: new Map(),
      orphans: Array.from({ length: 25 }, () => ({ source: 'a', target: 'b' })),
      linkCount: 30
    });

    const vaultPath = makeTempDir('clawvault-doctor-');
    const homePath = makeTempDir('clawvault-home-');
    const clawvaultDir = path.join(vaultPath, '.clawvault');
    fs.mkdirSync(clawvaultDir, { recursive: true });
    const checkpointTime = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    fs.writeFileSync(
      path.join(clawvaultDir, 'last-checkpoint.json'),
      JSON.stringify({ timestamp: checkpointTime }, null, 2)
    );

    process.env.HOME = homePath;
    process.env.SHELL = '/bin/bash';
    fs.writeFileSync(path.join(homePath, '.bashrc'), 'export CLAWVAULT_PATH="/tmp/vault"');

    mockStats = { documents: 10, categories: { inbox: 6 } };
    mockDocuments = [makeDoc('projects', new Date())];
    mockHandoffs = [makeDoc('handoffs', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000))];
    mockInbox = Array.from({ length: 6 }, () => makeDoc('inbox', new Date()));

    try {
      const report = await doctor(vaultPath);
      const warnings = report.checks.filter(check => check.status === 'warn').map(check => check.label);
      expect(warnings).toEqual(expect.arrayContaining([
        'recent handoff',
        'checkpoint freshness',
        'orphan links',
        'inbox backlog'
      ]));
    } finally {
      fs.rmSync(vaultPath, { recursive: true, force: true });
      fs.rmSync(homePath, { recursive: true, force: true });
    }
  });

  it('warns when observer cursors are stale', async () => {
    hasQmdMock.mockReturnValue(true);
    getObserverStalenessMock.mockReturnValue({
      staleCount: 3,
      oldestMs: 36 * 60 * 60 * 1000,
      newestMs: 13 * 60 * 60 * 1000
    });
    scanVaultLinksMock.mockReturnValue({
      backlinks: new Map(),
      orphans: [],
      linkCount: 0
    });

    const vaultPath = makeTempDir('clawvault-doctor-observer-');
    const homePath = makeTempDir('clawvault-home-observer-');
    process.env.HOME = homePath;
    process.env.SHELL = '/bin/bash';
    fs.writeFileSync(path.join(homePath, '.bashrc'), 'export CLAWVAULT_PATH="/tmp/vault"');

    mockStats = { documents: 10, categories: { inbox: 1 } };
    mockDocuments = [makeDoc('projects', new Date())];
    mockHandoffs = [makeDoc('handoffs', new Date())];
    mockInbox = [makeDoc('inbox', new Date())];

    try {
      const report = await doctor(vaultPath);
      const observerCheck = report.checks.find((check) => check.label === 'observer freshness');
      expect(observerCheck?.status).toBe('warn');
      expect(observerCheck?.detail).toContain('3 stale session cursor(s)');
    } finally {
      fs.rmSync(vaultPath, { recursive: true, force: true });
      fs.rmSync(homePath, { recursive: true, force: true });
    }
  });

  it('detects missing qmd collection as migration issue', async () => {
    hasQmdMock.mockReturnValue(true);
    listQmdCollectionsMock.mockReturnValue([]);
    scanVaultLinksMock.mockReturnValue({
      backlinks: new Map(),
      orphans: [],
      linkCount: 0
    });

    const vaultPath = makeTempDir('clawvault-doctor-migration-');
    const homePath = makeTempDir('clawvault-home-migration-');
    process.env.HOME = homePath;
    process.env.SHELL = '/bin/bash';
    fs.writeFileSync(path.join(homePath, '.bashrc'), 'export CLAWVAULT_PATH="/tmp/vault"');

    mockStats = { documents: 10, categories: {} };
    mockDocuments = [makeDoc('projects', new Date())];
    mockHandoffs = [makeDoc('handoffs', new Date())];
    mockInbox = [];
    mockQmdCollection = 'my-vault';
    mockQmdRoot = vaultPath;

    try {
      const report = await doctor(vaultPath);
      expect(report.migrationIssues.length).toBeGreaterThan(0);
      const missingCollection = report.migrationIssues.find(
        issue => issue.type === 'missing_qmd_collection'
      );
      expect(missingCollection).toBeDefined();
      expect(missingCollection?.autoFixable).toBe(true);
    } finally {
      fs.rmSync(vaultPath, { recursive: true, force: true });
      fs.rmSync(homePath, { recursive: true, force: true });
    }
  });

  it('detects stale v2 collection name as migration issue', async () => {
    hasQmdMock.mockReturnValue(true);
    const vaultPath = makeTempDir('clawvault-doctor-stale-');
    listQmdCollectionsMock.mockReturnValue([
      { name: 'clawvault', uri: 'qmd://clawvault', root: vaultPath, details: {} }
    ]);
    scanVaultLinksMock.mockReturnValue({
      backlinks: new Map(),
      orphans: [],
      linkCount: 0
    });

    const homePath = makeTempDir('clawvault-home-stale-');
    process.env.HOME = homePath;
    process.env.SHELL = '/bin/bash';
    fs.writeFileSync(path.join(homePath, '.bashrc'), 'export CLAWVAULT_PATH="/tmp/vault"');

    mockStats = { documents: 10, categories: {} };
    mockDocuments = [makeDoc('projects', new Date())];
    mockHandoffs = [makeDoc('handoffs', new Date())];
    mockInbox = [];
    mockQmdCollection = 'my-new-vault';
    mockQmdRoot = vaultPath;

    try {
      const report = await doctor(vaultPath);
      const staleCollection = report.migrationIssues.find(
        issue => issue.type === 'stale_collection_name'
      );
      expect(staleCollection).toBeDefined();
      expect(staleCollection?.autoFixable).toBe(true);
      expect(staleCollection?.details).toMatchObject({
        oldName: 'clawvault',
        newName: 'my-new-vault'
      });
    } finally {
      fs.rmSync(vaultPath, { recursive: true, force: true });
      fs.rmSync(homePath, { recursive: true, force: true });
    }
  });

  it('detects wrong vault path as migration issue', async () => {
    hasQmdMock.mockReturnValue(true);
    const vaultPath = makeTempDir('clawvault-doctor-wrongpath-');
    const wrongPath = '/some/other/path';
    listQmdCollectionsMock.mockReturnValue([
      { name: 'my-vault', uri: 'qmd://my-vault', root: wrongPath, details: {} }
    ]);
    scanVaultLinksMock.mockReturnValue({
      backlinks: new Map(),
      orphans: [],
      linkCount: 0
    });

    const homePath = makeTempDir('clawvault-home-wrongpath-');
    process.env.HOME = homePath;
    process.env.SHELL = '/bin/bash';
    fs.writeFileSync(path.join(homePath, '.bashrc'), 'export CLAWVAULT_PATH="/tmp/vault"');

    mockStats = { documents: 10, categories: {} };
    mockDocuments = [makeDoc('projects', new Date())];
    mockHandoffs = [makeDoc('handoffs', new Date())];
    mockInbox = [];
    mockQmdCollection = 'my-vault';
    mockQmdRoot = vaultPath;

    try {
      const report = await doctor(vaultPath);
      const wrongPathIssue = report.migrationIssues.find(
        issue => issue.type === 'wrong_vault_path'
      );
      expect(wrongPathIssue).toBeDefined();
      expect(wrongPathIssue?.autoFixable).toBe(true);
    } finally {
      fs.rmSync(vaultPath, { recursive: true, force: true });
      fs.rmSync(homePath, { recursive: true, force: true });
    }
  });

  it('includes actionable hint for qmd not installed', async () => {
    hasQmdMock.mockReturnValue(false);
    const report = await doctor('/tmp/vault');
    const qmdCheck = report.checks.find(check => check.label === 'qmd installed');
    expect(qmdCheck?.hint).toContain('bun install');
    expect(qmdCheck?.hint).toContain('github.com/tobi/qmd');
  });
});
