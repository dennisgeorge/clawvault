/**
 * Workgraph — composable primitives for multi-agent coordination.
 *
 * Three layers:
 *   Registry  — what primitive types exist (agent-extensible at runtime)
 *   Ledger    — what happened (append-only audit trail, coordination source of truth)
 *   Store     — the markdown files themselves (the actual primitives)
 *
 * Built-in primitives: thread, space, decision, lesson, fact, agent
 * Agents can define new types: `clawvault primitive define <name>`
 * Everything composes through wiki-links in markdown.
 */

export * from './types.js';
export * as registry from './registry.js';
export * as ledger from './ledger.js';
export * as store from './store.js';
export * as thread from './thread.js';
