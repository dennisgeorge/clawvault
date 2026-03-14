import type { SearchOptions, SearchResult } from '../types.js';
import type { PluginConfig } from '../lib/config.js';

export type RecallStrategy = 'quick' | 'entity' | 'temporal' | 'verification' | 'relationship';

export interface RecallQueryClassification {
  strategy: RecallStrategy;
  entityName?: string;
  temporalDays?: number;
}

export interface RecallOptions {
  limit?: number;
  strategy?: RecallStrategy;
  includeSources?: boolean;
  vaultPath?: string;
  agentId?: string;
  pluginConfig?: PluginConfig;
  searchOptions?: SearchOptions;
}

export interface RecallSource {
  title: string;
  path: string;
  category: string;
  score: number;
  snippet: string;
  modified: string;
}

export interface RecallResult {
  query: string;
  strategy: RecallStrategy;
  entityName?: string;
  context: string;
  sources: RecallSource[];
  rawResults: SearchResult[];
}

