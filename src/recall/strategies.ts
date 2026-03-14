import type { RecallQueryClassification, RecallStrategy } from './types.js';

const VERIFICATION_PATTERN = /\b(verify|verification|source|citation|cite|proof|prove|where did|evidence)\b/i;
const TEMPORAL_PATTERN = /\b(today|yesterday|last\s+(?:day|week|month|year)|this\s+(?:week|month|year)|recent|recently|timeline|when)\b/i;
const RELATIONSHIP_PATTERN = /\b(relationship|relates?|connected|between|depends on|works with|reports to|interacts? with)\b/i;

function parseTemporalWindowDays(query: string): number | undefined {
  if (/\byesterday\b/i.test(query)) return 2;
  if (/\btoday\b/i.test(query)) return 1;
  if (/\blast\s+day\b/i.test(query)) return 1;
  if (/\blast\s+week\b/i.test(query)) return 7;
  if (/\bthis\s+week\b/i.test(query)) return 7;
  if (/\blast\s+month\b/i.test(query)) return 31;
  if (/\bthis\s+month\b/i.test(query)) return 31;
  if (/\blast\s+year\b/i.test(query) || /\bthis\s+year\b/i.test(query)) return 366;
  return undefined;
}

function inferEntityName(query: string, knownEntityNames: string[]): string | undefined {
  const wikiLink = query.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
  if (wikiLink?.[1]) {
    return wikiLink[1].trim();
  }

  const normalizedQuery = query.toLowerCase();
  for (const entity of knownEntityNames) {
    if (!entity.trim()) continue;
    if (normalizedQuery.includes(entity.toLowerCase())) {
      return entity;
    }
  }

  const capSequence = query.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/);
  if (capSequence?.[1]) {
    return capSequence[1].trim();
  }

  return undefined;
}

export function classifyRecallQuery(
  query: string,
  knownEntityNames: string[] = [],
  forcedStrategy?: RecallStrategy
): RecallQueryClassification {
  if (forcedStrategy) {
    return {
      strategy: forcedStrategy,
      entityName: forcedStrategy === 'entity' ? inferEntityName(query, knownEntityNames) : undefined,
      temporalDays: forcedStrategy === 'temporal' ? parseTemporalWindowDays(query) : undefined
    };
  }

  const entityName = inferEntityName(query, knownEntityNames);
  if (RELATIONSHIP_PATTERN.test(query)) {
    return { strategy: 'relationship', entityName };
  }
  if (VERIFICATION_PATTERN.test(query)) {
    return { strategy: 'verification', entityName };
  }
  if (TEMPORAL_PATTERN.test(query)) {
    return {
      strategy: 'temporal',
      entityName,
      temporalDays: parseTemporalWindowDays(query)
    };
  }
  if (entityName) {
    return { strategy: 'entity', entityName };
  }
  return { strategy: 'quick' };
}

