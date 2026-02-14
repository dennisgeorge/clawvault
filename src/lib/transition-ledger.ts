/**
 * Transition Ledger for ClawVault
 * Logs task status transitions to JSONL files and supports querying.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { TaskStatus } from './task-utils.js';

export interface TransitionEvent {
  task_id: string;
  agent_id: string;
  from_status: TaskStatus;
  to_status: TaskStatus;
  timestamp: string;
  confidence: number;
  cost_tokens: number | null;
  reason: string | null;
}

/** Transitions that indicate a regression */
const REGRESSION_PAIRS: Array<[TaskStatus, TaskStatus]> = [
  ['done', 'open'],
  ['done', 'blocked'],
  ['in-progress', 'blocked'],
];

export function isRegression(from: TaskStatus, to: TaskStatus): boolean {
  return REGRESSION_PAIRS.some(([f, t]) => f === from && t === to);
}

/**
 * Get the ledger directory for transitions
 */
export function getLedgerDir(vaultPath: string): string {
  return path.join(path.resolve(vaultPath), 'ledger', 'transitions');
}

/**
 * Get today's ledger file path
 */
function getTodayLedgerPath(vaultPath: string): string {
  const date = new Date().toISOString().split('T')[0];
  return path.join(getLedgerDir(vaultPath), `${date}.jsonl`);
}

/**
 * Append a transition event to the ledger
 */
export function appendTransition(
  vaultPath: string,
  event: TransitionEvent
): void {
  const ledgerDir = getLedgerDir(vaultPath);
  if (!fs.existsSync(ledgerDir)) {
    fs.mkdirSync(ledgerDir, { recursive: true });
  }
  const filePath = getTodayLedgerPath(vaultPath);
  fs.appendFileSync(filePath, JSON.stringify(event) + '\n');
}

/**
 * Build a transition event from context
 */
export function buildTransitionEvent(
  taskId: string,
  fromStatus: TaskStatus,
  toStatus: TaskStatus,
  options: { confidence?: number; reason?: string } = {}
): TransitionEvent {
  const agentId = process.env.OPENCLAW_AGENT_ID || 'manual';
  const costTokensRaw = process.env.OPENCLAW_TOKEN_ESTIMATE;
  const costTokens = costTokensRaw ? parseInt(costTokensRaw, 10) : null;

  return {
    task_id: taskId,
    agent_id: agentId,
    from_status: fromStatus,
    to_status: toStatus,
    timestamp: new Date().toISOString(),
    confidence: options.confidence ?? (agentId === 'manual' ? 1.0 : 1.0),
    cost_tokens: costTokens !== null && !isNaN(costTokens) ? costTokens : null,
    reason: options.reason || null,
  };
}

/**
 * Read all transition events from all ledger files
 */
export function readAllTransitions(vaultPath: string): TransitionEvent[] {
  const ledgerDir = getLedgerDir(vaultPath);
  if (!fs.existsSync(ledgerDir)) return [];

  const files = fs.readdirSync(ledgerDir)
    .filter(f => f.endsWith('.jsonl'))
    .sort();

  const events: TransitionEvent[] = [];
  for (const file of files) {
    const lines = fs.readFileSync(path.join(ledgerDir, file), 'utf-8')
      .split('\n')
      .filter(l => l.trim());
    for (const line of lines) {
      try {
        events.push(JSON.parse(line));
      } catch {
        // skip malformed lines
      }
    }
  }
  return events;
}

/**
 * Query transitions with filters
 */
export function queryTransitions(
  vaultPath: string,
  filters: {
    taskId?: string;
    agent?: string;
    failed?: boolean;
  } = {}
): TransitionEvent[] {
  let events = readAllTransitions(vaultPath);

  if (filters.taskId) {
    events = events.filter(e => e.task_id === filters.taskId);
  }
  if (filters.agent) {
    events = events.filter(e => e.agent_id === filters.agent);
  }
  if (filters.failed) {
    events = events.filter(e => isRegression(e.from_status, e.to_status));
  }

  return events;
}

/**
 * Count blocked transitions for a task
 */
export function countBlockedTransitions(vaultPath: string, taskId: string): number {
  const events = readAllTransitions(vaultPath);
  return events.filter(e => e.task_id === taskId && e.to_status === 'blocked').length;
}

/**
 * Format transitions as a table string
 */
export function formatTransitionsTable(events: TransitionEvent[]): string {
  if (events.length === 0) return 'No transitions found.\n';

  const headers = ['TIMESTAMP', 'TASK', 'FROM→TO', 'AGENT', 'REASON'];
  const widths = [20, 20, 24, 16, 30];

  let output = headers.map((h, i) => h.padEnd(widths[i])).join('  ') + '\n';
  output += '-'.repeat(widths.reduce((a, b) => a + b + 2, 0)) + '\n';

  for (const e of events) {
    const ts = e.timestamp.replace('T', ' ').slice(0, 19);
    const taskId = e.task_id.length > widths[1] ? e.task_id.slice(0, widths[1] - 3) + '...' : e.task_id;
    const transition = `${e.from_status} → ${e.to_status}`;
    const reason = e.reason ? (e.reason.length > widths[4] ? e.reason.slice(0, widths[4] - 3) + '...' : e.reason) : '-';

    output += [
      ts.padEnd(widths[0]),
      taskId.padEnd(widths[1]),
      transition.padEnd(widths[2]),
      e.agent_id.padEnd(widths[3]),
      reason,
    ].join('  ') + '\n';
  }

  return output;
}
