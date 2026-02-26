import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { create, read, list, update, remove, findByField, openThreads } from './store.js';
import { defineType, loadRegistry, saveRegistry } from './registry.js';
import * as ledger from './ledger.js';

let vaultPath: string;

beforeEach(() => {
  vaultPath = fs.mkdtempSync(path.join(os.tmpdir(), 'wg-store-'));
  const reg = loadRegistry(vaultPath);
  saveRegistry(vaultPath, reg);
});

afterEach(() => {
  fs.rmSync(vaultPath, { recursive: true, force: true });
});

describe('store', () => {
  it('creates a primitive instance and writes markdown', () => {
    const inst = create(vaultPath, 'thread', {
      title: 'Build Auth System',
      goal: 'Implement JWT auth',
    }, '## Goal\n\nImplement JWT auth\n', 'agent-alpha');

    expect(inst.path).toBe('threads/build-auth-system.md');
    expect(inst.fields.title).toBe('Build Auth System');
    expect(inst.fields.status).toBe('open');
    expect(inst.fields.deps).toEqual([]);

    const absPath = path.join(vaultPath, inst.path);
    expect(fs.existsSync(absPath)).toBe(true);
  });

  it('reads a primitive back from disk', () => {
    create(vaultPath, 'thread', {
      title: 'Auth Thread',
      goal: 'Build auth',
    }, 'Body content', 'agent-alpha');

    const inst = read(vaultPath, 'threads/auth-thread.md');
    expect(inst).not.toBeNull();
    expect(inst!.fields.title).toBe('Auth Thread');
    expect(inst!.body).toBe('Body content');
    expect(inst!.type).toBe('thread');
  });

  it('lists all instances of a type', () => {
    create(vaultPath, 'thread', { title: 'Thread A', goal: 'A' }, '', 'agent');
    create(vaultPath, 'thread', { title: 'Thread B', goal: 'B' }, '', 'agent');
    create(vaultPath, 'decision', { title: 'Decision X' }, '', 'agent');

    const threads = list(vaultPath, 'thread');
    expect(threads).toHaveLength(2);

    const decisions = list(vaultPath, 'decision');
    expect(decisions).toHaveLength(1);
  });

  it('updates a primitive', () => {
    create(vaultPath, 'thread', { title: 'Update Me', goal: 'test' }, 'old body', 'agent');

    const updated = update(vaultPath, 'threads/update-me.md', {
      status: 'active',
      owner: 'agent-beta',
    }, 'new body', 'agent-beta');

    expect(updated.fields.status).toBe('active');
    expect(updated.fields.owner).toBe('agent-beta');
    expect(updated.body).toBe('new body');
  });

  it('soft-deletes (archives) a primitive', () => {
    create(vaultPath, 'thread', { title: 'Delete Me', goal: 'test' }, '', 'agent');
    remove(vaultPath, 'threads/delete-me.md', 'agent');

    expect(read(vaultPath, 'threads/delete-me.md')).toBeNull();
    expect(fs.existsSync(path.join(vaultPath, '.clawvault/archive/delete-me.md'))).toBe(true);
  });

  it('applies field defaults from type definition', () => {
    const inst = create(vaultPath, 'thread', {
      title: 'Defaults Test',
      goal: 'test defaults',
    }, '', 'agent');

    expect(inst.fields.status).toBe('open');
    expect(inst.fields.priority).toBe('medium');
    expect(inst.fields.deps).toEqual([]);
    expect(inst.fields.tags).toEqual([]);
  });

  it('logs all mutations to the ledger', () => {
    create(vaultPath, 'thread', { title: 'Logged', goal: 'test' }, '', 'agent-a');
    update(vaultPath, 'threads/logged.md', { priority: 'high' }, undefined, 'agent-a');

    const entries = ledger.readAll(vaultPath);
    expect(entries.length).toBeGreaterThanOrEqual(2);
    expect(entries[0].op).toBe('create');
    expect(entries[1].op).toBe('update');
  });

  it('throws on unknown type', () => {
    expect(() => create(vaultPath, 'nonexistent', { title: 'X' }, '', 'agent'))
      .toThrow('Unknown primitive type');
  });

  it('throws on duplicate file', () => {
    create(vaultPath, 'thread', { title: 'Dupe', goal: 'test' }, '', 'agent');
    expect(() => create(vaultPath, 'thread', { title: 'Dupe', goal: 'test2' }, '', 'agent'))
      .toThrow('already exists');
  });

  it('works with agent-defined types', () => {
    defineType(vaultPath, 'playbook', 'Reusable workflow template', {
      stages: { type: 'list', default: [] },
      owner: { type: 'string' },
    }, 'agent-builder');

    const inst = create(vaultPath, 'playbook', {
      title: 'Incident Response',
      stages: ['triage', 'investigate', 'mitigate', 'postmortem'],
      owner: 'sre-team',
    }, '# Incident Response Playbook\n', 'agent-builder');

    expect(inst.path).toBe('playbooks/incident-response.md');
    expect(inst.fields.stages).toEqual(['triage', 'investigate', 'mitigate', 'postmortem']);

    const loaded = read(vaultPath, 'playbooks/incident-response.md');
    expect(loaded!.fields.stages).toEqual(['triage', 'investigate', 'mitigate', 'postmortem']);
  });

  it('finds instances by field value', () => {
    create(vaultPath, 'thread', { title: 'T1', goal: 'g1', priority: 'high' }, '', 'a');
    create(vaultPath, 'thread', { title: 'T2', goal: 'g2', priority: 'low' }, '', 'a');
    create(vaultPath, 'thread', { title: 'T3', goal: 'g3', priority: 'high' }, '', 'a');

    const highPriority = findByField(vaultPath, 'thread', 'priority', 'high');
    expect(highPriority).toHaveLength(2);
  });

  it('finds open threads', () => {
    create(vaultPath, 'thread', { title: 'Open 1', goal: 'g' }, '', 'a');
    create(vaultPath, 'thread', { title: 'Open 2', goal: 'g' }, '', 'a');
    create(vaultPath, 'thread', { title: 'Active', goal: 'g', status: 'active' }, '', 'a');

    const open = openThreads(vaultPath);
    expect(open).toHaveLength(2);
  });
});
