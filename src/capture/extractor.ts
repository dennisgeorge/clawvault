import type { CaptureCandidate, CapturedMemoryType } from './types.js';

const MEMORY_NOTE_PATTERN = /<memory_note([^>]*)>([\s\S]*?)<\/memory_note>/gi;
const WIKI_LINK_PATTERN = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
const SENTENCE_SPLIT_PATTERN = /\r?\n|(?<=[.?!])\s+/;

const CLASSIFIER_RULES: Array<{
  type: CapturedMemoryType;
  confidence: number;
  pattern: RegExp;
}> = [
  { type: 'decision', confidence: 0.74, pattern: /\b(decid(?:e|ed|ing|ion)|chose|selected|opted|agreed|we will|i will)\b/i },
  { type: 'preference', confidence: 0.72, pattern: /\b(prefer(?:ence|red|s)?|like(?:s|d)?|dislike|always use|never use|default to)\b/i },
  { type: 'lesson', confidence: 0.76, pattern: /\b(learn(?:ed|ing|t)|lesson|insight|takeaway|next time|mistake|realized)\b/i },
  { type: 'relationship', confidence: 0.69, pattern: /\b(works with|reports to|collaborates with|partnered with|depends on|related to)\b/i },
  { type: 'episode', confidence: 0.64, pattern: /\b(today|yesterday|this morning|this afternoon|during|after|before|in the meeting)\b/i },
  { type: 'entity', confidence: 0.62, pattern: /\[\[[^\]]+\]\]/i }
];

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function parseNoteAttributes(raw: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const attributePattern = /([a-zA-Z_][\w-]*)\s*=\s*"([^"]*)"/g;
  let match = attributePattern.exec(raw);
  while (match) {
    attributes[match[1]] = match[2];
    match = attributePattern.exec(raw);
  }
  return attributes;
}

function sanitizeType(value?: string): CapturedMemoryType | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  const allowed: CapturedMemoryType[] = [
    'fact',
    'preference',
    'decision',
    'lesson',
    'entity',
    'episode',
    'relationship'
  ];
  return allowed.includes(normalized as CapturedMemoryType)
    ? (normalized as CapturedMemoryType)
    : null;
}

function parseConfidence(value?: string, fallback: number = 0.85): number {
  if (!value) return fallback;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(1, Math.max(0, parsed));
}

function extractEntities(text: string): string[] {
  const entities = new Set<string>();
  WIKI_LINK_PATTERN.lastIndex = 0;
  let linkMatch = WIKI_LINK_PATTERN.exec(text);
  while (linkMatch) {
    entities.add(linkMatch[1].trim());
    linkMatch = WIKI_LINK_PATTERN.exec(text);
  }

  const properNounPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/g;
  let nounMatch = properNounPattern.exec(text);
  while (nounMatch) {
    const value = nounMatch[1].trim();
    if (value.length >= 3) {
      entities.add(value);
    }
    nounMatch = properNounPattern.exec(text);
  }

  return [...entities];
}

function inferTypeFromSentence(sentence: string): { type: CapturedMemoryType; confidence: number } {
  for (const rule of CLASSIFIER_RULES) {
    if (rule.pattern.test(sentence)) {
      return { type: rule.type, confidence: rule.confidence };
    }
  }
  return { type: 'fact', confidence: 0.55 };
}

function titleFromContent(type: CapturedMemoryType, content: string): string {
  const words = normalizeWhitespace(content).split(' ').filter(Boolean).slice(0, 8);
  const stem = words.join(' ');
  return `${type}: ${stem}`.slice(0, 90);
}

function dedupeCandidates(candidates: CaptureCandidate[]): CaptureCandidate[] {
  const seen = new Set<string>();
  const deduped: CaptureCandidate[] = [];
  for (const candidate of candidates) {
    const key = normalizeWhitespace(candidate.content).toLowerCase();
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(candidate);
  }
  return deduped;
}

export function extractTaggedMemoryNotes(text: string): CaptureCandidate[] {
  const candidates: CaptureCandidate[] = [];
  MEMORY_NOTE_PATTERN.lastIndex = 0;
  let match = MEMORY_NOTE_PATTERN.exec(text);
  while (match) {
    const attributes = parseNoteAttributes(match[1] ?? '');
    const body = normalizeWhitespace(match[2] ?? '');
    if (!body) {
      match = MEMORY_NOTE_PATTERN.exec(text);
      continue;
    }
    const type = sanitizeType(attributes.type) ?? inferTypeFromSentence(body).type;
    const confidence = parseConfidence(attributes.confidence, 0.9);
    const entities = extractEntities(body);
    candidates.push({
      content: body,
      type,
      confidence,
      title: attributes.title || titleFromContent(type, body),
      tags: attributes.tags ? attributes.tags.split(',').map((item) => item.trim()).filter(Boolean) : undefined,
      entities,
      source: 'memory_note',
      metadata: {
        taggedType: attributes.type,
        rawAttributes: attributes
      }
    });
    match = MEMORY_NOTE_PATTERN.exec(text);
  }
  return dedupeCandidates(candidates);
}

function stripMemoryNotes(text: string): string {
  return text.replace(MEMORY_NOTE_PATTERN, ' ');
}

export function extractHeuristicMemories(text: string): CaptureCandidate[] {
  const sanitized = stripMemoryNotes(text);
  const sentences = sanitized
    .split(SENTENCE_SPLIT_PATTERN)
    .map((line) => normalizeWhitespace(line))
    .filter((line) => line.length >= 20 && line.length <= 400);

  const candidates: CaptureCandidate[] = [];
  for (const sentence of sentences) {
    const classification = inferTypeFromSentence(sentence);
    const entities = extractEntities(sentence);
    const confidenceBoost = entities.length > 0 ? 0.08 : 0;
    candidates.push({
      content: sentence,
      type: classification.type,
      confidence: Math.min(1, classification.confidence + confidenceBoost),
      title: titleFromContent(classification.type, sentence),
      entities,
      source: 'heuristic'
    });
  }
  return dedupeCandidates(candidates);
}

export function extractMemoriesFromAssistantResponse(text: string): CaptureCandidate[] {
  const fromTags = extractTaggedMemoryNotes(text);
  const fromHeuristics = extractHeuristicMemories(text);
  return dedupeCandidates([...fromTags, ...fromHeuristics]);
}

