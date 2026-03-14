import type { Document, SearchOptions, SearchResult } from '../types.js';
import type { PluginConfig } from '../lib/config.js';
import { resolveVaultPath } from '../lib/config.js';
import { ClawVault } from '../lib/vault.js';
import { buildRecallResult } from '../recall/service.js';
import type { RecallOptions } from '../recall/types.js';
import { LiveCaptureService } from '../capture/service.js';
import type { CaptureOptions, CaptureStoreResult, CapturedMemoryType } from '../capture/types.js';

const CATEGORY_BY_TYPE: Record<CapturedMemoryType, string> = {
  fact: 'facts',
  preference: 'preferences',
  decision: 'decisions',
  lesson: 'lessons',
  entity: 'people',
  episode: 'transcripts',
  relationship: 'people'
};

export interface MemorySlotInitOptions {
  vaultPath?: string;
  agentId?: string;
  pluginConfig?: PluginConfig;
}

export interface MemoryStoreMetadata {
  title?: string;
  category?: string;
  type?: CapturedMemoryType;
  tags?: string[];
  frontmatter?: Record<string, unknown>;
}

export interface MemorySlotRecallOptions extends Omit<RecallOptions, 'vaultPath' | 'pluginConfig' | 'agentId'> {
  vaultPath?: string;
  pluginConfig?: PluginConfig;
  agentId?: string;
}

export interface MemorySlotSearchOptions extends SearchOptions {
  vaultPath?: string;
  pluginConfig?: PluginConfig;
  agentId?: string;
}

export interface MemorySlotStoreOptions extends MemoryStoreMetadata {
  vaultPath?: string;
  pluginConfig?: PluginConfig;
  agentId?: string;
}

export interface MemorySlot {
  recall(query: string, options?: MemorySlotRecallOptions): Promise<string>;
  capture(messages: unknown[], options?: CaptureOptions): Promise<CaptureStoreResult>;
  store(content: string, metadata?: MemorySlotStoreOptions): Promise<Document>;
  search(query: string, options?: MemorySlotSearchOptions): Promise<SearchResult[]>;
}

function resolveSlotVaultPath(defaults: MemorySlotInitOptions, options?: {
  vaultPath?: string;
  pluginConfig?: PluginConfig;
  agentId?: string;
}): string {
  return resolveVaultPath({
    explicitPath: options?.vaultPath ?? defaults.vaultPath,
    pluginConfig: options?.pluginConfig ?? defaults.pluginConfig,
    agentId: options?.agentId ?? defaults.agentId
  });
}

function normalizeTitle(content: string, fallbackPrefix: string = 'memory'): string {
  const stem = content.replace(/\s+/g, ' ').trim().split(' ').slice(0, 8).join(' ');
  const value = stem.length > 0 ? stem : `${fallbackPrefix}-${Date.now()}`;
  return value.slice(0, 90);
}

export function createMemorySlot(defaults: MemorySlotInitOptions = {}): MemorySlot {
  const captureService = new LiveCaptureService();

  async function getVault(options?: {
    vaultPath?: string;
    pluginConfig?: PluginConfig;
    agentId?: string;
  }): Promise<ClawVault> {
    const vaultPath = resolveSlotVaultPath(defaults, options);
    const vault = new ClawVault(vaultPath);
    await vault.load();
    return vault;
  }

  return {
    async search(query: string, options: MemorySlotSearchOptions = {}): Promise<SearchResult[]> {
      const vault = await getVault(options);
      const { vaultPath: _vaultPath, pluginConfig: _pluginConfig, agentId: _agentId, ...searchOptions } = options;
      return vault.find(query, searchOptions);
    },

    async recall(query: string, options: MemorySlotRecallOptions = {}): Promise<string> {
      const vault = await getVault(options);
      const result = await buildRecallResult(vault, query, {
        ...options,
        includeSources: options.includeSources ?? true
      });
      return result.context;
    },

    async capture(messages: unknown[], options: CaptureOptions = {}): Promise<CaptureStoreResult> {
      return captureService.captureTurn(messages, {
        ...options,
        vaultPath: options.vaultPath ?? defaults.vaultPath,
        pluginConfig: options.pluginConfig ?? defaults.pluginConfig,
        agentId: options.agentId ?? defaults.agentId
      });
    },

    async store(content: string, metadata: MemorySlotStoreOptions = {}): Promise<Document> {
      const vault = await getVault(metadata);
      const category = metadata.category
        ?? (metadata.type ? CATEGORY_BY_TYPE[metadata.type] : 'inbox');
      const title = metadata.title ?? normalizeTitle(content, metadata.type ?? 'memory');
      const frontmatter: Record<string, unknown> = {
        ...(metadata.frontmatter ?? {})
      };
      if (metadata.tags && metadata.tags.length > 0) {
        frontmatter.tags = metadata.tags;
      }
      if (metadata.type) {
        frontmatter.memoryType = metadata.type;
      }
      return vault.store({
        category,
        title,
        content,
        frontmatter
      });
    }
  };
}

export function createMemorySlotPlugin(defaults: MemorySlotInitOptions = {}): {
  plugins: {
    slots: {
      memory: MemorySlot;
    };
  };
} {
  return {
    plugins: {
      slots: {
        memory: createMemorySlot(defaults)
      }
    }
  };
}

export function registerMemorySlot(registry: Record<string, any>, defaults: MemorySlotInitOptions = {}): void {
  if (!registry.plugins || typeof registry.plugins !== 'object') {
    registry.plugins = {};
  }
  if (!registry.plugins.slots || typeof registry.plugins.slots !== 'object') {
    registry.plugins.slots = {};
  }
  registry.plugins.slots.memory = createMemorySlot(defaults);
}

