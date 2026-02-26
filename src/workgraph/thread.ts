/**
 * Thread lifecycle operations.
 *
 * Threads are the core coordination primitive. This module handles the
 * claim/release/block/done lifecycle with ledger-backed exclusivity.
 */

import * as ledger from './ledger.js';
import * as store from './store.js';
import type { PrimitiveInstance, ThreadStatus } from './types.js';
import { THREAD_STATUS_TRANSITIONS } from './types.js';

// ---------------------------------------------------------------------------
// Thread creation
// ---------------------------------------------------------------------------

export function createThread(
  vaultPath: string,
  title: string,
  goal: string,
  actor: string,
  opts: {
    priority?: string;
    deps?: string[];
    parent?: string;
    context_refs?: string[];
    tags?: string[];
  } = {},
): PrimitiveInstance {
  return store.create(vaultPath, 'thread', {
    title,
    goal,
    status: 'open',
    priority: opts.priority ?? 'medium',
    deps: opts.deps ?? [],
    parent: opts.parent,
    context_refs: opts.context_refs ?? [],
    tags: opts.tags ?? [],
  }, `## Goal\n\n${goal}\n`, actor);
}

// ---------------------------------------------------------------------------
// Claim / Release
// ---------------------------------------------------------------------------

export function claim(
  vaultPath: string,
  threadPath: string,
  actor: string,
): PrimitiveInstance {
  const thread = store.read(vaultPath, threadPath);
  if (!thread) throw new Error(`Thread not found: ${threadPath}`);

  const status = thread.fields.status as ThreadStatus;
  if (status !== 'open') {
    throw new Error(`Cannot claim thread in "${status}" state. Only "open" threads can be claimed.`);
  }

  const owner = ledger.currentOwner(vaultPath, threadPath);
  if (owner) {
    throw new Error(`Thread already claimed by "${owner}". Wait for release or use a different thread.`);
  }

  ledger.append(vaultPath, actor, 'claim', threadPath, 'thread');

  return store.update(vaultPath, threadPath, {
    status: 'active',
    owner: actor,
  }, undefined, actor);
}

export function release(
  vaultPath: string,
  threadPath: string,
  actor: string,
  reason?: string,
): PrimitiveInstance {
  const thread = store.read(vaultPath, threadPath);
  if (!thread) throw new Error(`Thread not found: ${threadPath}`);

  assertOwner(vaultPath, threadPath, actor);

  ledger.append(vaultPath, actor, 'release', threadPath, 'thread',
    reason ? { reason } : undefined);

  return store.update(vaultPath, threadPath, {
    status: 'open',
    owner: null,
  }, undefined, actor);
}

// ---------------------------------------------------------------------------
// Status transitions
// ---------------------------------------------------------------------------

export function block(
  vaultPath: string,
  threadPath: string,
  actor: string,
  blockedBy: string,
  reason?: string,
): PrimitiveInstance {
  const thread = store.read(vaultPath, threadPath);
  if (!thread) throw new Error(`Thread not found: ${threadPath}`);

  assertTransition(thread.fields.status as ThreadStatus, 'blocked');

  ledger.append(vaultPath, actor, 'block', threadPath, 'thread', {
    blocked_by: blockedBy,
    ...(reason ? { reason } : {}),
  });

  const currentDeps = (thread.fields.deps as string[]) ?? [];
  const updatedDeps = currentDeps.includes(blockedBy) ? currentDeps : [...currentDeps, blockedBy];

  return store.update(vaultPath, threadPath, {
    status: 'blocked',
    deps: updatedDeps,
  }, undefined, actor);
}

export function unblock(
  vaultPath: string,
  threadPath: string,
  actor: string,
): PrimitiveInstance {
  const thread = store.read(vaultPath, threadPath);
  if (!thread) throw new Error(`Thread not found: ${threadPath}`);

  assertTransition(thread.fields.status as ThreadStatus, 'active');

  ledger.append(vaultPath, actor, 'unblock', threadPath, 'thread');

  return store.update(vaultPath, threadPath, {
    status: 'active',
  }, undefined, actor);
}

export function done(
  vaultPath: string,
  threadPath: string,
  actor: string,
  output?: string,
): PrimitiveInstance {
  const thread = store.read(vaultPath, threadPath);
  if (!thread) throw new Error(`Thread not found: ${threadPath}`);

  assertTransition(thread.fields.status as ThreadStatus, 'done');
  assertOwner(vaultPath, threadPath, actor);

  ledger.append(vaultPath, actor, 'done', threadPath, 'thread',
    output ? { output } : undefined);

  const newBody = output
    ? `${thread.body}\n\n## Output\n\n${output}\n`
    : thread.body;

  return store.update(vaultPath, threadPath, {
    status: 'done',
  }, newBody, actor);
}

export function cancel(
  vaultPath: string,
  threadPath: string,
  actor: string,
  reason?: string,
): PrimitiveInstance {
  const thread = store.read(vaultPath, threadPath);
  if (!thread) throw new Error(`Thread not found: ${threadPath}`);

  assertTransition(thread.fields.status as ThreadStatus, 'cancelled');

  ledger.append(vaultPath, actor, 'cancel', threadPath, 'thread',
    reason ? { reason } : undefined);

  return store.update(vaultPath, threadPath, {
    status: 'cancelled',
    owner: null,
  }, undefined, actor);
}

// ---------------------------------------------------------------------------
// Decompose — break a thread into sub-threads
// ---------------------------------------------------------------------------

export function decompose(
  vaultPath: string,
  parentPath: string,
  subthreads: Array<{ title: string; goal: string; deps?: string[] }>,
  actor: string,
): PrimitiveInstance[] {
  const parent = store.read(vaultPath, parentPath);
  if (!parent) throw new Error(`Thread not found: ${parentPath}`);

  const created: PrimitiveInstance[] = [];

  for (const sub of subthreads) {
    const inst = createThread(vaultPath, sub.title, sub.goal, actor, {
      parent: parentPath,
      deps: sub.deps,
    });
    created.push(inst);
  }

  const childRefs = created.map(c => `[[${c.path}]]`);
  const decomposeNote = `\n\n## Sub-threads\n\n${childRefs.map(r => `- ${r}`).join('\n')}\n`;

  store.update(vaultPath, parentPath, {}, parent.body + decomposeNote, actor);

  ledger.append(vaultPath, actor, 'decompose', parentPath, 'thread', {
    children: created.map(c => c.path),
  });

  return created;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assertTransition(from: ThreadStatus, to: ThreadStatus): void {
  const allowed = THREAD_STATUS_TRANSITIONS[from];
  if (!allowed?.includes(to)) {
    throw new Error(`Invalid transition: "${from}" → "${to}". Allowed: ${allowed?.join(', ') ?? 'none'}`);
  }
}

function assertOwner(vaultPath: string, threadPath: string, actor: string): void {
  const owner = ledger.currentOwner(vaultPath, threadPath);
  if (owner && owner !== actor) {
    throw new Error(`Thread is owned by "${owner}", not "${actor}". Only the owner can perform this action.`);
  }
}
