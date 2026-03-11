import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import type { InboxItem } from '../inbox.js';

export const CURATOR_SYSTEM_PROMPT = [
  'You are Curator, a vault maintenance worker.',
  'Classify each inbox capture into one destination category.',
  'Return strict JSON only with shape:',
  '{"routes":[{"hash":"...","category":"...","reason":"..."}]}'
].join(' ');

export const JANITOR_SYSTEM_PROMPT = [
  'You are Janitor, a vault hygiene worker.',
  'Given dedupe/staleness metrics, propose concise cleanup recommendations.',
  'Return plain text bullets.'
].join(' ');

export const DISTILLER_SYSTEM_PROMPT = [
  'You are Distiller, a memory extraction worker.',
  'Extract facts, decisions, and lessons from long-form captures.',
  'Return strict JSON only with shape:',
  '{"items":[{"hash":"...","facts":["..."],"decisions":["..."],"lessons":["..."]}]}'
].join(' ');

export const SURVEYOR_SYSTEM_PROMPT = [
  'You are Surveyor, a graph health worker.',
  'Analyze vault metrics and suggest practical improvements.',
  'Return plain text bullets.'
].join(' ');

export const CURATOR_ALLOWED_CATEGORIES = new Set([
  'rules',
  'preferences',
  'decisions',
  'patterns',
  'people',
  'projects',
  'goals',
  'transcripts',
  'inbox',
  'facts',
  'feelings',
  'lessons',
  'commitments',
  'handoffs',
  'research',
  'agents'
]);

export function truncate(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, Math.max(0, max - 3))}...`;
}

export function toRelative(vaultPath: string, filePath: string): string {
  return path.relative(path.resolve(vaultPath), filePath).replace(/\\/g, '/');
}

export function extractJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = codeBlockMatch ? codeBlockMatch[1].trim() : trimmed;
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  if (firstBrace < 0 || lastBrace <= firstBrace) {
    return null;
  }
  try {
    const parsed = JSON.parse(candidate.slice(firstBrace, lastBrace + 1)) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function writeFileIfChanged(filePath: string, content: string, dryRun: boolean): boolean {
  const normalized = content.endsWith('\n') ? content : `${content}\n`;
  if (fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath, 'utf-8');
    if (existing === normalized) {
      return false;
    }
  }
  if (!dryRun) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, normalized, 'utf-8');
  }
  return true;
}

export function moveToArchive(
  sourcePath: string,
  archiveDir: string,
  dryRun: boolean
): { moved: boolean; destinationPath: string } {
  const baseName = path.basename(sourcePath);
  let destinationPath = path.join(archiveDir, baseName);
  let counter = 1;
  while (fs.existsSync(destinationPath)) {
    const ext = path.extname(baseName);
    const stem = ext ? baseName.slice(0, -ext.length) : baseName;
    destinationPath = path.join(archiveDir, `${stem}-${counter}${ext}`);
    counter += 1;
  }
  if (!dryRun) {
    fs.mkdirSync(archiveDir, { recursive: true });
    fs.renameSync(sourcePath, destinationPath);
  }
  return { moved: true, destinationPath };
}

export function hashList(values: string[]): string {
  return createHash('sha256').update(values.join('|')).digest('hex');
}

export function parseCuratorRoutes(raw: string): Map<string, string> {
  const parsed = extractJsonObject(raw);
  const routesRaw = parsed?.routes;
  if (!Array.isArray(routesRaw)) {
    return new Map();
  }
  const routes = new Map<string, string>();
  for (const entry of routesRaw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const hash = typeof record.hash === 'string'
      ? record.hash.trim()
      : '';
    const category = typeof record.category === 'string'
      ? record.category.trim()
      : '';
    if (!hash || !category || !CURATOR_ALLOWED_CATEGORIES.has(category)) {
      continue;
    }
    routes.set(hash, category);
  }
  return routes;
}

export function parseDistillerInsights(raw: string): Map<string, { facts: string[]; decisions: string[]; lessons: string[] }> {
  const parsed = extractJsonObject(raw);
  const itemsRaw = parsed?.items;
  if (!Array.isArray(itemsRaw)) {
    return new Map();
  }
  const map = new Map<string, { facts: string[]; decisions: string[]; lessons: string[] }>();
  for (const entry of itemsRaw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const hash = typeof record.hash === 'string' ? record.hash.trim() : '';
    if (!hash) {
      continue;
    }
    const facts = Array.isArray(record.facts)
      ? record.facts.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      : [];
    const decisions = Array.isArray(record.decisions)
      ? record.decisions.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      : [];
    const lessons = Array.isArray(record.lessons)
      ? record.lessons.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      : [];
    map.set(hash, { facts, decisions, lessons });
  }
  return map;
}

export function renderBulletSection(title: string, lines: string[]): string {
  if (lines.length === 0) {
    return '';
  }
  return `## ${title}\n${lines.map((line) => `- ${line}`).join('\n')}\n`;
}

export function wordsCount(content: string): number {
  return content.trim().split(/\s+/).filter(Boolean).length;
}

export function buildCuratorLlmPrompt(items: InboxItem[]): string {
  const payload = items.map((item) => ({
    hash: item.hash,
    title: item.title,
    sample: truncate(item.content, 300)
  }));
  return [
    'Classify each inbox item into a single category.',
    `Allowed categories: ${[...CURATOR_ALLOWED_CATEGORIES].join(', ')}`,
    'Return JSON only.',
    JSON.stringify(payload, null, 2)
  ].join('\n\n');
}

export function buildDistillerLlmPrompt(items: InboxItem[]): string {
  const payload = items.map((item) => ({
    hash: item.hash,
    title: item.title,
    content: truncate(item.content, 1800)
  }));
  return [
    'Extract facts, decisions, and lessons for each item.',
    'Return concise bullet-style statements and JSON only.',
    JSON.stringify(payload, null, 2)
  ].join('\n\n');
}
