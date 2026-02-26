import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { append, readAll, readSince, currentOwner, isClaimed, historyOf, activityOf, allClaims, recent } from './ledger.js';

let vaultPath: string;

beforeEach(() => {
  vaultPath = fs.mkdtempSync(path.join(os.tmpdir(), 'wg-ledger-'));
});

afterEach(() => {
  fs.rmSync(vaultPath, { recursive: true, force: true });
});

describe('ledger', () => {
  it('appends entries and reads them back', () => {
    append(vaultPath, 'agent-a', 'create', 'threads/auth.md', 'thread');
    append(vaultPath, 'agent-a', 'claim', 'threads/auth.md', 'thread');

    const entries = readAll(vaultPath);
    expect(entries).toHaveLength(2);
    expect(entries[0].op).toBe('create');
    expect(entries[1].op).toBe('claim');
    expect(entries[1].actor).toBe('agent-a');
  });

  it('returns empty array for non-existent ledger', () => {
    expect(readAll(vaultPath)).toEqual([]);
  });

  it('tracks current owner through claim/release cycle', () => {
    const target = 'threads/auth.md';

    expect(currentOwner(vaultPath, target)).toBeNull();

    append(vaultPath, 'agent-a', 'claim', target);
    expect(currentOwner(vaultPath, target)).toBe('agent-a');

    append(vaultPath, 'agent-a', 'release', target);
    expect(currentOwner(vaultPath, target)).toBeNull();

    append(vaultPath, 'agent-b', 'claim', target);
    expect(currentOwner(vaultPath, target)).toBe('agent-b');

    append(vaultPath, 'agent-b', 'done', target);
    expect(currentOwner(vaultPath, target)).toBeNull();
  });

  it('checks if a target is claimed', () => {
    const target = 'threads/auth.md';
    expect(isClaimed(vaultPath, target)).toBe(false);

    append(vaultPath, 'agent-a', 'claim', target);
    expect(isClaimed(vaultPath, target)).toBe(true);

    append(vaultPath, 'agent-a', 'release', target);
    expect(isClaimed(vaultPath, target)).toBe(false);
  });

  it('returns history of a specific target', () => {
    append(vaultPath, 'agent-a', 'create', 'threads/auth.md');
    append(vaultPath, 'agent-a', 'create', 'threads/db.md');
    append(vaultPath, 'agent-a', 'claim', 'threads/auth.md');

    const history = historyOf(vaultPath, 'threads/auth.md');
    expect(history).toHaveLength(2);
  });

  it('returns activity of a specific actor', () => {
    append(vaultPath, 'agent-a', 'create', 'threads/auth.md');
    append(vaultPath, 'agent-b', 'create', 'threads/db.md');
    append(vaultPath, 'agent-a', 'claim', 'threads/auth.md');

    const activity = activityOf(vaultPath, 'agent-a');
    expect(activity).toHaveLength(2);
  });

  it('returns all current claims', () => {
    append(vaultPath, 'agent-a', 'claim', 'threads/auth.md');
    append(vaultPath, 'agent-b', 'claim', 'threads/db.md');
    append(vaultPath, 'agent-a', 'done', 'threads/auth.md');

    const claims = allClaims(vaultPath);
    expect(claims.size).toBe(1);
    expect(claims.get('threads/db.md')).toBe('agent-b');
  });

  it('returns recent entries', () => {
    for (let i = 0; i < 30; i++) {
      append(vaultPath, 'agent', 'create', `threads/t${i}.md`);
    }
    const last10 = recent(vaultPath, 10);
    expect(last10).toHaveLength(10);
    expect(last10[0].target).toBe('threads/t20.md');
  });

  it('stores optional data payload', () => {
    append(vaultPath, 'agent-a', 'block', 'threads/auth.md', 'thread', {
      blocked_by: 'threads/db.md',
      reason: 'Need DB schema first',
    });

    const entries = readAll(vaultPath);
    expect(entries[0].data?.blocked_by).toBe('threads/db.md');
    expect(entries[0].data?.reason).toBe('Need DB schema first');
  });

  it('filters entries since a timestamp', () => {
    append(vaultPath, 'agent-a', 'create', 'threads/old.md');
    const cutoff = new Date().toISOString();
    append(vaultPath, 'agent-b', 'create', 'threads/new.md');

    const recent = readSince(vaultPath, cutoff);
    expect(recent.length).toBeGreaterThanOrEqual(1);
    expect(recent.some(e => e.target === 'threads/new.md')).toBe(true);
  });
});
