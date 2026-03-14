import { describe, expect, it } from 'vitest';
import { classifyRecallQuery } from './strategies.js';

describe('classifyRecallQuery', () => {
  it('classifies verification intent', () => {
    const result = classifyRecallQuery('Verify the source for the API timeout decision');
    expect(result.strategy).toBe('verification');
  });

  it('classifies temporal intent and window', () => {
    const result = classifyRecallQuery('What changed last week in deployment strategy?');
    expect(result.strategy).toBe('temporal');
    expect(result.temporalDays).toBe(7);
  });

  it('classifies relationship intent', () => {
    const result = classifyRecallQuery('What is the relationship between Alice and Bob?');
    expect(result.strategy).toBe('relationship');
  });

  it('detects entity from known names', () => {
    const result = classifyRecallQuery('Summarize Project Phoenix status', ['Project Phoenix']);
    expect(result.strategy).toBe('entity');
    expect(result.entityName).toBe('Project Phoenix');
  });

  it('defaults to quick strategy', () => {
    const result = classifyRecallQuery('summarize priorities');
    expect(result.strategy).toBe('quick');
  });
});

