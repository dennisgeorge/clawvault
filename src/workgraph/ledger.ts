/**
 * Append-only event ledger.
 *
 * Every mutation to the workgraph is logged here. This is the source of truth
 * for coordination: who claimed what, when, and what's available.
 *
 * Format: one JSON object per line (.jsonl) in `.clawvault/ledger.jsonl`.
 * Agents read the ledger to know the state of the world.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { LedgerEntry, LedgerOp } from './types.js';

const LEDGER_FILE = '.clawvault/ledger.jsonl';

// ---------------------------------------------------------------------------
// Core operations
// ---------------------------------------------------------------------------

export function ledgerPath(vaultPath: string): string {
  return path.join(vaultPath, LEDGER_FILE);
}

export function append(
  vaultPath: string,
  actor: string,
  op: LedgerOp,
  target: string,
  type?: string,
  data?: Record<string, unknown>,
): LedgerEntry {
  const entry: LedgerEntry = {
    ts: new Date().toISOString(),
    actor,
    op,
    target,
    ...(type ? { type } : {}),
    ...(data && Object.keys(data).length > 0 ? { data } : {}),
  };

  const lPath = ledgerPath(vaultPath);
  const dir = path.dirname(lPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(lPath, JSON.stringify(entry) + '\n', 'utf-8');
  return entry;
}

export function readAll(vaultPath: string): LedgerEntry[] {
  const lPath = ledgerPath(vaultPath);
  if (!fs.existsSync(lPath)) return [];

  const lines = fs.readFileSync(lPath, 'utf-8').split('\n').filter(Boolean);
  return lines.map(line => JSON.parse(line) as LedgerEntry);
}

export function readSince(vaultPath: string, since: string): LedgerEntry[] {
  return readAll(vaultPath).filter(e => e.ts >= since);
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

/** Get the current owner of a target (last claim without a subsequent release/done). */
export function currentOwner(vaultPath: string, target: string): string | null {
  const entries = readAll(vaultPath).filter(e => e.target === target);
  let owner: string | null = null;

  for (const e of entries) {
    if (e.op === 'claim') owner = e.actor;
    if (e.op === 'release' || e.op === 'done' || e.op === 'cancel') owner = null;
  }

  return owner;
}

/** Check if a target is currently claimed by any agent. */
export function isClaimed(vaultPath: string, target: string): boolean {
  return currentOwner(vaultPath, target) !== null;
}

/** Get all entries for a specific target. */
export function historyOf(vaultPath: string, target: string): LedgerEntry[] {
  return readAll(vaultPath).filter(e => e.target === target);
}

/** Get all entries by a specific actor. */
export function activityOf(vaultPath: string, actor: string): LedgerEntry[] {
  return readAll(vaultPath).filter(e => e.actor === actor);
}

/** Get all currently claimed targets and their owners. */
export function allClaims(vaultPath: string): Map<string, string> {
  const claims = new Map<string, string>();
  const entries = readAll(vaultPath);

  for (const e of entries) {
    if (e.op === 'claim') claims.set(e.target, e.actor);
    if (e.op === 'release' || e.op === 'done' || e.op === 'cancel') claims.delete(e.target);
  }

  return claims;
}

/** Get recent ledger entries (last N). */
export function recent(vaultPath: string, count: number = 20): LedgerEntry[] {
  const all = readAll(vaultPath);
  return all.slice(-count);
}
