/**
 * Workgraph CLI commands — agent-native coordination tools.
 *
 * Commands under 'clawvault wg' namespace:
 *   - wg status         Agent morning briefing with rich terminal output
 *   - wg thread create  Create a new thread
 *   - wg thread list    List threads with filters
 *   - wg thread claim   Claim a thread for work
 *   - wg thread done    Mark thread complete
 *   - wg thread block   Block thread on dependency
 *   - wg thread release Release thread back to pool
 *   - wg thread decompose  Break thread into sub-threads
 *   - wg ledger         View coordination history
 *   - wg define         Define new primitive type
 *   - wg types          List all primitive types
 *   - wg create         Create any primitive
 *   - wg board          Terminal kanban board
 */

import os from 'node:os';
import path from 'node:path';
import type { Command } from 'commander';
import chalk from 'chalk';
import * as registry from '../workgraph/registry.js';
import * as ledger from '../workgraph/ledger.js';
import * as store from '../workgraph/store.js';
import * as thread from '../workgraph/thread.js';
import type {
  PrimitiveInstance,
  ThreadStatus,
  FieldDefinition,
} from '../workgraph/types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Constants and Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Box-drawing characters for terminal UI */
const BOX = {
  topLeft: '╭',
  topRight: '╮',
  bottomLeft: '╰',
  bottomRight: '╯',
  horizontal: '─',
  vertical: '│',
  teeRight: '├',
  teeLeft: '┤',
  teeDown: '┬',
  teeUp: '┴',
  cross: '┼',
} as const;

/** Priority colors and symbols */
const PRIORITY_CONFIG: Record<string, { color: typeof chalk.red; symbol: string; label: string }> = {
  urgent: { color: chalk.red, symbol: '🔴', label: 'URGENT' },
  high: { color: chalk.yellow, symbol: '🟠', label: 'HIGH' },
  medium: { color: chalk.blue, symbol: '🔵', label: 'MEDIUM' },
  low: { color: chalk.gray, symbol: '⚪', label: 'LOW' },
};

/** Status colors and symbols */
const STATUS_CONFIG: Record<ThreadStatus, { color: typeof chalk.green; symbol: string; label: string }> = {
  open: { color: chalk.cyan, symbol: '○', label: 'Open' },
  active: { color: chalk.green, symbol: '●', label: 'Active' },
  blocked: { color: chalk.red, symbol: '⊘', label: 'Blocked' },
  done: { color: chalk.gray, symbol: '✓', label: 'Done' },
  cancelled: { color: chalk.dim, symbol: '✗', label: 'Cancelled' },
};

/** Ledger operation colors */
const OP_COLORS: Record<string, typeof chalk.green> = {
  create: chalk.green,
  update: chalk.blue,
  delete: chalk.red,
  claim: chalk.yellow,
  release: chalk.cyan,
  block: chalk.red,
  unblock: chalk.green,
  done: chalk.greenBright,
  cancel: chalk.gray,
  define: chalk.magenta,
  decompose: chalk.cyan,
};

/**
 * Get the current agent name from environment or hostname.
 */
function getAgentName(): string {
  return process.env.CLAWVAULT_AGENT ?? os.hostname();
}

/**
 * Get vault path from options, environment, or current directory.
 */
function resolveVaultPath(optionPath?: string): string {
  return path.resolve(optionPath ?? process.env.CLAWVAULT_PATH ?? process.cwd());
}

/**
 * Format a relative timestamp (e.g., "2m ago", "3h ago").
 */
function formatRelativeTime(isoTimestamp: string): string {
  const now = Date.now();
  const then = new Date(isoTimestamp).getTime();
  const diffMs = now - then;

  if (diffMs < 0) return 'just now';

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);

  if (weeks > 0) return `${weeks}w ago`;
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  if (seconds > 0) return `${seconds}s ago`;
  return 'just now';
}

/**
 * Draw a horizontal line with optional title.
 */
function drawLine(width: number, title?: string): string {
  if (!title) {
    return BOX.horizontal.repeat(width);
  }
  const titlePadded = ` ${title} `;
  const remaining = width - titlePadded.length - 2;
  const left = Math.floor(remaining / 2);
  const right = remaining - left;
  return BOX.horizontal.repeat(left) + chalk.bold(titlePadded) + BOX.horizontal.repeat(right);
}

/**
 * Draw a box around content.
 */
function drawBox(title: string, lines: string[], width: number = 60): string {
  const innerWidth = width - 2;
  const output: string[] = [];

  output.push(BOX.topLeft + drawLine(innerWidth, title) + BOX.topRight);

  for (const line of lines) {
    const stripped = stripAnsi(line);
    const padding = innerWidth - stripped.length;
    output.push(BOX.vertical + line + ' '.repeat(Math.max(0, padding)) + BOX.vertical);
  }

  output.push(BOX.bottomLeft + BOX.horizontal.repeat(innerWidth) + BOX.bottomRight);

  return output.join('\n');
}

/**
 * Strip ANSI codes for length calculation.
 */
function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*m/g, '');
}

/**
 * Truncate string to max length with ellipsis.
 */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '…';
}

/**
 * Format a thread for display.
 */
function formatThreadLine(inst: PrimitiveInstance, showOwner: boolean = true): string {
  const status = inst.fields.status as ThreadStatus;
  const priority = (inst.fields.priority as string) ?? 'medium';
  const title = truncate(String(inst.fields.title ?? inst.path), 40);
  const owner = inst.fields.owner as string | undefined;

  const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.open;
  const priorityCfg = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.medium;

  let line = `${statusCfg.color(statusCfg.symbol)} ${priorityCfg.symbol} ${chalk.white(title)}`;

  if (showOwner && owner) {
    line += chalk.dim(` @${owner}`);
  }

  return line;
}

/**
 * Parse comma-separated list.
 */
function parseList(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Create helpful error message with what/why/fix structure.
 */
function formatError(what: string, why: string, fix: string): string {
  return [
    '',
    chalk.red.bold('✗ Error: ') + chalk.red(what),
    '',
    chalk.dim('Why: ') + why,
    chalk.dim('Fix: ') + chalk.cyan(fix),
    '',
  ].join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Command: wg status
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Agent morning briefing with rich terminal output.
 */
export async function statusCommand(vaultPath: string): Promise<void> {
  const agentName = getAgentName();
  const now = new Date();
  const greeting = getGreeting(now.getHours());

  console.log('');
  console.log(chalk.bold.cyan(`${greeting}, ${agentName}!`));
  console.log(chalk.dim(`${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`));
  console.log('');

  const allThreads = store.list(vaultPath, 'thread');
  const activeThreads = allThreads.filter(t => t.fields.status === 'active');
  const openThreads = allThreads.filter(t => t.fields.status === 'open');
  const blockedThreads = allThreads.filter(t => t.fields.status === 'blocked');
  const myActiveThreads = activeThreads.filter(t => t.fields.owner === agentName);

  // Active Threads section
  if (myActiveThreads.length > 0) {
    const activeLines = myActiveThreads.map(t => formatThreadLine(t, false));
    console.log(drawBox('🔥 Your Active Work', activeLines, 65));
    console.log('');
  }

  // Available Work section
  if (openThreads.length > 0) {
    const sorted = sortByPriority(openThreads);
    const availableLines = sorted.slice(0, 5).map(t => formatThreadLine(t, false));
    if (sorted.length > 5) {
      availableLines.push(chalk.dim(`  ... and ${sorted.length - 5} more`));
    }
    console.log(drawBox('📋 Available Work', availableLines, 65));
    console.log('');
  }

  // Blocked section
  if (blockedThreads.length > 0) {
    const blockedLines = blockedThreads.slice(0, 3).map(t => {
      const title = truncate(String(t.fields.title ?? t.path), 35);
      const deps = (t.fields.deps as string[]) ?? [];
      const depStr = deps.length > 0 ? chalk.dim(` → ${deps[0]}`) : '';
      return `${STATUS_CONFIG.blocked.color(STATUS_CONFIG.blocked.symbol)} ${title}${depStr}`;
    });
    console.log(drawBox('⛔ Blocked', blockedLines, 65));
    console.log('');
  }

  // Recent Activity section
  const recentEntries = ledger.recent(vaultPath, 8);
  if (recentEntries.length > 0) {
    const activityLines = recentEntries.reverse().map(e => {
      const opColor = OP_COLORS[e.op] ?? chalk.white;
      const target = truncate(path.basename(e.target, '.md'), 25);
      const time = formatRelativeTime(e.ts);
      return `${opColor(e.op.padEnd(8))} ${chalk.white(target)} ${chalk.dim(time)}`;
    });
    console.log(drawBox('📜 Recent Activity', activityLines, 65));
    console.log('');
  }

  // Team Status section
  const claims = ledger.allClaims(vaultPath);
  const teamMembers = new Map<string, string[]>();
  for (const [target, owner] of claims) {
    const current = teamMembers.get(owner) ?? [];
    current.push(target);
    teamMembers.set(owner, current);
  }

  if (teamMembers.size > 0) {
    const teamLines: string[] = [];
    for (const [member, threads] of teamMembers) {
      const isYou = member === agentName;
      const name = isYou ? chalk.green(`${member} (you)`) : chalk.white(member);
      teamLines.push(`${chalk.cyan('●')} ${name}: ${chalk.dim(`${threads.length} active`)}`);
    }
    console.log(drawBox('👥 Team Status', teamLines, 65));
    console.log('');
  }

  // Summary line
  const summaryParts = [
    chalk.green(`${activeThreads.length} active`),
    chalk.cyan(`${openThreads.length} open`),
    chalk.red(`${blockedThreads.length} blocked`),
  ];
  console.log(chalk.dim('Summary: ') + summaryParts.join(chalk.dim(' · ')));
  console.log('');
}

function getGreeting(hour: number): string {
  if (hour < 12) return '☀️  Good morning';
  if (hour < 17) return '🌤️  Good afternoon';
  return '🌙 Good evening';
}

function sortByPriority(threads: PrimitiveInstance[]): PrimitiveInstance[] {
  const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
  return [...threads].sort((a, b) => {
    const priorityA = String(a.fields.priority ?? 'medium');
    const priorityB = String(b.fields.priority ?? 'medium');
    const pa = priorityOrder[priorityA] ?? 2;
    const pb = priorityOrder[priorityB] ?? 2;
    return pa - pb;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Command: wg thread create
// ─────────────────────────────────────────────────────────────────────────────

export interface ThreadCreateOptions {
  goal?: string;
  priority?: string;
  deps?: string;
  tags?: string;
}

/**
 * Create a new thread.
 */
export async function threadCreateCommand(
  vaultPath: string,
  title: string,
  options: ThreadCreateOptions
): Promise<void> {
  const agentName = getAgentName();
  const goal = options.goal ?? `Complete: ${title}`;
  const priority = options.priority ?? 'medium';
  const deps = parseList(options.deps);
  const tags = parseList(options.tags);

  try {
    const inst = thread.createThread(vaultPath, title, goal, agentName, {
      priority,
      deps,
      tags,
    });

    console.log('');
    console.log(chalk.green.bold('✓ Thread created'));
    console.log('');
    console.log(chalk.dim('  Path:     ') + chalk.white(inst.path));
    console.log(chalk.dim('  Title:    ') + chalk.white(inst.fields.title));
    console.log(chalk.dim('  Goal:     ') + chalk.white(inst.fields.goal));
    console.log(chalk.dim('  Priority: ') + formatPriority(priority));
    if (deps.length > 0) {
      console.log(chalk.dim('  Deps:     ') + chalk.cyan(deps.join(', ')));
    }
    if (tags.length > 0) {
      console.log(chalk.dim('  Tags:     ') + chalk.magenta(tags.join(', ')));
    }
    console.log('');
    console.log(chalk.dim(`Claim it: ${chalk.cyan(`clawvault wg thread claim ${inst.path}`)}`));
    console.log('');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(formatError(
      'Failed to create thread',
      message,
      'Check the title is unique and vault path is correct'
    ));
    process.exitCode = 1;
  }
}

function formatPriority(priority: string): string {
  const cfg = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.medium;
  return cfg.color(`${cfg.symbol} ${cfg.label}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Command: wg thread list
// ─────────────────────────────────────────────────────────────────────────────

export interface ThreadListOptions {
  status?: string;
  owner?: string;
  json?: boolean;
}

/**
 * List threads with filters.
 */
export async function threadListCommand(
  vaultPath: string,
  options: ThreadListOptions
): Promise<void> {
  let threads = store.list(vaultPath, 'thread');

  if (options.status) {
    threads = threads.filter(t => t.fields.status === options.status);
  }

  if (options.owner) {
    const ownerFilter = options.owner === 'me' ? getAgentName() : options.owner;
    threads = threads.filter(t => t.fields.owner === ownerFilter);
  }

  if (options.json) {
    console.log(JSON.stringify(threads, null, 2));
    return;
  }

  if (threads.length === 0) {
    console.log('');
    console.log(chalk.dim('No threads found matching filters.'));
    console.log('');
    return;
  }

  console.log('');
  console.log(chalk.bold(`Threads (${threads.length})`));
  console.log(chalk.dim('─'.repeat(70)));

  const sorted = sortByPriority(threads);
  for (const t of sorted) {
    const status = t.fields.status as ThreadStatus;
    const priority = (t.fields.priority as string) ?? 'medium';
    const title = truncate(String(t.fields.title ?? t.path), 35);
    const owner = t.fields.owner as string | undefined;
    const updated = formatRelativeTime(String(t.fields.updated));

    const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.open;
    const priorityCfg = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.medium;

    let line = `${statusCfg.color(statusCfg.symbol.padEnd(2))}`;
    line += `${priorityCfg.symbol} `;
    line += chalk.white(title.padEnd(37));
    line += owner ? chalk.cyan(`@${owner}`.padEnd(15)) : ' '.repeat(15);
    line += chalk.dim(updated);

    console.log(line);
  }

  console.log(chalk.dim('─'.repeat(70)));
  console.log('');
}

// ─────────────────────────────────────────────────────────────────────────────
// Command: wg thread claim
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Claim a thread and show work brief.
 */
export async function threadClaimCommand(
  vaultPath: string,
  threadPath: string
): Promise<void> {
  const agentName = getAgentName();
  const normalizedPath = normalizeThreadPath(threadPath);

  try {
    const inst = thread.claim(vaultPath, normalizedPath, agentName);

    console.log('');
    console.log(chalk.green.bold('✓ Thread claimed'));
    console.log('');

    // Work Brief
    const briefLines: string[] = [
      chalk.dim('Title:    ') + chalk.white.bold(inst.fields.title),
      chalk.dim('Goal:     ') + chalk.white(inst.fields.goal),
      chalk.dim('Priority: ') + formatPriority(String(inst.fields.priority ?? 'medium')),
    ];

    const deps = (inst.fields.deps as string[]) ?? [];
    if (deps.length > 0) {
      briefLines.push(chalk.dim('Deps:     ') + chalk.cyan(deps.join(', ')));
    }

    const contextRefs = (inst.fields.context_refs as string[]) ?? [];
    if (contextRefs.length > 0) {
      briefLines.push(chalk.dim('Context:  ') + chalk.magenta(contextRefs.join(', ')));
    }

    console.log(drawBox('📋 Work Brief', briefLines, 65));
    console.log('');

    // Show body content if present
    if (inst.body && inst.body.trim()) {
      console.log(chalk.dim('─'.repeat(65)));
      console.log(chalk.dim('Notes:'));
      console.log(inst.body.trim().split('\n').slice(0, 10).join('\n'));
      console.log(chalk.dim('─'.repeat(65)));
      console.log('');
    }

    console.log(chalk.dim(`When done: ${chalk.cyan(`clawvault wg thread done ${normalizedPath}`)}`));
    console.log('');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(formatError(
      'Failed to claim thread',
      message,
      'Ensure the thread exists and is in "open" status'
    ));
    process.exitCode = 1;
  }
}

function normalizeThreadPath(input: string): string {
  if (input.startsWith('threads/')) return input;
  if (input.endsWith('.md')) return `threads/${input}`;
  return `threads/${input}.md`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Command: wg thread done
// ─────────────────────────────────────────────────────────────────────────────

export interface ThreadDoneOptions {
  output?: string;
}

/**
 * Mark thread as complete.
 */
export async function threadDoneCommand(
  vaultPath: string,
  threadPath: string,
  options: ThreadDoneOptions
): Promise<void> {
  const agentName = getAgentName();
  const normalizedPath = normalizeThreadPath(threadPath);

  try {
    const inst = thread.done(vaultPath, normalizedPath, agentName, options.output);

    console.log('');
    console.log(chalk.green.bold('✓ Thread completed!'));
    console.log('');
    console.log(chalk.dim('  Title:  ') + chalk.white(inst.fields.title));
    console.log(chalk.dim('  Status: ') + chalk.green('done'));
    if (options.output) {
      console.log(chalk.dim('  Output: ') + chalk.white(truncate(options.output, 50)));
    }
    console.log('');
    console.log(chalk.dim('Great work! 🎉'));
    console.log('');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(formatError(
      'Failed to complete thread',
      message,
      'Ensure you own the thread and it is in "active" status'
    ));
    process.exitCode = 1;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Command: wg thread block
// ─────────────────────────────────────────────────────────────────────────────

export interface ThreadBlockOptions {
  by: string;
  reason?: string;
}

/**
 * Block thread on dependency.
 */
export async function threadBlockCommand(
  vaultPath: string,
  threadPath: string,
  options: ThreadBlockOptions
): Promise<void> {
  const agentName = getAgentName();
  const normalizedPath = normalizeThreadPath(threadPath);

  if (!options.by) {
    console.error(formatError(
      'Missing --by option',
      'You must specify what is blocking this thread',
      'clawvault wg thread block <path> --by "reason or dependency"'
    ));
    process.exitCode = 1;
    return;
  }

  try {
    const inst = thread.block(vaultPath, normalizedPath, agentName, options.by, options.reason);

    console.log('');
    console.log(chalk.yellow.bold('⊘ Thread blocked'));
    console.log('');
    console.log(chalk.dim('  Title:      ') + chalk.white(inst.fields.title));
    console.log(chalk.dim('  Blocked by: ') + chalk.red(options.by));
    if (options.reason) {
      console.log(chalk.dim('  Reason:     ') + chalk.white(options.reason));
    }
    console.log('');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(formatError(
      'Failed to block thread',
      message,
      'Ensure the thread exists and is in "active" status'
    ));
    process.exitCode = 1;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Command: wg thread release
// ─────────────────────────────────────────────────────────────────────────────

export interface ThreadReleaseOptions {
  reason?: string;
}

/**
 * Release thread back to pool.
 */
export async function threadReleaseCommand(
  vaultPath: string,
  threadPath: string,
  options: ThreadReleaseOptions
): Promise<void> {
  const agentName = getAgentName();
  const normalizedPath = normalizeThreadPath(threadPath);

  try {
    const inst = thread.release(vaultPath, normalizedPath, agentName, options.reason);

    console.log('');
    console.log(chalk.cyan.bold('↩ Thread released'));
    console.log('');
    console.log(chalk.dim('  Title:  ') + chalk.white(inst.fields.title));
    console.log(chalk.dim('  Status: ') + chalk.cyan('open'));
    if (options.reason) {
      console.log(chalk.dim('  Reason: ') + chalk.white(options.reason));
    }
    console.log('');
    console.log(chalk.dim('Thread is now available for others to claim.'));
    console.log('');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(formatError(
      'Failed to release thread',
      message,
      'Ensure you own the thread'
    ));
    process.exitCode = 1;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Command: wg thread decompose
// ─────────────────────────────────────────────────────────────────────────────

export interface ThreadDecomposeOptions {
  into: string[];
}

/**
 * Break thread into sub-threads.
 */
export async function threadDecomposeCommand(
  vaultPath: string,
  threadPath: string,
  options: ThreadDecomposeOptions
): Promise<void> {
  const agentName = getAgentName();
  const normalizedPath = normalizeThreadPath(threadPath);

  if (!options.into || options.into.length === 0) {
    console.error(formatError(
      'Missing --into option',
      'You must specify sub-thread titles',
      'clawvault wg thread decompose <path> --into "sub1" --into "sub2"'
    ));
    process.exitCode = 1;
    return;
  }

  try {
    const parent = store.read(vaultPath, normalizedPath);
    if (!parent) {
      throw new Error(`Thread not found: ${normalizedPath}`);
    }

    const subthreads = options.into.map(title => ({
      title,
      goal: `Sub-task of: ${parent.fields.title}`,
    }));

    const created = thread.decompose(vaultPath, normalizedPath, subthreads, agentName);

    console.log('');
    console.log(chalk.green.bold('✓ Thread decomposed'));
    console.log('');
    console.log(chalk.dim('  Parent: ') + chalk.white(parent.fields.title));
    console.log(chalk.dim('  Created sub-threads:'));
    for (const sub of created) {
      console.log(chalk.cyan(`    → ${sub.fields.title}`));
    }
    console.log('');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(formatError(
      'Failed to decompose thread',
      message,
      'Ensure the thread exists'
    ));
    process.exitCode = 1;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Command: wg ledger
// ─────────────────────────────────────────────────────────────────────────────

export interface LedgerOptions {
  last?: number;
  actor?: string;
  target?: string;
  json?: boolean;
}

/**
 * View coordination history.
 */
export async function ledgerCommand(
  vaultPath: string,
  options: LedgerOptions
): Promise<void> {
  let entries = ledger.readAll(vaultPath);

  if (options.actor) {
    const actorFilter = options.actor === 'me' ? getAgentName() : options.actor;
    entries = entries.filter(e => e.actor === actorFilter);
  }

  if (options.target) {
    entries = entries.filter(e => e.target.includes(options.target as string));
  }

  const limit = options.last ?? 20;
  entries = entries.slice(-limit);

  if (options.json) {
    console.log(JSON.stringify(entries, null, 2));
    return;
  }

  if (entries.length === 0) {
    console.log('');
    console.log(chalk.dim('No ledger entries found.'));
    console.log('');
    return;
  }

  console.log('');
  console.log(chalk.bold(`Ledger (last ${entries.length} entries)`));
  console.log(chalk.dim('─'.repeat(80)));

  for (const entry of entries.reverse()) {
    const opColor = OP_COLORS[entry.op] ?? chalk.white;
    const time = formatRelativeTime(entry.ts);
    const target = truncate(entry.target, 30);
    const actor = entry.actor;

    let line = chalk.dim(time.padEnd(10));
    line += opColor(entry.op.toUpperCase().padEnd(10));
    line += chalk.white(target.padEnd(32));
    line += chalk.cyan(`@${actor}`);

    console.log(line);

    if (entry.data && Object.keys(entry.data).length > 0) {
      const dataStr = JSON.stringify(entry.data);
      console.log(chalk.dim(`           ${truncate(dataStr, 68)}`));
    }
  }

  console.log(chalk.dim('─'.repeat(80)));
  console.log('');
}

// ─────────────────────────────────────────────────────────────────────────────
// Command: wg define
// ─────────────────────────────────────────────────────────────────────────────

export interface DefineOptions {
  fields?: string;
  dir?: string;
  description?: string;
}

/**
 * Define a new primitive type.
 */
export async function defineCommand(
  vaultPath: string,
  typeName: string,
  options: DefineOptions
): Promise<void> {
  const agentName = getAgentName();
  const description = options.description ?? `Custom type: ${typeName}`;

  const fields: Record<string, FieldDefinition> = {};
  if (options.fields) {
    const fieldPairs = options.fields.split(',');
    for (const pair of fieldPairs) {
      const [name, type] = pair.split(':').map(s => s.trim());
      if (name && type) {
        fields[name] = { type: type as FieldDefinition['type'] };
      }
    }
  }

  try {
    const typeDef = registry.defineType(
      vaultPath,
      typeName,
      description,
      fields,
      agentName,
      options.dir
    );

    console.log('');
    console.log(chalk.green.bold('✓ Type defined'));
    console.log('');
    console.log(chalk.dim('  Name:      ') + chalk.magenta(typeDef.name));
    console.log(chalk.dim('  Directory: ') + chalk.white(typeDef.directory));
    console.log(chalk.dim('  Fields:'));
    for (const [fieldName, fieldDef] of Object.entries(typeDef.fields)) {
      const required = fieldDef.required ? chalk.red('*') : ' ';
      console.log(chalk.dim(`    ${required} ${fieldName}: ${fieldDef.type}`));
    }
    console.log('');
    console.log(chalk.dim(`Create instances: ${chalk.cyan(`clawvault wg create ${typeDef.name} "title"`)}`));
    console.log('');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(formatError(
      'Failed to define type',
      message,
      'Ensure the type name is unique and not a built-in type'
    ));
    process.exitCode = 1;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Command: wg types
// ─────────────────────────────────────────────────────────────────────────────

export interface TypesOptions {
  json?: boolean;
}

/**
 * List all primitive types.
 */
export async function typesCommand(
  vaultPath: string,
  options: TypesOptions
): Promise<void> {
  const types = registry.listTypes(vaultPath);

  if (options.json) {
    console.log(JSON.stringify(types, null, 2));
    return;
  }

  console.log('');
  console.log(chalk.bold(`Primitive Types (${types.length})`));
  console.log(chalk.dim('─'.repeat(70)));

  for (const typeDef of types) {
    const builtInBadge = typeDef.builtIn ? chalk.cyan(' [built-in]') : chalk.magenta(' [custom]');
    console.log('');
    console.log(chalk.white.bold(typeDef.name) + builtInBadge);
    console.log(chalk.dim(`  ${typeDef.description}`));
    console.log(chalk.dim(`  Directory: ${typeDef.directory}/`));
    console.log(chalk.dim('  Fields:'));

    const fieldEntries = Object.entries(typeDef.fields);
    for (const [fieldName, fieldDef] of fieldEntries) {
      const required = fieldDef.required ? chalk.red('*') : ' ';
      const defaultVal = fieldDef.default !== undefined ? chalk.dim(` = ${JSON.stringify(fieldDef.default)}`) : '';
      const desc = fieldDef.description ? chalk.dim(` — ${fieldDef.description}`) : '';
      console.log(`    ${required} ${chalk.cyan(fieldName)}: ${fieldDef.type}${defaultVal}${desc}`);
    }
  }

  console.log('');
  console.log(chalk.dim('─'.repeat(70)));
  console.log('');
}

// ─────────────────────────────────────────────────────────────────────────────
// Command: wg create
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateOptions {
  body?: string;
  [key: string]: string | undefined;
}

/**
 * Create any primitive instance.
 */
export async function createCommand(
  vaultPath: string,
  typeName: string,
  title: string,
  options: CreateOptions
): Promise<void> {
  const agentName = getAgentName();
  const body = options.body ?? '';

  const fields: Record<string, unknown> = { title };

  // Copy any additional options as fields (excluding known options)
  const knownOptions = new Set(['body', 'vault']);
  for (const [key, value] of Object.entries(options)) {
    if (!knownOptions.has(key) && value !== undefined) {
      fields[key] = value;
    }
  }

  try {
    const inst = store.create(vaultPath, typeName, fields, body, agentName);

    console.log('');
    console.log(chalk.green.bold(`✓ ${typeName} created`));
    console.log('');
    console.log(chalk.dim('  Path:  ') + chalk.white(inst.path));
    console.log(chalk.dim('  Title: ') + chalk.white(inst.fields.title));
    console.log('');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(formatError(
      `Failed to create ${typeName}`,
      message,
      `Ensure the type "${typeName}" exists. Run: clawvault wg types`
    ));
    process.exitCode = 1;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Command: wg board
// ─────────────────────────────────────────────────────────────────────────────

export interface BoardOptions {
  width?: number;
}

/**
 * Terminal kanban board with box-drawing characters.
 */
export async function boardCommand(
  vaultPath: string,
  options: BoardOptions
): Promise<void> {
  const threads = store.list(vaultPath, 'thread');
  const termWidth = options.width ?? process.stdout.columns ?? 120;

  const columns: Record<ThreadStatus, PrimitiveInstance[]> = {
    open: [],
    active: [],
    blocked: [],
    done: [],
    cancelled: [],
  };

  for (const t of threads) {
    const status = t.fields.status as ThreadStatus;
    if (columns[status]) {
      columns[status].push(t);
    }
  }

  // Sort each column by priority
  for (const status of Object.keys(columns) as ThreadStatus[]) {
    columns[status] = sortByPriority(columns[status]);
  }

  const visibleStatuses: ThreadStatus[] = ['open', 'active', 'blocked', 'done'];
  const colWidth = Math.floor((termWidth - visibleStatuses.length - 1) / visibleStatuses.length);
  const cardWidth = colWidth - 4;

  console.log('');
  console.log(chalk.bold.cyan('╔' + '═'.repeat(termWidth - 2) + '╗'));
  console.log(chalk.bold.cyan('║') + chalk.bold(' WORKGRAPH BOARD').padEnd(termWidth - 2) + chalk.bold.cyan('║'));
  console.log(chalk.bold.cyan('╚' + '═'.repeat(termWidth - 2) + '╝'));
  console.log('');

  // Column headers
  let headerLine = '';
  for (const status of visibleStatuses) {
    const cfg = STATUS_CONFIG[status];
    const header = `${cfg.symbol} ${cfg.label} (${columns[status].length})`;
    const padded = header.padEnd(colWidth);
    headerLine += cfg.color(padded);
  }
  console.log(headerLine);
  console.log(chalk.dim('─'.repeat(termWidth)));

  // Find max rows
  const maxRows = Math.max(...visibleStatuses.map(s => columns[s].length), 1);

  for (let row = 0; row < Math.min(maxRows, 15); row++) {
    let line = '';
    for (const status of visibleStatuses) {
      const t = columns[status][row];
      if (t) {
        const card = formatBoardCard(t, cardWidth);
        line += card.padEnd(colWidth);
      } else {
        line += ' '.repeat(colWidth);
      }
    }
    console.log(line);
  }

  if (maxRows > 15) {
    console.log(chalk.dim(`... and ${maxRows - 15} more rows`));
  }

  console.log('');
  console.log(chalk.dim('─'.repeat(termWidth)));

  // Legend
  const legendParts = Object.entries(PRIORITY_CONFIG).map(([, cfg]) =>
    `${cfg.symbol} ${cfg.label}`
  );
  console.log(chalk.dim('Priority: ') + legendParts.join(chalk.dim(' · ')));
  console.log('');
}

function formatBoardCard(t: PrimitiveInstance, width: number): string {
  const priority = (t.fields.priority as string) ?? 'medium';
  const title = truncate(String(t.fields.title ?? t.path), width - 4);
  const owner = t.fields.owner as string | undefined;
  const priorityCfg = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.medium;

  let card = `${priorityCfg.symbol} ${title}`;
  if (owner) {
    card += chalk.dim(` @${truncate(owner, 8)}`);
  }

  return card;
}

// ─────────────────────────────────────────────────────────────────────────────
// Command Registration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Register all workgraph commands under the 'wg' namespace.
 */
export function registerWorkgraphCommands(program: Command): void {
  const wg = program
    .command('wg')
    .description('Workgraph — multi-agent coordination primitives');

  // wg status
  wg.command('status')
    .description('Agent morning briefing with active work, available tasks, and team status')
    .option('-v, --vault <path>', 'Vault path')
    .action(async (options: { vault?: string }) => {
      const vaultPath = resolveVaultPath(options.vault);
      await statusCommand(vaultPath);
    });

  // wg thread subcommands
  const threadCmd = wg
    .command('thread')
    .description('Thread lifecycle operations');

  threadCmd
    .command('create <title>')
    .description('Create a new thread')
    .option('--goal <goal>', 'What success looks like')
    .option('--priority <priority>', 'urgent | high | medium | low', 'medium')
    .option('--deps <deps>', 'Comma-separated dependency paths')
    .option('--tags <tags>', 'Comma-separated tags')
    .option('-v, --vault <path>', 'Vault path')
    .action(async (title: string, options: ThreadCreateOptions & { vault?: string }) => {
      const vaultPath = resolveVaultPath(options.vault);
      await threadCreateCommand(vaultPath, title, options);
    });

  threadCmd
    .command('list')
    .description('List threads with optional filters')
    .option('--status <status>', 'Filter by status: open | active | blocked | done | cancelled')
    .option('--owner <owner>', 'Filter by owner (use "me" for current agent)')
    .option('--json', 'Output as JSON')
    .option('-v, --vault <path>', 'Vault path')
    .action(async (options: ThreadListOptions & { vault?: string }) => {
      const vaultPath = resolveVaultPath(options.vault);
      await threadListCommand(vaultPath, options);
    });

  threadCmd
    .command('claim <path>')
    .description('Claim a thread and show work brief')
    .option('-v, --vault <path>', 'Vault path')
    .action(async (threadPath: string, options: { vault?: string }) => {
      const vaultPath = resolveVaultPath(options.vault);
      await threadClaimCommand(vaultPath, threadPath);
    });

  threadCmd
    .command('done <path>')
    .description('Mark thread as complete')
    .option('--output <output>', 'Completion summary or output')
    .option('-v, --vault <path>', 'Vault path')
    .action(async (threadPath: string, options: ThreadDoneOptions & { vault?: string }) => {
      const vaultPath = resolveVaultPath(options.vault);
      await threadDoneCommand(vaultPath, threadPath, options);
    });

  threadCmd
    .command('block <path>')
    .description('Block thread on a dependency')
    .requiredOption('--by <blocker>', 'What is blocking this thread')
    .option('--reason <reason>', 'Additional context')
    .option('-v, --vault <path>', 'Vault path')
    .action(async (threadPath: string, options: ThreadBlockOptions & { vault?: string }) => {
      const vaultPath = resolveVaultPath(options.vault);
      await threadBlockCommand(vaultPath, threadPath, options);
    });

  threadCmd
    .command('release <path>')
    .description('Release thread back to the pool')
    .option('--reason <reason>', 'Why releasing')
    .option('-v, --vault <path>', 'Vault path')
    .action(async (threadPath: string, options: ThreadReleaseOptions & { vault?: string }) => {
      const vaultPath = resolveVaultPath(options.vault);
      await threadReleaseCommand(vaultPath, threadPath, options);
    });

  threadCmd
    .command('decompose <path>')
    .description('Break thread into sub-threads')
    .option('--into <titles...>', 'Sub-thread titles')
    .option('-v, --vault <path>', 'Vault path')
    .action(async (threadPath: string, options: { into?: string[]; vault?: string }) => {
      const vaultPath = resolveVaultPath(options.vault);
      await threadDecomposeCommand(vaultPath, threadPath, { into: options.into ?? [] });
    });

  // wg ledger
  wg.command('ledger')
    .description('View coordination history')
    .option('--last <n>', 'Number of entries to show', '20')
    .option('--actor <actor>', 'Filter by actor (use "me" for current agent)')
    .option('--target <target>', 'Filter by target path substring')
    .option('--json', 'Output as JSON')
    .option('-v, --vault <path>', 'Vault path')
    .action(async (options: { last?: string; actor?: string; target?: string; json?: boolean; vault?: string }) => {
      const vaultPath = resolveVaultPath(options.vault);
      await ledgerCommand(vaultPath, {
        last: options.last ? parseInt(options.last, 10) : 20,
        actor: options.actor,
        target: options.target,
        json: options.json,
      });
    });

  // wg define
  wg.command('define <type>')
    .description('Define a new primitive type')
    .option('--fields <fields>', 'Comma-separated field definitions (name:type)')
    .option('--dir <directory>', 'Custom directory for instances')
    .option('--description <desc>', 'Type description')
    .option('-v, --vault <path>', 'Vault path')
    .action(async (typeName: string, options: DefineOptions & { vault?: string }) => {
      const vaultPath = resolveVaultPath(options.vault);
      await defineCommand(vaultPath, typeName, options);
    });

  // wg types
  wg.command('types')
    .description('List all primitive types with their fields')
    .option('--json', 'Output as JSON')
    .option('-v, --vault <path>', 'Vault path')
    .action(async (options: TypesOptions & { vault?: string }) => {
      const vaultPath = resolveVaultPath(options.vault);
      await typesCommand(vaultPath, options);
    });

  // wg create
  wg.command('create <type> <title>')
    .description('Create any primitive instance')
    .option('--body <body>', 'Markdown body content')
    .option('-v, --vault <path>', 'Vault path')
    .allowUnknownOption(true)
    .action(async (typeName: string, title: string, options: CreateOptions & { vault?: string }) => {
      const vaultPath = resolveVaultPath(options.vault);
      await createCommand(vaultPath, typeName, title, options);
    });

  // wg board
  wg.command('board')
    .description('Terminal kanban board view')
    .option('--width <width>', 'Terminal width override')
    .option('-v, --vault <path>', 'Vault path')
    .action(async (options: { width?: string; vault?: string }) => {
      const vaultPath = resolveVaultPath(options.vault);
      await boardCommand(vaultPath, {
        width: options.width ? parseInt(options.width, 10) : undefined,
      });
    });
}
