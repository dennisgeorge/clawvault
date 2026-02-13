/**
 * ClawVault 🐘 — An Elephant Never Forgets
 * 
 * Structured memory system for AI agents with Obsidian-compatible markdown
 * and embedded semantic search.
 * 
 * @example
 * ```typescript
 * import { ClawVault, createVault, findVault } from 'clawvault';
 * 
 * // Create a new vault
 * const vault = await createVault('./my-memory');
 * 
 * // Store a memory
 * await vault.store({
 *   category: 'decisions',
 *   title: 'Use ClawVault',
 *   content: 'Decided to use ClawVault for memory management.'
 * });
 * 
 * // Search memories
 * const results = await vault.find('memory management');
 * console.log(results);
 * ```
 */

import * as fs from 'fs';
import type { Command } from 'commander';
import { registerContextCommand } from './commands/context.js';
import { registerObserveCommand } from './commands/observe.js';

// Core exports
export { ClawVault, createVault, findVault } from './lib/vault.js';
export { setupCommand } from './commands/setup.js';
export { compatCommand, checkOpenClawCompatibility, compatibilityExitCode } from './commands/compat.js';
export type { CompatCheck, CompatReport, CompatStatus, CompatCommandOptions } from './commands/compat.js';
export { graphCommand, graphSummary } from './commands/graph.js';
export type { GraphSummary } from './commands/graph.js';
export {
  contextCommand,
  buildContext,
  formatContextMarkdown,
  registerContextCommand
} from './commands/context.js';
export type { ContextFormat, ContextProfile, ContextProfileOption, ContextOptions, ContextEntry, ContextResult } from './commands/context.js';
export { observeCommand, registerObserveCommand } from './commands/observe.js';
export type { ObserveCommandOptions } from './commands/observe.js';
export {
  sessionRecapCommand,
  buildSessionRecap,
  formatSessionRecapMarkdown
} from './commands/session-recap.js';
export type {
  SessionRecapFormat,
  SessionRecapOptions,
  SessionTurn,
  SessionRecapResult
} from './commands/session-recap.js';
export {
  SearchEngine,
  extractWikiLinks,
  extractTags,
  hasQmd,
  qmdUpdate,
  qmdEmbed,
  QmdUnavailableError,
  QMD_INSTALL_COMMAND,
  QMD_INSTALL_URL
} from './lib/search.js';
export { getVaultPath, findNearestVaultPath, resolveVaultPath } from './lib/config.js';
export {
  MEMORY_GRAPH_SCHEMA_VERSION,
  buildOrUpdateMemoryGraphIndex,
  getMemoryGraph,
  loadMemoryGraphIndex
} from './lib/memory-graph.js';
export {
  inferContextProfile,
  normalizeContextProfileInput,
  resolveContextProfile
} from './lib/context-profile.js';
export type { ContextProfileInput, ResolvedContextProfile } from './lib/context-profile.js';
export type {
  MemoryGraph,
  MemoryGraphNode,
  MemoryGraphEdge,
  MemoryGraphEdgeType,
  MemoryGraphNodeType,
  MemoryGraphIndex,
  MemoryGraphStats
} from './lib/memory-graph.js';
export { Observer } from './observer/observer.js';
export type { ObserverOptions, ObserverCompressor, ObserverReflector } from './observer/observer.js';
export { Compressor } from './observer/compressor.js';
export type { CompressorOptions } from './observer/compressor.js';
export { Reflector } from './observer/reflector.js';
export type { ReflectorOptions } from './observer/reflector.js';
export { SessionWatcher } from './observer/watcher.js';
export type { SessionWatcherOptions } from './observer/watcher.js';
export { parseSessionFile } from './observer/session-parser.js';

export {
  renderTemplate,
  buildTemplateVariables
} from './lib/template-engine.js';
export type { TemplateVariables } from './lib/template-engine.js';

// Type exports
export type {
  VaultConfig,
  VaultMeta,
  Document,
  SearchResult,
  SearchOptions,
  StoreOptions,
  SyncOptions,
  SyncResult,
  Category,
  MemoryType,
  HandoffDocument,
  SessionRecap
} from './types.js';

export { DEFAULT_CATEGORIES, DEFAULT_CONFIG, MEMORY_TYPES, TYPE_TO_CATEGORY } from './types.js';

// Version
function readPackageVersion(): string {
  try {
    const pkgUrl = new URL('../package.json', import.meta.url);
    const pkg = JSON.parse(fs.readFileSync(pkgUrl, 'utf-8')) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export const VERSION = readPackageVersion();

export function registerCommanderCommands(program: Command): Command {
  registerContextCommand(program);
  registerObserveCommand(program);
  return program;
}
