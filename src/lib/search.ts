/**
 * ClawVault Search Engine - qmd Backend
 * Uses qmd CLI for BM25 and vector search
 */

import { execFileSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { Document, SearchResult, SearchOptions } from '../types.js';

export const QMD_INSTALL_URL = 'https://github.com/tobi/qmd';
export const QMD_INSTALL_COMMAND = 'bun install -g github:tobi/qmd';
export const QMD_INDEX_ENV_VAR = 'CLAWVAULT_QMD_INDEX';

export type QmdErrorCode = 
  | 'NOT_INSTALLED'
  | 'NOT_CONFIGURED'
  | 'COLLECTION_NOT_FOUND'
  | 'EXECUTION_FAILED';

export interface QmdErrorDetails {
  code: QmdErrorCode;
  message: string;
  hint: string;
}

const QMD_ERROR_MESSAGES: Record<QmdErrorCode, QmdErrorDetails> = {
  NOT_INSTALLED: {
    code: 'NOT_INSTALLED',
    message: 'qmd is not installed',
    hint: `Install qmd to enable ClawVault search and indexing:\n  ${QMD_INSTALL_COMMAND}\n\nFor more information: ${QMD_INSTALL_URL}`
  },
  NOT_CONFIGURED: {
    code: 'NOT_CONFIGURED',
    message: 'qmd collection is not configured',
    hint: 'Run `clawvault doctor` to diagnose configuration issues, or `clawvault migrate` to fix common setup problems.'
  },
  COLLECTION_NOT_FOUND: {
    code: 'COLLECTION_NOT_FOUND',
    message: 'qmd collection not found',
    hint: 'The configured qmd collection does not exist. Run `clawvault migrate` to recreate it, or `qmd collection add <name> <path>` manually.'
  },
  EXECUTION_FAILED: {
    code: 'EXECUTION_FAILED',
    message: 'qmd command failed',
    hint: 'Run `clawvault doctor` to diagnose qmd issues.'
  }
};

export class QmdUnavailableError extends Error {
  readonly code: QmdErrorCode;
  readonly hint: string;

  constructor(code: QmdErrorCode = 'NOT_INSTALLED', additionalContext?: string) {
    const details = QMD_ERROR_MESSAGES[code];
    const fullMessage = additionalContext 
      ? `${details.message}: ${additionalContext}`
      : details.message;
    super(fullMessage);
    this.name = 'QmdUnavailableError';
    this.code = code;
    this.hint = details.hint;
  }

  toUserMessage(): string {
    return `Error: ${this.message}\n\n${this.hint}`;
  }
}

export function getQmdErrorDetails(code: QmdErrorCode): QmdErrorDetails {
  return QMD_ERROR_MESSAGES[code];
}

export class QmdConfigurationError extends Error {
  constructor(message: string, public readonly hint?: string) {
    super(message);
    this.name = 'QmdConfigurationError';
  }
}

/**
 * QMD search result format
 */
interface QmdResult {
  docid: string;
  score: number;
  file: string;
  title: string;
  snippet: string;
}

function ensureJsonArgs(args: string[]): string[] {
  return args.includes('--json') ? args : [...args, '--json'];
}

export function resolveQmdIndexName(indexName?: string): string | undefined {
  const explicit = indexName?.trim();
  if (explicit) {
    return explicit;
  }

  const fromEnv = process.env[QMD_INDEX_ENV_VAR]?.trim();
  return fromEnv || undefined;
}

export function withQmdIndexArgs(args: string[], indexName?: string): string[] {
  if (args.includes('--index')) {
    return [...args];
  }

  const resolvedIndexName = resolveQmdIndexName(indexName);
  if (!resolvedIndexName) {
    return [...args];
  }

  return ['--index', resolvedIndexName, ...args];
}

function tryParseJson(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function extractJsonPayload(raw: string): string | null {
  const start = raw.search(/[\[{]/);
  if (start === -1) return null;
  const end = Math.max(raw.lastIndexOf(']'), raw.lastIndexOf('}'));
  if (end <= start) return null;
  return raw.slice(start, end + 1);
}

/**
 * Strip non-JSON noise from qmd stdout (e.g. node-llama-cpp fallback
 * warnings, query expansion progress lines, and tree-drawing characters).
 * These appear before the JSON payload on systems without GPU support or
 * during first-run model downloads and break JSON.parse.
 */
function stripQmdNoise(raw: string): string {
  return raw
    .split('\n')
    .filter(line => {
      const t = line.trim();
      if (!t) return true;
      if (t.startsWith('[node-llama-cpp]')) return false;
      if (t.startsWith('Expanding query')) return false;
      if (t.startsWith('Searching ') && t.endsWith('queries...')) return false;
      if (/^[├└─│]/.test(t)) return false;
      return true;
    })
    .join('\n');
}

function parseQmdOutput(raw: string): QmdResult[] {
  const trimmed = stripQmdNoise(raw).trim();
  if (!trimmed) return [];

  const direct = tryParseJson(trimmed);
  const extracted = direct ? null : extractJsonPayload(trimmed);
  const parsed = direct ?? (extracted ? tryParseJson(extracted) : null);

  if (!parsed) {
    throw new Error('qmd returned non-JSON output. Ensure qmd supports --json.');
  }

  if (Array.isArray(parsed)) {
    return parsed as QmdResult[];
  }

  if (parsed && typeof parsed === 'object') {
    const candidate = (parsed as { results?: unknown; items?: unknown; data?: unknown; }).results
      ?? (parsed as { results?: unknown; items?: unknown; data?: unknown; }).items
      ?? (parsed as { results?: unknown; items?: unknown; data?: unknown; }).data;

    if (Array.isArray(candidate)) {
      return candidate as QmdResult[];
    }
  }

  throw new Error('qmd returned an unexpected JSON shape.');
}

function ensureQmdAvailable(): void {
  if (!hasQmd()) {
    throw new QmdUnavailableError('NOT_INSTALLED');
  }
}

function detectQmdError(output: string, args: string[]): Error | null {
  const lowerOutput = output.toLowerCase();

  if (lowerOutput.includes('missing required arguments') || lowerOutput.includes('unknown option')) {
    return new QmdConfigurationError(
      'qmd does not support the search command with the expected arguments. ' +
      'This may indicate an incompatible qmd version or a different tool named "qmd".',
      `Ensure you have the correct qmd installed: ${QMD_INSTALL_COMMAND}`
    );
  }

  if (lowerOutput.includes('collection not found') || lowerOutput.includes('no collection')) {
    const collectionArg = args.findIndex(a => a === '-c');
    const collectionName = collectionArg >= 0 && args[collectionArg + 1]
      ? args[collectionArg + 1]
      : 'unknown';
    return new QmdConfigurationError(
      `qmd collection "${collectionName}" not found.`,
      'Run `qmd update -c <collection>` to create the collection, or check your vault\'s .clawvault.json "name" field.'
    );
  }

  if (lowerOutput.includes('no index') || lowerOutput.includes('index not found')) {
    return new QmdConfigurationError(
      'qmd index not found. The vault may not be indexed yet.',
      'Run `clawvault rebuild` or `qmd update` to build the search index.'
    );
  }

  if (lowerOutput.includes('embedding') && (lowerOutput.includes('not found') || lowerOutput.includes('missing'))) {
    return new QmdConfigurationError(
      'qmd embeddings not found. Vector search requires embeddings to be generated.',
      'Run `clawvault embed` or `qmd embed` to generate embeddings for semantic search.'
    );
  }

  return null;
}

/**
 * Execute qmd command and return parsed JSON
 */
function execQmd(args: string[], indexName?: string): QmdResult[] {
  ensureQmdAvailable();
  const finalArgs = withQmdIndexArgs(ensureJsonArgs(args), indexName);

  try {
    const result = execFileSync('qmd', finalArgs, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 10 * 1024 * 1024, // 10MB
      shell: process.platform === 'win32'
    });

    return parseQmdOutput(result);
  } catch (err: any) {
    if (err?.code === 'ENOENT') {
      throw new QmdUnavailableError('NOT_INSTALLED');
    }

    if (err?.status === 1 && err?.stdout) {
      return parseQmdOutput(err.stdout);
    }

    const output = [err?.stdout, err?.stderr].filter(Boolean).join('\n');

    const detectedError = detectQmdError(output, finalArgs);
    if (detectedError) {
      throw detectedError;
    }

    if (output) {
      try {
        return parseQmdOutput(output);
      } catch {
        // Fall through to throw a helpful error
      }
      
      if (output.includes('collection not found') || output.includes('no such collection')) {
        throw new QmdUnavailableError('COLLECTION_NOT_FOUND', output.trim());
      }
    }

    const errorDetail = err?.message || 'unknown error';
    throw new QmdUnavailableError('EXECUTION_FAILED', errorDetail);
  }
}

/**
 * Check if qmd is available
 */
export function hasQmd(): boolean {
  const result = spawnSync('qmd', ['--version'], { stdio: 'ignore', shell: process.platform === 'win32' });
  return !result.error && (result.status === 0 || result.status === 1);
}

/**
 * Trigger qmd update (reindex)
 */
export function qmdUpdate(collection?: string, indexName?: string): void {
  ensureQmdAvailable();
  const args = ['update'];
  if (collection) {
    args.push('-c', collection);
  }
  execFileSync('qmd', withQmdIndexArgs(args, indexName), { stdio: 'inherit', shell: process.platform === 'win32' });
}

/**
 * Trigger qmd embed (create/update vector embeddings)
 */
export function qmdEmbed(collection?: string, indexName?: string): void {
  ensureQmdAvailable();
  const args = ['embed'];
  if (collection) {
    args.push('-c', collection);
  }
  execFileSync('qmd', withQmdIndexArgs(args, indexName), { stdio: 'inherit', shell: process.platform === 'win32' });
}

/**
 * QMD Search Engine - wraps qmd CLI
 */
export class SearchEngine {
  private documents: Map<string, Document> = new Map();
  private collection: string = '';
  private vaultPath: string = '';
  private collectionRoot: string = '';
  private qmdIndexName?: string;

  /**
   * Set the collection name (usually vault name)
   */
  setCollection(name: string): void {
    this.collection = name;
  }

  /**
   * Get the current collection name
   */
  getCollection(): string {
    return this.collection;
  }

  /**
   * Set the vault path for file resolution
   */
  setVaultPath(vaultPath: string): void {
    this.vaultPath = vaultPath;
  }

  /**
   * Set the collection root for qmd:// URI resolution
   */
  setCollectionRoot(root: string): void {
    this.collectionRoot = path.resolve(root);
  }

  /**
   * Set qmd index name (defaults to qmd global default when omitted)
   */
  setIndexName(indexName?: string): void {
    this.qmdIndexName = indexName;
  }

  /**
   * Add or update a document in the local cache
   * Note: qmd indexing happens via qmd update command
   */
  addDocument(doc: Document): void {
    this.documents.set(doc.id, doc);
  }

  /**
   * Remove a document from the local cache
   */
  removeDocument(id: string): void {
    this.documents.delete(id);
  }

  /**
   * No-op for qmd - indexing is managed externally
   */
  rebuildIDF(): void {
    // qmd handles this
  }

  /**
   * BM25 search via qmd
   */
  search(query: string, options: SearchOptions = {}): SearchResult[] {
    return this.runQmdQuery('search', query, options);
  }

  /**
   * Vector/semantic search via qmd vsearch
   */
  vsearch(query: string, options: SearchOptions = {}): SearchResult[] {
    return this.runQmdQuery('vsearch', query, options);
  }

  /**
   * Combined search with query expansion (qmd query command)
   */
  query(query: string, options: SearchOptions = {}): SearchResult[] {
    return this.runQmdQuery('query', query, options);
  }

  private runQmdQuery(command: 'search' | 'vsearch' | 'query', query: string, options: SearchOptions): SearchResult[] {
    const {
      limit = 10,
      minScore = 0,
      category,
      tags,
      fullContent = false,
      temporalBoost = false
    } = options;

    if (!query.trim()) return [];

    const args = [
      command,
      query,
      '-n', String(limit * 2),
      '--json'
    ];

    if (this.collection) {
      args.push('-c', this.collection);
    }

    const qmdResults = execQmd(args, this.qmdIndexName);

    return this.convertResults(qmdResults, {
      limit,
      minScore,
      category,
      tags,
      fullContent,
      temporalBoost
    });
  }

  /**
   * Convert qmd results to ClawVault SearchResult format
   */
  private convertResults(
    qmdResults: QmdResult[], 
    options: SearchOptions
  ): SearchResult[] {
    const { limit = 10, minScore = 0, category, tags, fullContent = false, temporalBoost = false } = options;
    
    const results: SearchResult[] = [];
    
    // Normalize scores - qmd uses different scales
    const maxScore = qmdResults[0]?.score || 1;
    
    for (const qr of qmdResults) {
      // Extract file path from qmd:// URI
      const filePath = this.qmdUriToPath(qr.file);
      const relativePath = this.vaultPath 
        ? path.relative(this.vaultPath, filePath)
        : filePath;
      const normalizedRelativePath = relativePath.replace(/\\/g, '/');
      if (
        normalizedRelativePath.startsWith('ledger/archive/')
        || normalizedRelativePath.includes('/ledger/archive/')
      ) {
        continue;
      }
      
      // Get document from cache or create minimal one
      const docId = normalizedRelativePath.replace(/\.md$/, '');
      let doc = this.documents.get(docId)
        ?? this.documents.get(docId.split('/').join(path.sep));
      const modifiedAt = this.resolveModifiedAt(doc, filePath);
      
      // Determine category from path
      const parts = normalizedRelativePath.split('/');
      const docCategory = parts.length > 1 ? parts[0] : 'root';
      
      // Apply category filter
      if (category && docCategory !== category) continue;
      
      // Apply tag filter (only if we have the document cached)
      if (tags && tags.length > 0 && doc) {
        const docTags = new Set(doc.tags);
        if (!tags.some(t => docTags.has(t))) continue;
      }
      
      // Normalize score to 0-1 range
      const normalizedScore = maxScore > 0 ? qr.score / maxScore : 0;
      const finalScore = temporalBoost
        ? normalizedScore * this.getRecencyFactor(modifiedAt)
        : normalizedScore;
      
      // Apply min score filter
      if (finalScore < minScore) continue;
      
      // Create document if not cached
      if (!doc) {
        doc = {
          id: docId,
          path: filePath,
          category: docCategory,
          title: qr.title || path.basename(relativePath, '.md'),
          content: '', // Content loaded separately if needed
          frontmatter: {},
          links: [],
          tags: [],
          modified: modifiedAt
        };
      }
      
      results.push({
        document: fullContent ? doc : { ...doc, content: '' },
        score: finalScore,
        snippet: this.cleanSnippet(qr.snippet),
        matchedTerms: [] // qmd doesn't provide this
      });
    }
    
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private resolveModifiedAt(doc: Document | undefined, filePath: string): Date {
    if (doc) return doc.modified;
    try {
      return fs.statSync(filePath).mtime;
    } catch {
      return new Date(0);
    }
  }

  private getRecencyFactor(modifiedAt: Date): number {
    const ageMs = Math.max(0, Date.now() - modifiedAt.getTime());
    const ageDays = ageMs / (24 * 60 * 60 * 1000);

    if (ageDays < 1) return 1.0;
    if (ageDays <= 7) return 0.9;
    return 0.7;
  }

  /**
   * Convert qmd:// URI to file path
   */
  private qmdUriToPath(uri: string): string {
    // qmd://collection/path/to/file.md -> actual path
    if (uri.startsWith('qmd://')) {
      const withoutScheme = uri.slice(6); // Remove 'qmd://'
      const slashIndex = withoutScheme.indexOf('/');
      if (slashIndex > -1) {
        // Get collection name and relative path
        const relativePath = withoutScheme.slice(slashIndex + 1);

        const root = this.collectionRoot || this.vaultPath;
        if (root) {
          return path.join(root, relativePath);
        }

        return relativePath;
      }
    }
    
    // Return as-is if not a qmd:// URI
    return uri;
  }

  /**
   * Clean up qmd snippet format
   */
  private cleanSnippet(snippet: string): string {
    if (!snippet) return '';
    
    // Remove diff-style markers like "@@ -2,4 @@ (1 before, 67 after)"
    return snippet
      .replace(/@@ [-+]?\d+,?\d* @@ \([^)]+\)/g, '')
      .trim()
      .split('\n')
      .slice(0, 3)
      .join('\n')
      .slice(0, 300);
  }

  /**
   * Get all cached documents
   */
  getAllDocuments(): Document[] {
    return [...this.documents.values()];
  }

  /**
   * Get document count
   */
  get size(): number {
    return this.documents.size;
  }

  /**
   * Clear the local document cache
   */
  clear(): void {
    this.documents.clear();
  }

  /**
   * Export documents for persistence
   */
  export(): { documents: Document[]; } {
    return {
      documents: [...this.documents.values()]
    };
  }

  /**
   * Import from persisted data
   */
  import(data: { documents: Document[]; }): void {
    this.clear();
    for (const doc of data.documents) {
      this.addDocument(doc);
    }
  }
}

/**
 * Find wiki-links in content
 */
export function extractWikiLinks(content: string): string[] {
  const matches = content.match(/\[\[([^\]]+)\]\]/g) || [];
  return matches.map(m => m.slice(2, -2).toLowerCase());
}

/**
 * Find tags in content (#tag format)
 */
export function extractTags(content: string): string[] {
  const matches = content.match(/#[\w-]+/g) || [];
  return [...new Set(matches.map(m => m.slice(1).toLowerCase()))];
}
