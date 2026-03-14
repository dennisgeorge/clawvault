import type { Document } from '../types.js';
import { resolveVaultPath } from '../lib/config.js';
import { ClawVault } from '../lib/vault.js';
import { synthesizeEntityProfiles } from '../entities/synthesis.js';
import { extractMemoriesFromAssistantResponse } from './extractor.js';
import { evaluateCandidateQuality } from './quality.js';
import type {
  CaptureCandidate,
  CaptureMessage,
  CaptureOptions,
  CapturedMemoryType,
  CaptureStoreResult
} from './types.js';

const CATEGORY_BY_MEMORY_TYPE: Record<CapturedMemoryType, string> = {
  fact: 'facts',
  preference: 'preferences',
  decision: 'decisions',
  lesson: 'lessons',
  entity: 'people',
  episode: 'transcripts',
  relationship: 'people'
};

function normalizeMessageContent(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    const parts = content
      .map((item) => {
        if (typeof item === 'string') return item;
        if (!item || typeof item !== 'object') return '';
        const record = item as Record<string, unknown>;
        if (typeof record.text === 'string') return record.text;
        if (typeof record.content === 'string') return record.content;
        return '';
      })
      .filter(Boolean);
    return parts.join('\n').trim();
  }

  if (content && typeof content === 'object') {
    const record = content as Record<string, unknown>;
    if (typeof record.text === 'string') return record.text;
    if (typeof record.content === 'string') return record.content;
  }

  return '';
}

function normalizeIncomingMessage(value: unknown): CaptureMessage | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const roleCandidate = record.role ?? record.authorRole ?? record.speaker ?? record.type;
  const role = typeof roleCandidate === 'string' ? roleCandidate.toLowerCase() : 'assistant';
  const content = normalizeMessageContent(record.content ?? record.text ?? record.message);
  if (!content.trim()) {
    return null;
  }
  const timestamp = typeof record.timestamp === 'string'
    ? record.timestamp
    : (typeof record.createdAt === 'string' ? record.createdAt : undefined);
  return { role, content, timestamp };
}

function titleForCandidate(candidate: CaptureCandidate): string {
  if (candidate.title && candidate.title.trim()) {
    return candidate.title.trim();
  }
  const stem = candidate.content.replace(/\s+/g, ' ').trim().split(' ').slice(0, 8).join(' ');
  return `${candidate.type}: ${stem}`.slice(0, 90);
}

function withCollisionSuffix(title: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${title} ${stamp}`;
}

export class LiveCaptureService {
  async captureTurn(messages: unknown[], options: CaptureOptions = {}): Promise<CaptureStoreResult> {
    const normalizedMessages = messages
      .map((message) => normalizeIncomingMessage(message))
      .filter((message): message is CaptureMessage => Boolean(message))
      .filter((message) => message.role === 'assistant');

    if (normalizedMessages.length === 0) {
      return {
        stored: 0,
        rejected: 0,
        storedDocuments: [],
        acceptedCandidates: [],
        rejectedCandidates: []
      };
    }

    const vaultPath = resolveVaultPath({
      explicitPath: options.vaultPath,
      agentId: options.agentId,
      pluginConfig: options.pluginConfig
    });
    const vault = new ClawVault(vaultPath);
    await vault.load();

    const extractedCandidates = normalizedMessages.flatMap((message) =>
      extractMemoriesFromAssistantResponse(message.content)
    );

    if (extractedCandidates.length === 0) {
      return {
        stored: 0,
        rejected: 0,
        storedDocuments: [],
        acceptedCandidates: [],
        rejectedCandidates: []
      };
    }

    const maxPerTurn = options.maxPerTurn ?? 8;
    const existingDocs = await vault.list();
    const existingContents = existingDocs.map((doc) => doc.content);
    const stagedAcceptedContents: string[] = [];
    const acceptedCandidates: CaptureCandidate[] = [];
    const rejectedCandidates: CaptureStoreResult['rejectedCandidates'] = [];

    for (const candidate of extractedCandidates) {
      if (acceptedCandidates.length >= maxPerTurn) {
        break;
      }
      const quality = evaluateCandidateQuality(
        candidate,
        existingContents,
        stagedAcceptedContents,
        {
          minConfidence: options.minConfidence,
          dedupThreshold: options.dedupThreshold
        }
      );
      if (!quality.accepted) {
        rejectedCandidates.push({
          candidate,
          reason: quality.reason ?? 'quality gate rejected candidate'
        });
        continue;
      }
      stagedAcceptedContents.push(candidate.content);
      acceptedCandidates.push(candidate);
    }

    const storedDocuments: string[] = [];
    for (const candidate of acceptedCandidates) {
      const doc = await this.persistCandidate(vault, candidate, options);
      storedDocuments.push(doc.id);
    }

    const hasEntityMentions = acceptedCandidates.some((candidate) => (candidate.entities?.length ?? 0) > 0);
    if (hasEntityMentions) {
      await synthesizeEntityProfiles(vaultPath, { writeFiles: true });
    }

    return {
      stored: storedDocuments.length,
      rejected: rejectedCandidates.length,
      storedDocuments,
      acceptedCandidates,
      rejectedCandidates
    };
  }

  private async persistCandidate(
    vault: ClawVault,
    candidate: CaptureCandidate,
    options: CaptureOptions
  ): Promise<Document> {
    const category = CATEGORY_BY_MEMORY_TYPE[candidate.type] ?? 'inbox';
    const title = titleForCandidate(candidate);
    const frontmatter: Record<string, unknown> = {
      memoryType: candidate.type,
      captureSource: candidate.source,
      confidence: Number(candidate.confidence.toFixed(3)),
      capturedAt: new Date().toISOString()
    };

    if (candidate.tags && candidate.tags.length > 0) {
      frontmatter.tags = candidate.tags;
    }
    if (candidate.entities && candidate.entities.length > 0) {
      frontmatter.entities = candidate.entities;
    }
    if (options.sourceSessionId) {
      frontmatter.sessionId = options.sourceSessionId;
    }
    if (candidate.metadata) {
      frontmatter.captureMetadata = candidate.metadata;
    }

    try {
      return await vault.store({
        category,
        title,
        content: candidate.content,
        frontmatter
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes('Document already exists')) {
        throw err;
      }
      return vault.store({
        category,
        title: withCollisionSuffix(title),
        content: candidate.content,
        frontmatter
      });
    }
  }
}

