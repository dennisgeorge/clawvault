/**
 * Workgraph type definitions.
 *
 * Three layers:
 *   1. Registry  — what primitive types exist (agent-extensible)
 *   2. Ledger    — what happened (append-only, source of truth for claims/state)
 *   3. Store     — the actual markdown files (the primitives themselves)
 */

// ---------------------------------------------------------------------------
// Primitive type registry
// ---------------------------------------------------------------------------

export interface FieldDefinition {
  type: 'string' | 'number' | 'boolean' | 'list' | 'date' | 'ref' | 'any';
  required?: boolean;
  default?: unknown;
  description?: string;
}

export interface PrimitiveTypeDefinition {
  name: string;
  description: string;
  fields: Record<string, FieldDefinition>;
  /** Directory under vault root where instances live (default: `<name>s/`). */
  directory: string;
  /** Whether this type was defined by an agent at runtime vs built-in. */
  builtIn: boolean;
  /** ISO timestamp of when this type was registered. */
  createdAt: string;
  /** Who registered it (agent name or "system"). */
  createdBy: string;
}

export interface Registry {
  version: number;
  types: Record<string, PrimitiveTypeDefinition>;
}

// ---------------------------------------------------------------------------
// Ledger events
// ---------------------------------------------------------------------------

export type LedgerOp =
  | 'create'
  | 'update'
  | 'delete'
  | 'claim'
  | 'release'
  | 'block'
  | 'unblock'
  | 'done'
  | 'cancel'
  | 'define'     // new primitive type registered
  | 'decompose'; // thread broken into sub-threads

export interface LedgerEntry {
  ts: string;            // ISO timestamp
  actor: string;         // who did this (agent name)
  op: LedgerOp;          // what operation
  target: string;        // file path relative to vault (e.g. "threads/auth.md")
  type?: string;         // primitive type name (e.g. "thread")
  data?: Record<string, unknown>; // operation-specific payload
}

// ---------------------------------------------------------------------------
// Thread status lifecycle
// ---------------------------------------------------------------------------

export type ThreadStatus =
  | 'open'       // created, available for claiming
  | 'active'     // claimed by an agent, work in progress
  | 'blocked'    // waiting on dependencies
  | 'done'       // completed successfully
  | 'cancelled'; // abandoned

export const THREAD_STATUS_TRANSITIONS: Record<ThreadStatus, ThreadStatus[]> = {
  open:      ['active', 'cancelled'],
  active:    ['blocked', 'done', 'cancelled', 'open'], // open = release
  blocked:   ['active', 'cancelled'],
  done:      [],       // terminal
  cancelled: ['open'], // can be reopened
};

// ---------------------------------------------------------------------------
// Primitive instance (parsed from markdown frontmatter)
// ---------------------------------------------------------------------------

export interface PrimitiveInstance {
  /** File path relative to vault root. */
  path: string;
  /** Primitive type name. */
  type: string;
  /** Frontmatter fields. */
  fields: Record<string, unknown>;
  /** Markdown body content. */
  body: string;
}
