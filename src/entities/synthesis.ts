import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import { ClawVault } from '../lib/vault.js';
import type { Document } from '../types.js';
import type { EntityKind, EntityProfile, EntityRelationship } from './types.js';

interface MentionRecord {
  document: Document;
  snippet: string;
}

interface RelationshipAccumulator {
  target: string;
  count: number;
  evidence: Set<string>;
}

export interface SynthesizeEntityProfilesOptions {
  writeFiles?: boolean;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function cleanEntityName(value: string): string {
  const stripped = value.replace(/[#*_`]/g, '').trim();
  if (!stripped) return stripped;
  if (/[A-Z]/.test(stripped)) {
    return stripped;
  }
  return stripped
    .replace(/[-_]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }
  return out;
}

function extractBestSnippet(document: Document): string {
  const content = document.content.replace(/\s+/g, ' ').trim();
  if (!content) return `Referenced in ${document.id}`;
  return content.slice(0, 180);
}

function inferEntityKind(name: string, mentions: MentionRecord[]): EntityKind {
  const categoryCounts = new Map<string, number>();
  for (const mention of mentions) {
    categoryCounts.set(
      mention.document.category,
      (categoryCounts.get(mention.document.category) ?? 0) + 1
    );
  }

  if ((categoryCounts.get('people') ?? 0) >= (categoryCounts.get('projects') ?? 0) && (categoryCounts.get('people') ?? 0) > 0) {
    return 'person';
  }
  if ((categoryCounts.get('projects') ?? 0) > 0) {
    return 'project';
  }
  if (/\b(inc|corp|llc|ltd|org|foundation|company)\b/i.test(name)) {
    return 'org';
  }
  if (/\b(city|county|street|park|mount|river|lake|bay)\b/i.test(name)) {
    return 'place';
  }
  return 'unknown';
}

function buildSummary(name: string, mentions: MentionRecord[]): string {
  if (mentions.length === 0) {
    return `${name} is tracked in ClawVault memories.`;
  }

  const newest = [...mentions].sort(
    (left, right) => right.document.modified.getTime() - left.document.modified.getTime()
  )[0];
  const snippet = newest?.snippet ?? `${name} is referenced in memory files.`;
  return snippet.endsWith('.') ? snippet : `${snippet}.`;
}

function toIsoDate(value: Date): string {
  return value.toISOString();
}

function buildRelationshipGraph(
  entityMentions: Map<string, MentionRecord[]>
): Map<string, Map<string, RelationshipAccumulator>> {
  const graph = new Map<string, Map<string, RelationshipAccumulator>>();
  for (const [entityName, mentions] of entityMentions.entries()) {
    for (const mention of mentions) {
      const coMentioned = uniqueStrings(
        mention.document.links.map((link) => cleanEntityName(link))
      ).filter((candidate) => candidate.toLowerCase() !== entityName.toLowerCase());
      if (coMentioned.length === 0) continue;

      if (!graph.has(entityName)) {
        graph.set(entityName, new Map<string, RelationshipAccumulator>());
      }
      const adjacency = graph.get(entityName)!;
      for (const related of coMentioned) {
        const current = adjacency.get(related) ?? {
          target: related,
          count: 0,
          evidence: new Set<string>()
        };
        current.count += 1;
        current.evidence.add(mention.document.id);
        adjacency.set(related, current);
      }
    }
  }
  return graph;
}

function toRelationships(accumulator?: Map<string, RelationshipAccumulator>): EntityRelationship[] {
  if (!accumulator) return [];
  return [...accumulator.values()]
    .sort((left, right) => right.count - left.count)
    .slice(0, 8)
    .map((entry) => ({
      target: entry.target,
      strength: entry.count,
      evidence: [...entry.evidence].slice(0, 5)
    }));
}

function renderEntityProfileMarkdown(profile: EntityProfile): string {
  const frontmatter: Record<string, unknown> = {
    title: profile.name,
    aliases: profile.aliases,
    kind: profile.kind,
    lastMentioned: profile.lastMentioned,
    relationships: profile.relationships.map((relationship) => ({
      target: relationship.target,
      strength: relationship.strength,
      evidence: relationship.evidence
    }))
  };

  const relationshipLines = profile.relationships.length > 0
    ? profile.relationships
      .map((relationship) => `- [[${relationship.target}]] (strength: ${relationship.strength})`)
      .join('\n')
    : '- No relationships recorded yet.';

  const body = [
    `# ${profile.name}`,
    '',
    profile.summary,
    '',
    '## Relationships',
    relationshipLines,
    '',
    '## Metadata',
    `- Kind: ${profile.kind}`,
    `- Last mentioned: ${profile.lastMentioned}`
  ].join('\n');

  return matter.stringify(body, frontmatter);
}

function parseEntityProfile(filePath: string): EntityProfile {
  const parsed = matter(fs.readFileSync(filePath, 'utf-8'));
  const title = typeof parsed.data.title === 'string'
    ? parsed.data.title
    : path.basename(filePath, '.md');
  const aliases = Array.isArray(parsed.data.aliases)
    ? parsed.data.aliases.map((value) => String(value))
    : [title];
  const kind = typeof parsed.data.kind === 'string'
    ? parsed.data.kind as EntityKind
    : 'unknown';
  const relationships: EntityRelationship[] = Array.isArray(parsed.data.relationships)
    ? parsed.data.relationships
      .map((value) => {
        if (!value || typeof value !== 'object') return null;
        const record = value as Record<string, unknown>;
        if (typeof record.target !== 'string') return null;
        const strengthValue = typeof record.strength === 'number'
          ? record.strength
          : Number.parseFloat(String(record.strength ?? '1'));
        return {
          target: record.target,
          strength: Number.isFinite(strengthValue) ? strengthValue : 1,
          evidence: Array.isArray(record.evidence) ? record.evidence.map((entry) => String(entry)) : []
        };
      })
      .filter((value): value is EntityRelationship => Boolean(value))
    : [];
  const summary = parsed.content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('#') && !line.startsWith('-')) ?? `${title} profile`;
  const lastMentioned = typeof parsed.data.lastMentioned === 'string'
    ? parsed.data.lastMentioned
    : new Date(0).toISOString();

  return {
    name: title,
    aliases: uniqueStrings([title, ...aliases]),
    kind,
    summary,
    relationships,
    lastMentioned
  };
}

async function collectEntityMentions(vaultPath: string): Promise<Map<string, MentionRecord[]>> {
  const vault = new ClawVault(vaultPath);
  await vault.load();
  const docs = await vault.list();
  const map = new Map<string, MentionRecord[]>();

  for (const document of docs) {
    const names = uniqueStrings(
      document.category === 'people' || document.category === 'projects'
        ? [document.title, ...document.links.map((link) => cleanEntityName(link))]
        : document.links.map((link) => cleanEntityName(link))
    );

    for (const name of names) {
      if (!map.has(name)) {
        map.set(name, []);
      }
      map.get(name)!.push({
        document,
        snippet: extractBestSnippet(document)
      });
    }
  }

  return map;
}

export async function synthesizeEntityProfiles(
  vaultPath: string,
  options: SynthesizeEntityProfilesOptions = {}
): Promise<EntityProfile[]> {
  const mentions = await collectEntityMentions(vaultPath);
  const relationshipGraph = buildRelationshipGraph(mentions);

  const profiles: EntityProfile[] = [];
  for (const [name, records] of mentions.entries()) {
    const kind = inferEntityKind(name, records);
    const relationships = toRelationships(relationshipGraph.get(name));
    const aliases = uniqueStrings([
      name,
      slugify(name).replace(/-/g, ' ')
    ]);
    const lastMentioned = toIsoDate(
      records.reduce((latest, record) =>
        record.document.modified.getTime() > latest.getTime() ? record.document.modified : latest,
      new Date(0))
    );

    profiles.push({
      name,
      aliases,
      kind,
      summary: buildSummary(name, records),
      relationships,
      lastMentioned
    });
  }

  profiles.sort((left, right) => right.lastMentioned.localeCompare(left.lastMentioned));

  if (options.writeFiles ?? true) {
    const entitiesDir = path.join(vaultPath, 'entities');
    if (!fs.existsSync(entitiesDir)) {
      fs.mkdirSync(entitiesDir, { recursive: true });
    }
    for (const profile of profiles) {
      const targetPath = path.join(entitiesDir, `${slugify(profile.name)}.md`);
      fs.writeFileSync(targetPath, renderEntityProfileMarkdown(profile), 'utf-8');
    }
  }

  return profiles;
}

export function readEntityProfiles(vaultPath: string): EntityProfile[] {
  const entitiesDir = path.join(vaultPath, 'entities');
  if (!fs.existsSync(entitiesDir)) {
    return [];
  }
  const files = fs.readdirSync(entitiesDir).filter((entry) => entry.endsWith('.md'));
  return files
    .map((entry) => parseEntityProfile(path.join(entitiesDir, entry)))
    .sort((left, right) => right.lastMentioned.localeCompare(left.lastMentioned));
}

export async function ensureEntityProfiles(vaultPath: string): Promise<EntityProfile[]> {
  const existing = readEntityProfiles(vaultPath);
  if (existing.length > 0) {
    return existing;
  }
  return synthesizeEntityProfiles(vaultPath, { writeFiles: true });
}

export async function readEntityProfile(vaultPath: string, name: string): Promise<EntityProfile | null> {
  const profiles = await ensureEntityProfiles(vaultPath);
  const normalized = name.trim().toLowerCase();
  for (const profile of profiles) {
    if (profile.name.toLowerCase() === normalized) {
      return profile;
    }
    if (profile.aliases.some((alias) => alias.toLowerCase() === normalized)) {
      return profile;
    }
  }
  return null;
}

