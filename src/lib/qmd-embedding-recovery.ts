import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { getCollectionByName, type QmdCollectionInfo } from './qmd-collections.js';
import { withQmdIndexArgs } from './search.js';

const CLAWVAULT_DIR = '.clawvault';
const QMD_EMBED_WAL_FILE = 'qmd-embed.wal.json';
const WALK_SKIP_DIRS = new Set(['.git', '.obsidian', '.trash', '.clawvault', 'node_modules']);

export interface QmdEmbedWalRecord {
  version: 1;
  status: 'running';
  startedAt: string;
  collection: string;
  rootPath: string;
  indexName?: string;
}

export type QmdEmbeddingRecoveryMode = 'marker-only' | 'marker-or-empty';

export interface RecoverQmdEmbeddingOptions {
  vaultPath: string;
  collection: string;
  rootPath: string;
  indexName?: string;
  mode?: QmdEmbeddingRecoveryMode;
  onLog?: (message: string) => void;
}

export interface RecoverQmdEmbeddingResult {
  recovered: boolean;
  reason?: 'interrupted_wal' | 'empty_vectors';
}

export interface RunCrashSafeQmdEmbedOptions {
  vaultPath: string;
  collection: string;
  rootPath: string;
  indexName?: string;
}

function getQmdEmbedWalPath(vaultPath: string): string {
  return path.join(vaultPath, CLAWVAULT_DIR, QMD_EMBED_WAL_FILE);
}

function writeJsonAtomic(filePath: string, value: unknown): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = path.join(
    dir,
    `${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`
  );
  try {
    fs.writeFileSync(tmpPath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
    fs.renameSync(tmpPath, filePath);
  } finally {
    if (fs.existsSync(tmpPath)) {
      fs.rmSync(tmpPath, { force: true });
    }
  }
}

function runQmdCommand(args: string[], indexName?: string): void {
  execFileSync('qmd', withQmdIndexArgs(args, indexName), { stdio: 'inherit', shell: process.platform === 'win32' });
}

function runQmdEmbedForce(collection: string, indexName?: string): void {
  try {
    runQmdCommand(['embed', '-f', '-c', collection], indexName);
  } catch {
    // Older qmd builds may not support -f; retry without force.
    runQmdCommand(['embed', '-c', collection], indexName);
  }
}

function countMarkdownFiles(rootPath: string): number {
  let total = 0;
  const stack: string[] = [rootPath];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.') || WALK_SKIP_DIRS.has(entry.name)) {
          continue;
        }
        stack.push(entryPath);
        continue;
      }

      if (entry.isFile() && entry.name.endsWith('.md') && !entry.name.startsWith('.')) {
        total += 1;
      }
    }
  }

  return total;
}

function shouldRecoverEmptyVectors(
  collectionInfo: QmdCollectionInfo | undefined,
  markdownCount: number
): boolean {
  if (!collectionInfo) return false;
  if (markdownCount === 0) return false;

  if (collectionInfo.vectors === undefined) return false;
  if (collectionInfo.vectors > 0) return false;

  if (collectionInfo.pendingEmbeddings !== undefined && collectionInfo.pendingEmbeddings > 0) {
    return false;
  }

  // vectors === 0 with local markdown files and no pending work hints
  // strongly suggests interrupted/corrupted embedding state.
  return true;
}

function hasWalMarker(vaultPath: string): boolean {
  return fs.existsSync(getQmdEmbedWalPath(vaultPath));
}

export function readQmdEmbedWalRecord(vaultPath: string): QmdEmbedWalRecord | null {
  const walPath = getQmdEmbedWalPath(vaultPath);
  if (!fs.existsSync(walPath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(walPath, 'utf-8')) as Partial<QmdEmbedWalRecord>;
    if (
      parsed.version !== 1
      || parsed.status !== 'running'
      || typeof parsed.startedAt !== 'string'
      || typeof parsed.collection !== 'string'
      || typeof parsed.rootPath !== 'string'
    ) {
      return null;
    }
    return {
      version: 1,
      status: 'running',
      startedAt: parsed.startedAt,
      collection: parsed.collection,
      rootPath: parsed.rootPath,
      indexName: typeof parsed.indexName === 'string' ? parsed.indexName : undefined
    };
  } catch {
    return null;
  }
}

export function clearQmdEmbedWalRecord(vaultPath: string): void {
  const walPath = getQmdEmbedWalPath(vaultPath);
  if (fs.existsSync(walPath)) {
    fs.rmSync(walPath, { force: true });
  }
}

function writeQmdEmbedWalRecord(options: RunCrashSafeQmdEmbedOptions): void {
  const wal: QmdEmbedWalRecord = {
    version: 1,
    status: 'running',
    startedAt: new Date().toISOString(),
    collection: options.collection,
    rootPath: options.rootPath,
    indexName: options.indexName
  };
  writeJsonAtomic(getQmdEmbedWalPath(options.vaultPath), wal);
}

export function runCrashSafeQmdEmbed(options: RunCrashSafeQmdEmbedOptions): void {
  writeQmdEmbedWalRecord(options);
  try {
    runQmdCommand(['embed', '-c', options.collection], options.indexName);
    clearQmdEmbedWalRecord(options.vaultPath);
  } catch (err) {
    // Keep WAL marker for automatic recovery on next startup.
    throw err;
  }
}

export function recoverQmdEmbeddingIfNeeded(
  options: RecoverQmdEmbeddingOptions
): RecoverQmdEmbeddingResult {
  const mode = options.mode ?? 'marker-or-empty';

  let reason: RecoverQmdEmbeddingResult['reason'];
  if (hasWalMarker(options.vaultPath)) {
    reason = 'interrupted_wal';
  } else if (mode === 'marker-or-empty') {
    const collectionInfo = getCollectionByName(options.collection, options.indexName);
    const markdownCount = countMarkdownFiles(options.rootPath);
    if (shouldRecoverEmptyVectors(collectionInfo, markdownCount)) {
      reason = 'empty_vectors';
    }
  }

  if (!reason) {
    return { recovered: false };
  }

  options.onLog?.(
    reason === 'interrupted_wal'
      ? `Detected interrupted qmd embedding run for "${options.collection}". Rebuilding...`
      : `Detected empty qmd vector state for "${options.collection}". Rebuilding...`
  );

  runQmdCommand(['update', '-c', options.collection], options.indexName);
  runQmdEmbedForce(options.collection, options.indexName);
  clearQmdEmbedWalRecord(options.vaultPath);
  return { recovered: true, reason };
}
