import type { PluginConfig } from '../lib/config.js';

export type CapturedMemoryType =
  | 'fact'
  | 'preference'
  | 'decision'
  | 'lesson'
  | 'entity'
  | 'episode'
  | 'relationship';

export interface CaptureMessage {
  role: string;
  content: string;
  timestamp?: string;
}

export interface CaptureCandidate {
  content: string;
  type: CapturedMemoryType;
  confidence: number;
  title?: string;
  tags?: string[];
  entities?: string[];
  source: 'memory_note' | 'heuristic';
  metadata?: Record<string, unknown>;
}

export interface CaptureOptions {
  vaultPath?: string;
  agentId?: string;
  pluginConfig?: PluginConfig;
  minConfidence?: number;
  dedupThreshold?: number;
  maxPerTurn?: number;
  sourceSessionId?: string;
}

export interface CaptureRejection {
  candidate: CaptureCandidate;
  reason: string;
}

export interface CaptureStoreResult {
  stored: number;
  rejected: number;
  storedDocuments: string[];
  acceptedCandidates: CaptureCandidate[];
  rejectedCandidates: CaptureRejection[];
}

