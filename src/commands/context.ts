import * as path from 'path';
import { ClawVault } from '../lib/vault.js';
import type { SearchResult } from '../types.js';

const DEFAULT_LIMIT = 5;
const MAX_SNIPPET_LENGTH = 320;

export type ContextFormat = 'markdown' | 'json';

export interface ContextOptions {
  vaultPath: string;
  limit?: number;
  format?: ContextFormat;
  recent?: boolean;
}

export interface ContextEntry {
  title: string;
  path: string;
  category: string;
  score: number;
  snippet: string;
  modified: string;
  age: string;
}

export interface ContextResult {
  task: string;
  generated: string;
  context: ContextEntry[];
  markdown: string;
}

function formatRelativeAge(date: Date, now: number = Date.now()): string {
  const ageMs = Math.max(0, now - date.getTime());
  const days = Math.floor(ageMs / (24 * 60 * 60 * 1000));

  if (days === 0) return 'today';
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? '' : 's'} ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;

  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

function normalizeSnippet(result: SearchResult): string {
  const source = (result.snippet || result.document.content || '').trim();
  if (!source) return 'No snippet available.';
  return source
    .replace(/\s+/g, ' ')
    .slice(0, MAX_SNIPPET_LENGTH);
}

export function formatContextMarkdown(task: string, entries: ContextEntry[]): string {
  let output = `## Relevant Context for: ${task}\n\n`;

  if (entries.length === 0) {
    output += '_No relevant context found._\n';
    return output;
  }

  for (const entry of entries) {
    output += `### ${entry.title} (score: ${entry.score.toFixed(2)}, ${entry.age})\n`;
    output += `${entry.snippet}\n\n`;
  }

  return output.trimEnd();
}

export async function buildContext(task: string, options: ContextOptions): Promise<ContextResult> {
  const normalizedTask = task.trim();
  if (!normalizedTask) {
    throw new Error('Task description is required.');
  }

  const vault = new ClawVault(path.resolve(options.vaultPath));
  await vault.load();

  const limit = Math.max(1, options.limit ?? DEFAULT_LIMIT);
  const recent = options.recent ?? true;

  const results = await vault.vsearch(normalizedTask, {
    limit,
    temporalBoost: recent
  });

  const context = results.map((result): ContextEntry => ({
    title: result.document.title,
    path: path.relative(vault.getPath(), result.document.path).split(path.sep).join('/'),
    category: result.document.category,
    score: result.score,
    snippet: normalizeSnippet(result),
    modified: result.document.modified.toISOString(),
    age: formatRelativeAge(result.document.modified)
  }));

  return {
    task: normalizedTask,
    generated: new Date().toISOString(),
    context,
    markdown: formatContextMarkdown(normalizedTask, context)
  };
}

export async function contextCommand(task: string, options: ContextOptions): Promise<void> {
  const result = await buildContext(task, options);
  const format = options.format ?? 'markdown';

  if (format === 'json') {
    console.log(JSON.stringify({
      task: result.task,
      generated: result.generated,
      count: result.context.length,
      context: result.context
    }, null, 2));
    return;
  }

  console.log(result.markdown);
}
