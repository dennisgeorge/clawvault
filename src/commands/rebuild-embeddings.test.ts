import { afterEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const { embedMock } = vi.hoisted(() => ({
  embedMock: vi.fn()
}));

vi.mock('../lib/hybrid-search.js', async () => {
  const actual = await vi.importActual<typeof import('../lib/hybrid-search.js')>('../lib/hybrid-search.js');
  return {
    ...actual,
    embed: embedMock
  };
});

import { rebuildEmbeddingsCommand, rebuildEmbeddingsForVault } from './rebuild-embeddings.js';

const createdTempDirs: string[] = [];

function makeTempVault(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawvault-rebuild-embeddings-'));
  createdTempDirs.push(dir);
  return dir;
}

function writeMarkdown(vaultPath: string, relativePath: string, content: string): void {
  const filePath = path.join(vaultPath, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
}

function writeCache(vaultPath: string, data: Record<string, number[]>): void {
  const cacheBinPath = path.join(vaultPath, '.clawvault', 'embeddings.bin');
  const cachePath = path.join(vaultPath, '.clawvault', 'embeddings.bin.json');
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cacheBinPath, '', 'utf-8');
  fs.writeFileSync(cachePath, JSON.stringify(data), 'utf-8');
}

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  while (createdTempDirs.length > 0) {
    const dir = createdTempDirs.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('rebuildEmbeddingsForVault', () => {
  it('embeds markdown files and skips short documents', async () => {
    embedMock.mockResolvedValue(new Float32Array([0.1, 0.2, 0.3]));
    const vaultPath = makeTempVault();

    writeMarkdown(vaultPath, 'notes/long.md', 'This markdown document has enough content to be embedded.');
    writeMarkdown(vaultPath, 'notes/short.md', 'tiny note');
    writeMarkdown(vaultPath, '.hidden.md', 'This should be ignored by the walker.');
    writeMarkdown(vaultPath, 'node_modules/pkg/readme.md', 'This should be ignored by node_modules filter.');

    const result = await rebuildEmbeddingsForVault(vaultPath);

    expect(embedMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      total: 1,
      added: 1,
      skipped: 1
    });
    expect(fs.existsSync(path.join(vaultPath, '.clawvault', 'embeddings.bin.json'))).toBe(true);
  });

  it('skips documents already present in cache when force is false', async () => {
    const vaultPath = makeTempVault();
    writeMarkdown(vaultPath, 'docs/cached.md', 'This cached document should not be re-embedded.');
    writeCache(vaultPath, { 'docs/cached': [0.25, 0.5, 0.75] });

    const result = await rebuildEmbeddingsForVault(vaultPath, { force: false });

    expect(embedMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      total: 1,
      added: 0,
      skipped: 1
    });
  });

  it('recomputes embeddings when force is enabled', async () => {
    embedMock.mockResolvedValue(new Float32Array([1, 2, 3]));
    const vaultPath = makeTempVault();
    writeMarkdown(vaultPath, 'docs/cached.md', 'This cached document should be recomputed with force mode.');
    writeCache(vaultPath, { 'docs/cached': [0.25, 0.5, 0.75] });

    const result = await rebuildEmbeddingsForVault(vaultPath, { force: true });

    expect(embedMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      total: 1,
      added: 1,
      skipped: 0
    });
  });

  it('emits progress callbacks for each scanned markdown file', async () => {
    embedMock.mockResolvedValue(new Float32Array([0.5]));
    const vaultPath = makeTempVault();
    writeMarkdown(vaultPath, 'docs/a.md', 'This document is long enough to embed (A).');
    writeMarkdown(vaultPath, 'docs/b.md', 'This document is long enough to embed (B).');
    writeMarkdown(vaultPath, 'docs/c.md', 'short');

    const progress = vi.fn<[number, number], void>();
    const result = await rebuildEmbeddingsForVault(vaultPath, { onProgress: progress });

    expect(result.added).toBe(2);
    expect(result.skipped).toBe(1);
    expect(progress).toHaveBeenCalledTimes(3);
    expect(progress).toHaveBeenLastCalledWith(3, 3);
  });
});

describe('rebuildEmbeddingsCommand', () => {
  it('prints progress and completion output in non-quiet mode', async () => {
    embedMock.mockResolvedValue(new Float32Array([0.2, 0.4, 0.6]));
    const vaultPath = makeTempVault();
    writeMarkdown(vaultPath, 'notes/long.md', 'A long markdown document to trigger embedding progress output.');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation((() => true) as typeof process.stdout.write);

    const result = await rebuildEmbeddingsCommand({ vaultPath });

    expect(result.added).toBe(1);
    expect(result.total).toBe(1);
    expect(logSpy).toHaveBeenCalledWith(`Rebuilding embedding cache for vault: ${path.resolve(vaultPath)}`);
    expect(
      logSpy.mock.calls.some((call) => String(call[0]).includes('Done. 1 embeddings (1 new, 0 cached)'))
    ).toBe(true);
    expect(
      writeSpy.mock.calls.some((call) => String(call[0]).includes('Embedding 1/1 documents...'))
    ).toBe(true);
  });
});
