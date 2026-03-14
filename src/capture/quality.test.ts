import { describe, expect, it } from 'vitest';
import { evaluateCandidateQuality, isLikelyJunkMemory } from './quality.js';
import type { CaptureCandidate } from './types.js';

function candidate(overrides: Partial<CaptureCandidate> = {}): CaptureCandidate {
  return {
    content: 'We decided to cache user preferences in memory to reduce latency.',
    type: 'decision',
    confidence: 0.82,
    source: 'heuristic',
    ...overrides
  };
}

describe('capture quality gate', () => {
  it('rejects low-confidence candidates', () => {
    const result = evaluateCandidateQuality(
      candidate({ confidence: 0.2 }),
      []
    );
    expect(result.accepted).toBe(false);
    expect(result.reason).toContain('confidence below threshold');
  });

  it('rejects secrets and junk-like strings', () => {
    expect(isLikelyJunkMemory('sk-1234567890abcdefghijklmno')).toBe(true);
    const result = evaluateCandidateQuality(
      candidate({ content: '-----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY-----' }),
      []
    );
    expect(result.accepted).toBe(false);
    expect(result.reason).toContain('junk');
  });

  it('rejects near-duplicates via Jaccard similarity', () => {
    const existing = ['We decided to cache user preferences in memory to reduce latency for repeat queries.'];
    const result = evaluateCandidateQuality(
      candidate({ content: 'We decided to cache user preferences in memory to reduce latency for repeat queries.' }),
      existing
    );
    expect(result.accepted).toBe(false);
    expect(result.reason).toContain('too similar');
  });

  it('accepts plausible, unique candidates', () => {
    const result = evaluateCandidateQuality(
      candidate({ content: 'Alice prefers concise status updates every Friday morning.' }),
      ['Project Phoenix shipped with incremental indexing support.']
    );
    expect(result.accepted).toBe(true);
    expect(result.qualityScore).toBeGreaterThan(0.4);
  });
});

