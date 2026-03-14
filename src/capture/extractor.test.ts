import { describe, expect, it } from 'vitest';
import { extractHeuristicMemories, extractMemoriesFromAssistantResponse, extractTaggedMemoryNotes } from './extractor.js';

describe('capture extractor', () => {
  it('extracts <memory_note> blocks with metadata', () => {
    const text = `
      <memory_note type="decision" confidence="0.93" title="Cache Policy">
      We decided to keep a 5 minute cache TTL for profile lookups.
      </memory_note>
    `;
    const candidates = extractTaggedMemoryNotes(text);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].type).toBe('decision');
    expect(candidates[0].confidence).toBeCloseTo(0.93);
    expect(candidates[0].title).toContain('Cache');
  });

  it('extracts heuristic memories from assistant text', () => {
    const text = 'We learned that retries should use exponential backoff. Bob prefers short release notes.';
    const candidates = extractHeuristicMemories(text);
    expect(candidates.length).toBeGreaterThanOrEqual(2);
    expect(candidates.some((candidate) => candidate.type === 'lesson')).toBe(true);
    expect(candidates.some((candidate) => candidate.type === 'preference')).toBe(true);
  });

  it('combines tagged and heuristic extraction without duplicates', () => {
    const text = `
      <memory_note type="relationship">[[Alice]] works with [[Bob]] on API governance.</memory_note>
      Alice works with Bob on API governance.
    `;
    const candidates = extractMemoriesFromAssistantResponse(text);
    expect(candidates.some((candidate) => candidate.type === 'relationship')).toBe(true);
    expect(candidates.length).toBeGreaterThan(0);
  });
});

