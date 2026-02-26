import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createThread, claim, release, block, unblock, done, cancel, decompose } from './thread.js';
import { loadRegistry, saveRegistry } from './registry.js';
import * as ledger from './ledger.js';
import * as store from './store.js';

let vaultPath: string;

beforeEach(() => {
  vaultPath = fs.mkdtempSync(path.join(os.tmpdir(), 'wg-thread-'));
  const reg = loadRegistry(vaultPath);
  saveRegistry(vaultPath, reg);
});

afterEach(() => {
  fs.rmSync(vaultPath, { recursive: true, force: true });
});

describe('thread lifecycle', () => {
  it('creates a thread in open state', () => {
    const t = createThread(vaultPath, 'Build Auth', 'Implement JWT', 'agent-a');
    expect(t.fields.status).toBe('open');
    expect(t.fields.owner).toBeUndefined();
    expect(t.path).toBe('threads/build-auth.md');
  });

  it('claim sets status to active and records owner', () => {
    createThread(vaultPath, 'Claimable', 'test', 'agent-a');
    const claimed = claim(vaultPath, 'threads/claimable.md', 'agent-b');

    expect(claimed.fields.status).toBe('active');
    expect(claimed.fields.owner).toBe('agent-b');
    expect(ledger.currentOwner(vaultPath, 'threads/claimable.md')).toBe('agent-b');
  });

  it('prevents double claiming', () => {
    createThread(vaultPath, 'Contested', 'test', 'agent-a');
    claim(vaultPath, 'threads/contested.md', 'agent-b');

    expect(() => claim(vaultPath, 'threads/contested.md', 'agent-c'))
      .toThrow('Cannot claim thread in "active" state');
  });

  it('release returns thread to open state', () => {
    createThread(vaultPath, 'Releasable', 'test', 'agent-a');
    claim(vaultPath, 'threads/releasable.md', 'agent-b');
    const released = release(vaultPath, 'threads/releasable.md', 'agent-b', 'need more info');

    expect(released.fields.status).toBe('open');
    expect(released.fields.owner).toBeNull();
    expect(ledger.isClaimed(vaultPath, 'threads/releasable.md')).toBe(false);
  });

  it('release by non-owner fails', () => {
    createThread(vaultPath, 'Owned', 'test', 'agent-a');
    claim(vaultPath, 'threads/owned.md', 'agent-b');

    expect(() => release(vaultPath, 'threads/owned.md', 'agent-c'))
      .toThrow('owned by "agent-b"');
  });

  it('block sets status and adds dependency', () => {
    createThread(vaultPath, 'Blockable', 'test', 'agent-a');
    claim(vaultPath, 'threads/blockable.md', 'agent-a');
    const blocked = block(vaultPath, 'threads/blockable.md', 'agent-a', 'threads/dep.md', 'waiting for schema');

    expect(blocked.fields.status).toBe('blocked');
    expect(blocked.fields.deps).toContain('threads/dep.md');
  });

  it('unblock returns to active', () => {
    createThread(vaultPath, 'Unblockable', 'test', 'agent-a');
    claim(vaultPath, 'threads/unblockable.md', 'agent-a');
    block(vaultPath, 'threads/unblockable.md', 'agent-a', 'threads/dep.md');
    const unblocked = unblock(vaultPath, 'threads/unblockable.md', 'agent-a');

    expect(unblocked.fields.status).toBe('active');
  });

  it('done marks thread complete and appends output', () => {
    createThread(vaultPath, 'Completable', 'test', 'agent-a');
    claim(vaultPath, 'threads/completable.md', 'agent-a');
    const completed = done(vaultPath, 'threads/completable.md', 'agent-a', 'Auth system shipped');

    expect(completed.fields.status).toBe('done');
    expect(completed.body).toContain('Auth system shipped');
    expect(ledger.isClaimed(vaultPath, 'threads/completable.md')).toBe(false);
  });

  it('done by non-owner fails', () => {
    createThread(vaultPath, 'NotYours', 'test', 'agent-a');
    claim(vaultPath, 'threads/notyours.md', 'agent-a');

    expect(() => done(vaultPath, 'threads/notyours.md', 'agent-b'))
      .toThrow('owned by "agent-a"');
  });

  it('cancel stops a thread', () => {
    createThread(vaultPath, 'Cancellable', 'test', 'agent-a');
    const cancelled = cancel(vaultPath, 'threads/cancellable.md', 'agent-a', 'no longer needed');

    expect(cancelled.fields.status).toBe('cancelled');
  });

  it('decompose creates sub-threads with parent ref', () => {
    createThread(vaultPath, 'Big Task', 'do everything', 'agent-a');

    const children = decompose(vaultPath, 'threads/big-task.md', [
      { title: 'Sub A', goal: 'do A' },
      { title: 'Sub B', goal: 'do B', deps: ['threads/sub-a.md'] },
    ], 'agent-a');

    expect(children).toHaveLength(2);
    expect(children[0].fields.parent).toBe('threads/big-task.md');
    expect(children[1].fields.deps).toContain('threads/sub-a.md');

    const parent = store.read(vaultPath, 'threads/big-task.md');
    expect(parent!.body).toContain('Sub-threads');
    expect(parent!.body).toContain('sub-a.md');
    expect(parent!.body).toContain('sub-b.md');

    const decompEntries = ledger.readAll(vaultPath).filter(e => e.op === 'decompose');
    expect(decompEntries).toHaveLength(1);
    expect(decompEntries[0].data?.children).toHaveLength(2);
  });

  it('full lifecycle: create → claim → block → unblock → done', () => {
    createThread(vaultPath, 'Full Cycle', 'test lifecycle', 'agent-a');
    claim(vaultPath, 'threads/full-cycle.md', 'agent-b');
    block(vaultPath, 'threads/full-cycle.md', 'agent-b', 'threads/dep.md');
    unblock(vaultPath, 'threads/full-cycle.md', 'agent-b');
    done(vaultPath, 'threads/full-cycle.md', 'agent-b', 'All done');

    const t = store.read(vaultPath, 'threads/full-cycle.md');
    expect(t!.fields.status).toBe('done');

    const history = ledger.historyOf(vaultPath, 'threads/full-cycle.md');
    const ops = history.map(e => e.op);
    expect(ops).toContain('create');
    expect(ops).toContain('claim');
    expect(ops).toContain('block');
    expect(ops).toContain('unblock');
    expect(ops).toContain('done');
  });

  it('another agent can claim after release', () => {
    createThread(vaultPath, 'Handoff', 'test handoff', 'agent-a');
    claim(vaultPath, 'threads/handoff.md', 'agent-a');
    release(vaultPath, 'threads/handoff.md', 'agent-a');
    const reclaimed = claim(vaultPath, 'threads/handoff.md', 'agent-b');

    expect(reclaimed.fields.status).toBe('active');
    expect(reclaimed.fields.owner).toBe('agent-b');
  });

  it('invalid state transitions are rejected', () => {
    createThread(vaultPath, 'Bad Transition', 'test', 'agent-a');
    claim(vaultPath, 'threads/bad-transition.md', 'agent-a');
    done(vaultPath, 'threads/bad-transition.md', 'agent-a');

    expect(() => claim(vaultPath, 'threads/bad-transition.md', 'agent-b'))
      .toThrow('Cannot claim thread in "done" state');
  });
});
