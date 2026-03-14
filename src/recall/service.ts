import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import type { ClawVault } from '../lib/vault.js';
import type { SearchResult } from '../types.js';
import { classifyRecallQuery } from './strategies.js';
import type { RecallOptions, RecallResult, RecallSource } from './types.js';

const DEFAULT_LIMIT = 6;
const DEFAULT_MAX_SNIPPET = 220;

function compactSnippet(value: string, maxChars: number = DEFAULT_MAX_SNIPPET): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return 'No snippet available.';
  return normalized.slice(0, maxChars);
}

function toIso(value: Date): string {
  return value.toISOString();
}

function parseFrontmatterDate(raw: unknown): Date | null {
  if (typeof raw !== 'string' && !(raw instanceof Date)) return null;
  const date = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function formatContextHeader(strategy: string, query: string): string {
  return [
    '[ClawVault memory recall]',
    `strategy: ${strategy}`,
    `query: ${query}`
  ].join(' | ');
}

function isRelationshipResult(result: SearchResult): boolean {
  const memoryType = typeof result.document.frontmatter.memoryType === 'string'
    ? result.document.frontmatter.memoryType.toLowerCase()
    : '';
  if (memoryType === 'relationship') {
    return true;
  }
  const content = `${result.document.title}\n${result.document.content}`;
  return /\b(works with|reports to|related to|depends on|collaborates with|partnered with|between)\b/i.test(content)
    || (result.document.links?.length ?? 0) >= 2;
}

function filterTemporalResults(results: SearchResult[], days?: number): SearchResult[] {
  if (!days || !Number.isFinite(days) || days <= 0) {
    return results;
  }
  const windowMs = days * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - windowMs;
  return results.filter((result) => {
    const fmDate = parseFrontmatterDate(result.document.frontmatter.date);
    const reference = fmDate ?? result.document.modified;
    return reference.getTime() >= cutoff;
  });
}

function entityProfilePath(vaultPath: string, entityName: string): string {
  const slug = entityName
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
  return path.join(vaultPath, 'entities', `${slug}.md`);
}

function readEntityBrief(vaultPath: string, entityName: string): string | null {
  const filePath = entityProfilePath(vaultPath, entityName);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const parsed = matter(fs.readFileSync(filePath, 'utf-8'));
  const kind = typeof parsed.data.kind === 'string' ? parsed.data.kind : 'unknown';
  const summary = parsed.content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('#') && !line.startsWith('-')) ?? '';
  const relationships = Array.isArray(parsed.data.relationships)
    ? parsed.data.relationships.slice(0, 4).map((entry) => {
      if (typeof entry === 'string') return entry;
      if (!entry || typeof entry !== 'object') return '';
      const record = entry as Record<string, unknown>;
      return typeof record.target === 'string' ? record.target : '';
    }).filter(Boolean)
    : [];
  const relationshipChunk = relationships.length > 0
    ? ` Relationships: ${relationships.join(', ')}.`
    : '';
  return `Entity brief: ${entityName} (${kind}). ${summary}${relationshipChunk}`.trim();
}

function toRecallSource(result: SearchResult): RecallSource {
  return {
    title: result.document.title,
    path: result.document.id,
    category: result.document.category,
    score: Number(result.score.toFixed(4)),
    snippet: compactSnippet(result.snippet || result.document.content),
    modified: toIso(result.document.modified)
  };
}

function uniqueEntityNames(results: SearchResult[]): string[] {
  const names = new Set<string>();
  for (const result of results) {
    if (result.document.category === 'people' || result.document.category === 'projects' || result.document.category === 'entities') {
      names.add(result.document.title);
    }
    for (const link of result.document.links) {
      if (link.trim()) names.add(link.trim());
    }
  }
  return [...names];
}

function formatRecallContext(result: RecallResult, includeSources: boolean): string {
  const lines: string[] = [formatContextHeader(result.strategy, result.query), ''];

  if (result.sources.length === 0) {
    lines.push('No relevant memories found.');
    return lines.join('\n');
  }

  if (result.strategy === 'verification') {
    lines.push('Verification-oriented evidence:');
  } else if (result.strategy === 'relationship') {
    lines.push('Relationship-focused recall:');
  } else if (result.strategy === 'temporal') {
    lines.push('Time-filtered recall:');
  } else if (result.strategy === 'entity' && result.entityName) {
    lines.push(`Entity-focused recall for "${result.entityName}":`);
  } else {
    lines.push('Relevant recall:');
  }

  lines.push('');
  for (const source of result.sources) {
    const sourceTail = includeSources || result.strategy === 'verification'
      ? ` [${source.path}]`
      : '';
    lines.push(`- (${source.score.toFixed(2)}) ${source.title}${sourceTail}`);
    lines.push(`  ${source.snippet}`);
  }

  return lines.join('\n').trim();
}

export async function buildRecallResult(
  vault: ClawVault,
  query: string,
  options: RecallOptions = {}
): Promise<RecallResult> {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const broadLimit = Math.max(limit * 4, limit);

  const seededResults = await vault.find(query, {
    limit: broadLimit,
    temporalBoost: true,
    ...(options.searchOptions ?? {})
  });
  const knownEntityNames = uniqueEntityNames(seededResults);
  const classification = classifyRecallQuery(query, knownEntityNames, options.strategy);

  let scopedResults: SearchResult[] = seededResults;
  if (classification.strategy === 'entity' && classification.entityName) {
    scopedResults = await vault.find(`"${classification.entityName}" ${query}`, {
      limit: broadLimit,
      temporalBoost: true,
      ...(options.searchOptions ?? {})
    });
  } else if (classification.strategy === 'temporal') {
    scopedResults = filterTemporalResults(scopedResults, classification.temporalDays);
  } else if (classification.strategy === 'relationship') {
    scopedResults = scopedResults.filter((result) => isRelationshipResult(result));
  } else if (classification.strategy === 'verification') {
    scopedResults = [...scopedResults].sort((left, right) => right.score - left.score);
  }

  const selected = scopedResults.slice(0, limit);
  const sources = selected.map(toRecallSource);
  const entityBrief = classification.entityName
    ? readEntityBrief(vault.getPath(), classification.entityName)
    : null;

  const provisionalResult: RecallResult = {
    query,
    strategy: classification.strategy,
    entityName: classification.entityName,
    context: '',
    sources,
    rawResults: selected
  };

  const baseContext = formatRecallContext(provisionalResult, options.includeSources ?? false);
  provisionalResult.context = entityBrief
    ? `${baseContext}\n\n${entityBrief}`
    : baseContext;

  return provisionalResult;
}

