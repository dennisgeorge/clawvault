import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadRegistry, saveRegistry, defineType, getType, listTypes, extendType, registryPath } from './registry.js';

let vaultPath: string;

beforeEach(() => {
  vaultPath = fs.mkdtempSync(path.join(os.tmpdir(), 'wg-registry-'));
  fs.mkdirSync(path.join(vaultPath, '.clawvault'), { recursive: true });
});

afterEach(() => {
  fs.rmSync(vaultPath, { recursive: true, force: true });
});

describe('registry', () => {
  it('seeds built-in types on first load', () => {
    const reg = loadRegistry(vaultPath);
    expect(reg.types.thread).toBeDefined();
    expect(reg.types.space).toBeDefined();
    expect(reg.types.decision).toBeDefined();
    expect(reg.types.lesson).toBeDefined();
    expect(reg.types.fact).toBeDefined();
    expect(reg.types.agent).toBeDefined();
    expect(reg.types.thread.builtIn).toBe(true);
  });

  it('persists registry to disk', () => {
    const reg = loadRegistry(vaultPath);
    saveRegistry(vaultPath, reg);
    expect(fs.existsSync(registryPath(vaultPath))).toBe(true);

    const loaded = loadRegistry(vaultPath);
    expect(loaded.types.thread.name).toBe('thread');
  });

  it('defines a new primitive type at runtime', () => {
    defineType(vaultPath, 'workflow', 'A sequence of staged work', {
      stages: { type: 'list', required: true, description: 'Ordered stage names' },
      current_stage: { type: 'string', default: '' },
      assigned_agents: { type: 'list', default: [] },
    }, 'agent-alpha');

    const wf = getType(vaultPath, 'workflow');
    expect(wf).toBeDefined();
    expect(wf!.name).toBe('workflow');
    expect(wf!.builtIn).toBe(false);
    expect(wf!.createdBy).toBe('agent-alpha');
    expect(wf!.fields.stages.type).toBe('list');
    expect(wf!.fields.title).toBeDefined();
    expect(wf!.fields.created).toBeDefined();
    expect(wf!.directory).toBe('workflows');
  });

  it('refuses to redefine built-in types', () => {
    expect(() => defineType(vaultPath, 'thread', 'override', {}, 'bad-actor'))
      .toThrow('Cannot redefine built-in type');
  });

  it('extends existing types with new fields', () => {
    const before = getType(vaultPath, 'thread');
    expect(before!.fields.estimated_hours).toBeUndefined();

    extendType(vaultPath, 'thread', {
      estimated_hours: { type: 'number', description: 'Time estimate' },
    }, 'agent-beta');

    const after = getType(vaultPath, 'thread');
    expect(after!.fields.estimated_hours).toBeDefined();
    expect(after!.fields.estimated_hours.type).toBe('number');
  });

  it('lists all types including custom ones', () => {
    defineType(vaultPath, 'review-gate', 'Approval checkpoint', {
      approver: { type: 'string', required: true },
      approved: { type: 'boolean', default: false },
    }, 'agent-gamma');

    const types = listTypes(vaultPath);
    const names = types.map(t => t.name);
    expect(names).toContain('thread');
    expect(names).toContain('review-gate');
  });

  it('sanitizes type names', () => {
    defineType(vaultPath, 'My Custom Type!', 'test', {}, 'agent');
    const t = getType(vaultPath, 'my-custom-type-');
    expect(t).toBeDefined();
  });

  it('ensures built-ins survive registry reload', () => {
    const reg = loadRegistry(vaultPath);
    delete reg.types.thread;
    saveRegistry(vaultPath, reg);

    const reloaded = loadRegistry(vaultPath);
    expect(reloaded.types.thread).toBeDefined();
  });
});
