/**
 * Multi-agent coordination test.
 *
 * Simulates two agents coordinating on a real task:
 *   1. Agent-Lead defines a custom "milestone" primitive type
 *   2. Agent-Lead creates a plan as threads with dependencies
 *   3. Agent-Worker picks up available work
 *   4. Agent-Worker gets blocked, signals it
 *   5. Agent-Lead resolves the blocker
 *   6. Agent-Worker completes the work
 *   7. Both agents can see the full audit trail
 *
 * This proves: dynamic primitives, claim exclusivity, audit trail,
 * dependency tracking, and compounding abstraction.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadRegistry, saveRegistry, defineType, getType, listTypes } from './registry.js';
import * as ledger from './ledger.js';
import * as store from './store.js';
import * as thread from './thread.js';

let vaultPath: string;

beforeEach(() => {
  vaultPath = fs.mkdtempSync(path.join(os.tmpdir(), 'wg-coord-'));
  const reg = loadRegistry(vaultPath);
  saveRegistry(vaultPath, reg);
});

afterEach(() => {
  fs.rmSync(vaultPath, { recursive: true, force: true });
});

describe('multi-agent coordination', () => {
  it('two agents coordinate on a decomposed task with custom primitives', () => {
    const LEAD = 'agent-lead';
    const WORKER = 'agent-worker';

    // 1. Lead defines a custom "milestone" primitive type (compounding abstraction)
    const milestoneDef = defineType(vaultPath, 'milestone', 'A project checkpoint with deliverables', {
      deliverables: { type: 'list', default: [], description: 'Expected outputs' },
      thread_refs: { type: 'list', default: [], description: 'Threads that contribute to this milestone' },
      target_date: { type: 'date', description: 'When this milestone should be hit' },
      status: { type: 'string', default: 'pending', description: 'pending | achieved | missed' },
    }, LEAD);

    expect(milestoneDef.name).toBe('milestone');
    expect(milestoneDef.builtIn).toBe(false);
    expect(milestoneDef.createdBy).toBe(LEAD);

    // Verify agent-defined type shows up in registry
    const types = listTypes(vaultPath);
    expect(types.map(t => t.name)).toContain('milestone');

    // 2. Lead creates a parent thread and decomposes it
    const parentThread = thread.createThread(vaultPath,
      'Build User Auth System', 'Complete JWT-based auth with refresh tokens', LEAD,
      { priority: 'high', tags: ['auth', 'backend'] });

    expect(parentThread.fields.status).toBe('open');

    const children = thread.decompose(vaultPath, parentThread.path, [
      { title: 'Design DB Schema', goal: 'Create user and session tables' },
      { title: 'Implement JWT Service', goal: 'Token generation, validation, refresh', deps: ['threads/design-db-schema.md'] },
      { title: 'Add Auth Middleware', goal: 'Express middleware for protected routes', deps: ['threads/implement-jwt-service.md'] },
    ], LEAD);

    expect(children).toHaveLength(3);
    expect(children[1].fields.deps).toContain('threads/design-db-schema.md');

    // 3. Lead creates a milestone using the custom primitive
    const m1 = store.create(vaultPath, 'milestone', {
      title: 'Auth MVP',
      deliverables: ['JWT tokens working', 'Protected routes', 'Refresh flow'],
      thread_refs: children.map(c => c.path),
      target_date: '2026-03-15',
    }, '# Auth MVP Milestone\n\nAll auth components shipped and tested.', LEAD);

    expect(m1.path).toBe('milestones/auth-mvp.md');

    // 4. Worker sees available threads and claims one
    const open = store.openThreads(vaultPath);
    expect(open.length).toBeGreaterThanOrEqual(3);

    const dbSchema = open.find(t => String(t.fields.title).includes('DB Schema'));
    expect(dbSchema).toBeDefined();

    thread.claim(vaultPath, dbSchema!.path, WORKER);
    expect(ledger.currentOwner(vaultPath, dbSchema!.path)).toBe(WORKER);

    // 5. Lead tries to claim the same thread — FAILS (exclusivity!)
    expect(() => thread.claim(vaultPath, dbSchema!.path, LEAD))
      .toThrow('Cannot claim');

    // 6. Worker completes the DB schema thread
    thread.done(vaultPath, dbSchema!.path, WORKER,
      'Created users and sessions tables with indices. Schema in migrations/001_auth.sql.');

    const completed = store.read(vaultPath, dbSchema!.path);
    expect(completed!.fields.status).toBe('done');
    expect(completed!.body).toContain('migrations/001_auth.sql');

    // 7. Worker claims the JWT service (was blocked on DB schema, now unblocked)
    const jwtThread = children.find(c => String(c.fields.title).includes('JWT'));
    thread.claim(vaultPath, jwtThread!.path, WORKER);

    // Worker gets blocked on an external dependency
    thread.block(vaultPath, jwtThread!.path, WORKER, 'external/key-management', 'Need KMS access');

    const blockedThreads = store.blockedThreads(vaultPath);
    expect(blockedThreads).toHaveLength(1);

    // Lead resolves the blocker
    thread.unblock(vaultPath, jwtThread!.path, LEAD);

    // Worker completes JWT service
    thread.done(vaultPath, jwtThread!.path, WORKER, 'JWT service with RS256 signing, 15min access, 7d refresh.');

    // 8. Verify the full audit trail
    const allEntries = ledger.readAll(vaultPath);
    expect(allEntries.length).toBeGreaterThan(10);

    const claimEntries = allEntries.filter(e => e.op === 'claim');
    expect(claimEntries).toHaveLength(2);
    expect(claimEntries.every(e => e.actor === WORKER)).toBe(true);

    const doneEntries = allEntries.filter(e => e.op === 'done');
    expect(doneEntries).toHaveLength(2);

    const blockEntries = allEntries.filter(e => e.op === 'block');
    expect(blockEntries).toHaveLength(1);
    expect(blockEntries[0].data?.blocked_by).toBe('external/key-management');

    // 9. Verify the milestone can reference all thread states
    const milestoneInst = store.read(vaultPath, m1.path);
    expect(milestoneInst).not.toBeNull();
    expect(milestoneInst!.fields.thread_refs).toHaveLength(3);

    // 10. Lead's activity vs Worker's activity
    const leadActivity = ledger.activityOf(vaultPath, LEAD);
    const workerActivity = ledger.activityOf(vaultPath, WORKER);
    expect(leadActivity.length).toBeGreaterThan(0);
    expect(workerActivity.length).toBeGreaterThan(0);

    // Lead did: create threads, decompose, create milestone, unblock
    expect(leadActivity.some(e => e.op === 'decompose')).toBe(true);
    expect(leadActivity.some(e => e.op === 'unblock')).toBe(true);

    // Worker did: claim, done, block
    expect(workerActivity.some(e => e.op === 'claim')).toBe(true);
    expect(workerActivity.some(e => e.op === 'done')).toBe(true);
    expect(workerActivity.some(e => e.op === 'block')).toBe(true);
  });

  it('compounding abstraction: agent builds on another agent\'s primitive', () => {
    const ARCHITECT = 'agent-architect';
    const BUILDER = 'agent-builder';
    const PM = 'agent-pm';

    // Architect defines a "component" primitive
    defineType(vaultPath, 'component', 'A software component with API surface', {
      language: { type: 'string' },
      api_surface: { type: 'list', default: [] },
      depends_on: { type: 'list', default: [] },
    }, ARCHITECT);

    // Builder defines a "test-plan" primitive that references components
    defineType(vaultPath, 'test-plan', 'Test strategy for a component', {
      component_ref: { type: 'ref', required: true },
      coverage_target: { type: 'number', default: 80 },
      test_types: { type: 'list', default: ['unit', 'integration'] },
    }, BUILDER);

    // PM defines a "release" primitive that bundles components + test plans
    defineType(vaultPath, 'release', 'A release bundle', {
      version: { type: 'string', required: true },
      component_refs: { type: 'list', default: [] },
      test_plan_refs: { type: 'list', default: [] },
      go_no_go: { type: 'string', default: 'pending' },
    }, PM);

    // Now all three types exist and can be instantiated
    const comp = store.create(vaultPath, 'component', {
      title: 'Auth Service',
      language: 'typescript',
      api_surface: ['POST /login', 'POST /refresh', 'DELETE /logout'],
    }, '# Auth Service Component', ARCHITECT);

    const testPlan = store.create(vaultPath, 'test-plan', {
      title: 'Auth Service Tests',
      component_ref: comp.path,
      coverage_target: 90,
      test_types: ['unit', 'integration', 'e2e'],
    }, '# Auth Test Plan', BUILDER);

    const rel = store.create(vaultPath, 'release', {
      title: 'v2.0.0 Release',
      version: '2.0.0',
      component_refs: [comp.path],
      test_plan_refs: [testPlan.path],
    }, '# Release v2.0.0', PM);

    // Verify all three layers of abstraction exist
    expect(store.list(vaultPath, 'component')).toHaveLength(1);
    expect(store.list(vaultPath, 'test-plan')).toHaveLength(1);
    expect(store.list(vaultPath, 'release')).toHaveLength(1);

    // Verify cross-references work
    const loadedRel = store.read(vaultPath, rel.path);
    expect(loadedRel!.fields.component_refs).toContain(comp.path);
    expect(loadedRel!.fields.test_plan_refs).toContain(testPlan.path);

    // Verify the registry has all three custom types
    const allTypes = listTypes(vaultPath);
    const customTypes = allTypes.filter(t => !t.builtIn);
    expect(customTypes).toHaveLength(3);
    expect(customTypes.map(t => t.createdBy).sort()).toEqual([ARCHITECT, BUILDER, PM].sort());

    // Verify full audit trail shows the compounding
    const defineEntries = ledger.readAll(vaultPath).filter(e => e.op === 'define');
    expect(defineEntries).toHaveLength(0); // defines aren't logged yet, but creates are
    const createEntries = ledger.readAll(vaultPath).filter(e => e.op === 'create');
    expect(createEntries).toHaveLength(3);
    expect(new Set(createEntries.map(e => e.type))).toEqual(new Set(['component', 'test-plan', 'release']));
  });
});
