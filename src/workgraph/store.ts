/**
 * Workgraph store — CRUD for primitive instances.
 *
 * Primitives are markdown files with YAML frontmatter. The store reads/writes
 * them and logs every mutation to the ledger. Schemas are soft: unknown fields
 * are preserved, missing optional fields get defaults.
 */

import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { loadRegistry, getType } from './registry.js';
import * as ledger from './ledger.js';
import type { PrimitiveInstance, PrimitiveTypeDefinition } from './types.js';

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export function create(
  vaultPath: string,
  typeName: string,
  fields: Record<string, unknown>,
  body: string,
  actor: string,
): PrimitiveInstance {
  const typeDef = getType(vaultPath, typeName);
  if (!typeDef) {
    throw new Error(`Unknown primitive type "${typeName}". Run \`clawvault primitive list\` to see available types, or \`clawvault primitive define\` to create one.`);
  }

  const now = new Date().toISOString();
  const merged = applyDefaults(typeDef, {
    ...fields,
    created: fields.created ?? now,
    updated: now,
  });

  const slug = slugify(String(merged.title ?? merged.name ?? typeName));
  const relDir = typeDef.directory;
  const relPath = `${relDir}/${slug}.md`;
  const absDir = path.join(vaultPath, relDir);
  const absPath = path.join(vaultPath, relPath);

  if (!fs.existsSync(absDir)) fs.mkdirSync(absDir, { recursive: true });
  if (fs.existsSync(absPath)) {
    throw new Error(`File already exists: ${relPath}. Use update instead.`);
  }

  const content = matter.stringify(body, stripUndefined(merged));
  fs.writeFileSync(absPath, content, 'utf-8');

  ledger.append(vaultPath, actor, 'create', relPath, typeName, {
    title: merged.title ?? slug,
  });

  return { path: relPath, type: typeName, fields: merged, body };
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export function read(vaultPath: string, relPath: string): PrimitiveInstance | null {
  const absPath = path.join(vaultPath, relPath);
  if (!fs.existsSync(absPath)) return null;

  const raw = fs.readFileSync(absPath, 'utf-8');
  const { data, content } = matter(raw);

  const typeName = inferType(vaultPath, relPath);
  return { path: relPath, type: typeName, fields: data, body: content.trim() };
}

export function list(vaultPath: string, typeName: string): PrimitiveInstance[] {
  const typeDef = getType(vaultPath, typeName);
  if (!typeDef) return [];

  const dir = path.join(vaultPath, typeDef.directory);
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  const instances: PrimitiveInstance[] = [];

  for (const file of files) {
    const relPath = `${typeDef.directory}/${file}`;
    const inst = read(vaultPath, relPath);
    if (inst) instances.push(inst);
  }

  return instances;
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export function update(
  vaultPath: string,
  relPath: string,
  fieldUpdates: Record<string, unknown>,
  bodyUpdate: string | undefined,
  actor: string,
): PrimitiveInstance {
  const existing = read(vaultPath, relPath);
  if (!existing) throw new Error(`Not found: ${relPath}`);

  const now = new Date().toISOString();
  const newFields = { ...existing.fields, ...fieldUpdates, updated: now };
  const newBody = bodyUpdate ?? existing.body;
  const absPath = path.join(vaultPath, relPath);

  const content = matter.stringify(newBody, stripUndefined(newFields));
  fs.writeFileSync(absPath, content, 'utf-8');

  ledger.append(vaultPath, actor, 'update', relPath, existing.type, {
    changed: Object.keys(fieldUpdates),
  });

  return { path: relPath, type: existing.type, fields: newFields, body: newBody };
}

// ---------------------------------------------------------------------------
// Delete (soft — moves to .clawvault/archive/)
// ---------------------------------------------------------------------------

export function remove(vaultPath: string, relPath: string, actor: string): void {
  const absPath = path.join(vaultPath, relPath);
  if (!fs.existsSync(absPath)) throw new Error(`Not found: ${relPath}`);

  const archiveDir = path.join(vaultPath, '.clawvault', 'archive');
  if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });

  const archivePath = path.join(archiveDir, path.basename(relPath));
  fs.renameSync(absPath, archivePath);

  const typeName = inferType(vaultPath, relPath);
  ledger.append(vaultPath, actor, 'delete', relPath, typeName);
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

export function findByField(
  vaultPath: string,
  typeName: string,
  field: string,
  value: unknown,
): PrimitiveInstance[] {
  return list(vaultPath, typeName).filter(inst => inst.fields[field] === value);
}

export function openThreads(vaultPath: string): PrimitiveInstance[] {
  return findByField(vaultPath, 'thread', 'status', 'open');
}

export function activeThreads(vaultPath: string): PrimitiveInstance[] {
  return findByField(vaultPath, 'thread', 'status', 'active');
}

export function blockedThreads(vaultPath: string): PrimitiveInstance[] {
  return findByField(vaultPath, 'thread', 'status', 'blocked');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function applyDefaults(
  typeDef: PrimitiveTypeDefinition,
  fields: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...fields };
  for (const [key, def] of Object.entries(typeDef.fields)) {
    if (result[key] === undefined && def.default !== undefined) {
      result[key] = def.default;
    }
  }
  return result;
}

function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) result[k] = v;
  }
  return result;
}

function inferType(vaultPath: string, relPath: string): string {
  const registry = loadRegistry(vaultPath);
  const dir = relPath.split('/')[0];

  for (const typeDef of Object.values(registry.types)) {
    if (typeDef.directory === dir) return typeDef.name;
  }
  return 'unknown';
}
