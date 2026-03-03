/**
 * Write-time fact extraction for ClawVault v3.
 *
 * When a memory is stored, this module extracts structured facts:
 *   (entity, relation, value, timestamp, confidence)
 *
 * Two modes:
 *   1. LLM extraction (accurate but requires API key)
 *   2. Rule-based extraction (fast, no deps, lower quality)
 *
 * Extracted facts are stored alongside raw markdown in .clawvault/facts.jsonl
 * and used to build the entity-relationship graph.
 */

export interface ExtractedFact {
  /** Unique ID for this fact */
  id: string;
  /** The entity this fact is about (person, place, thing) */
  entity: string;
  /** Normalized entity name for dedup */
  entityNorm: string;
  /** Relationship type (e.g., "prefers", "works_at", "lives_in", "bought") */
  relation: string;
  /** The value/object of the relation */
  value: string;
  /** When this fact was established */
  validFrom: string;
  /** When this fact was superseded (null = still current) */
  validUntil: string | null;
  /** Confidence 0-1 */
  confidence: number;
  /** Category: preference, fact, decision, entity, event */
  category: 'preference' | 'fact' | 'decision' | 'entity' | 'event' | 'other';
  /** Source file path (relative to vault) */
  source: string;
  /** Raw text this was extracted from */
  rawText: string;
}

export interface ExtractionResult {
  facts: ExtractedFact[];
  /** Number of conflicts resolved (existing facts updated) */
  conflictsResolved: number;
  /** Processing time in ms */
  durationMs: number;
}

/**
 * Normalize an entity name for dedup matching.
 * "Pedro Sobral" -> "pedro sobral"
 * "pedro" -> "pedro"
 * "Dr. Smith" -> "dr smith"
 */
export function normalizeEntity(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generate a deterministic fact ID from entity + relation + value.
 */
export function factId(entity: string, relation: string, value: string): string {
  const key = `${normalizeEntity(entity)}::${relation.toLowerCase()}::${value.toLowerCase().trim()}`;
  // Simple hash
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

// ─── Rule-based extraction (no LLM needed) ─────────────────────────────────

interface PatternRule {
  /** Regex pattern to match */
  pattern: RegExp;
  /** How to extract entity, relation, value from match groups */
  extract: (match: RegExpMatchArray) => { entity: string; relation: string; value: string; category: ExtractedFact['category'] } | null;
}

const PREFERENCE_PATTERNS: PatternRule[] = [
  {
    // "I prefer X" / "I like X" / "I love X" / "I enjoy X"
    pattern: /\b(?:i|user|they)\s+(?:prefer|like|love|enjoy|want|favor)s?\s+(.+?)(?:\.|,|$)/i,
    extract: (m) => ({
      entity: 'user',
      relation: 'prefers',
      value: m[1].trim(),
      category: 'preference'
    })
  },
  {
    // "my favorite X is Y"
    pattern: /\bmy\s+(?:favorite|favourite|preferred)\s+(\w+)\s+(?:is|are)\s+(.+?)(?:\.|,|$)/i,
    extract: (m) => ({
      entity: 'user',
      relation: `favorite_${m[1].toLowerCase()}`,
      value: m[2].trim(),
      category: 'preference'
    })
  },
  {
    // "I don't like X" / "I hate X" / "I dislike X"
    pattern: /\b(?:i|user)\s+(?:don'?t\s+like|hate|dislike|avoid)s?\s+(.+?)(?:\.|,|$)/i,
    extract: (m) => ({
      entity: 'user',
      relation: 'dislikes',
      value: m[1].trim(),
      category: 'preference'
    })
  },
  {
    // "I'm allergic to X" / "I have an allergy to X"
    pattern: /\b(?:i'?m|i\s+am|i\s+have)\s+(?:an?\s+)?allerg(?:ic|y)\s+(?:to\s+)?(.+?)(?:\.|,|$)/i,
    extract: (m) => ({
      entity: 'user',
      relation: 'allergic_to',
      value: m[1].trim(),
      category: 'preference'
    })
  }
];

const FACT_PATTERNS: PatternRule[] = [
  {
    // "X works at Y" / "X is employed at Y"
    pattern: /\b(\w+(?:\s+\w+)?)\s+(?:works?\s+(?:at|for)|is\s+employed\s+(?:at|by))\s+(.+?)(?:\.|,|$)/i,
    extract: (m) => ({
      entity: m[1].trim(),
      relation: 'works_at',
      value: m[2].trim(),
      category: 'fact'
    })
  },
  {
    // "X lives in Y" / "X moved to Y"
    pattern: /\b(\w+(?:\s+\w+)?)\s+(?:live[sd]?\s+in|moved?\s+to|relocated?\s+to)\s+(.+?)(?:\.|,|$)/i,
    extract: (m) => ({
      entity: m[1].trim(),
      relation: 'lives_in',
      value: m[2].trim(),
      category: 'fact'
    })
  },
  {
    // "X is Y years old" / "X's age is Y"
    pattern: /\b(\w+(?:\s+\w+)?)\s+(?:is|turned)\s+(\d+)\s+years?\s+old/i,
    extract: (m) => ({
      entity: m[1].trim(),
      relation: 'age',
      value: m[2],
      category: 'fact'
    })
  },
  {
    // "X bought Y" / "X purchased Y"
    pattern: /\b(\w+(?:\s+\w+)?)\s+(?:bought|purchased|got|acquired)\s+(?:a\s+|an\s+|the\s+)?(.+?)(?:\s+for\s+\$?([\d,.]+))?(?:\.|,|$)/i,
    extract: (m) => ({
      entity: m[1].trim(),
      relation: 'bought',
      value: m[3] ? `${m[2].trim()} ($${m[3]})` : m[2].trim(),
      category: 'event'
    })
  },
  {
    // "X spent $Y on Z"
    pattern: /\b(\w+(?:\s+\w+)?)\s+spent\s+\$?([\d,.]+)\s+on\s+(.+?)(?:\.|,|$)/i,
    extract: (m) => ({
      entity: m[1].trim(),
      relation: 'spent_on',
      value: `$${m[2]} on ${m[3].trim()}`,
      category: 'event'
    })
  }
];

const DECISION_PATTERNS: PatternRule[] = [
  {
    // "decided to X" / "we decided X"
    pattern: /\b(?:i|we|user)\s+decided\s+(?:to\s+)?(.+?)(?:\.|,|$)/i,
    extract: (m) => ({
      entity: 'user',
      relation: 'decided',
      value: m[1].trim(),
      category: 'decision'
    })
  },
  {
    // "chose X over Y"
    pattern: /\b(?:i|we|user)\s+chose\s+(.+?)\s+over\s+(.+?)(?:\.|,|$)/i,
    extract: (m) => ({
      entity: 'user',
      relation: 'chose',
      value: `${m[1].trim()} (over ${m[2].trim()})`,
      category: 'decision'
    })
  }
];

const ALL_PATTERNS = [...PREFERENCE_PATTERNS, ...FACT_PATTERNS, ...DECISION_PATTERNS];

/**
 * Extract facts from raw text using rule-based patterns.
 * Fast, no LLM needed, but lower quality.
 */
export function extractFactsRuleBased(
  text: string,
  source: string,
  timestamp?: string
): ExtractedFact[] {
  const facts: ExtractedFact[] = [];
  const now = timestamp || new Date().toISOString();

  // Split into sentences for better pattern matching
  const sentences = text.split(/[.!?\n]+/).filter(s => s.trim().length > 5);

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    for (const rule of ALL_PATTERNS) {
      const match = trimmed.match(rule.pattern);
      if (match) {
        const extracted = rule.extract(match);
        if (extracted && extracted.value.length > 1 && extracted.value.length < 200) {
          facts.push({
            id: factId(extracted.entity, extracted.relation, extracted.value),
            entity: extracted.entity,
            entityNorm: normalizeEntity(extracted.entity),
            relation: extracted.relation,
            value: extracted.value,
            validFrom: now,
            validUntil: null,
            confidence: 0.7, // Rule-based gets moderate confidence
            category: extracted.category,
            source,
            rawText: trimmed
          });
        }
      }
    }
  }

  return facts;
}

// ─── LLM-based extraction ───────────────────────────────────────────────────

const EXTRACTION_PROMPT = `Extract structured facts from the following text. Return ONLY a JSON array of objects with these fields:
- entity: the subject (person, place, thing, or "user" for the speaker/first person)
- relation: the relationship type (see examples below)
- value: the object of the relation
- category: one of "preference", "fact", "decision", "entity", "event"
- confidence: 0.0 to 1.0

PREFERENCE EXTRACTION (critical — extract ALL of these):
- Likes, dislikes, preferences, favorites: "prefers", "likes", "dislikes", "favorite"
- Food/dietary: "allergic_to", "dietary_restriction", "favorite_food", "dislikes_food"
- Habits/routines: "habit", "routine", "schedule"
- Communication style: "prefers_communication", "timezone", "language"
- Tools/tech: "uses_tool", "prefers_editor", "prefers_language"

TEMPORAL FACTS (include dates when present):
- Include specific dates, times, relative references ("last Tuesday" = resolve if possible)
- Events: "happened_on", "started_on", "ended_on", "deadline"
- Use ISO format for dates when possible

OTHER RELATIONS:
- Identity: "works_at", "lives_in", "age", "role", "email", "phone"
- Actions: "bought", "spent_on", "created", "visited", "completed"
- Decisions: "decided", "chose", "rejected", "approved"
- Knowledge: "knows_about", "studied", "expertise"

Examples:

Input: "I really love Thai food, especially pad thai. I'm allergic to shellfish though."
Output: [
  {"entity": "user", "relation": "favorite_food", "value": "Thai food, especially pad thai", "category": "preference", "confidence": 0.95},
  {"entity": "user", "relation": "allergic_to", "value": "shellfish", "category": "preference", "confidence": 0.99}
]

Input: "We decided on Tuesday to use PostgreSQL for the new project. John will lead the backend team."
Output: [
  {"entity": "team", "relation": "decided", "value": "use PostgreSQL for the new project", "category": "decision", "confidence": 0.95},
  {"entity": "John", "relation": "role", "value": "backend team lead", "category": "fact", "confidence": 0.9}
]

Input: "My morning routine is: wake up at 6am, coffee, then gym. I prefer working out before work."
Output: [
  {"entity": "user", "relation": "routine", "value": "wake up at 6am, coffee, then gym", "category": "preference", "confidence": 0.9},
  {"entity": "user", "relation": "prefers", "value": "working out before work", "category": "preference", "confidence": 0.9}
]

Rules:
- Extract ALL facts, preferences, decisions, and events — err on the side of extracting more
- For preferences, use "user" as entity unless a specific person is named
- For monetary amounts, include the currency symbol
- Be precise — only extract what is explicitly stated or strongly implied
- Return empty array [] if no extractable facts found

Text:
`;

/**
 * Extract facts using an LLM. Higher quality but requires API key.
 * Falls back to rule-based if LLM unavailable.
 */
export async function extractFactsLlm(
  text: string,
  source: string,
  timestamp?: string,
  llmFn?: (prompt: string) => Promise<string>
): Promise<ExtractedFact[]> {
  if (!llmFn) {
    return extractFactsRuleBased(text, source, timestamp);
  }

  const now = timestamp || new Date().toISOString();

  try {
    const response = await llmFn(EXTRACTION_PROMPT + text);

    // Parse JSON from response (handle markdown code blocks)
    const jsonMatch = response.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) {
      return extractFactsRuleBased(text, source, timestamp);
    }

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      entity: string;
      relation: string;
      value: string;
      category: string;
      confidence: number;
    }>;

    return parsed.map(f => ({
      id: factId(f.entity, f.relation, f.value),
      entity: f.entity,
      entityNorm: normalizeEntity(f.entity),
      relation: f.relation,
      value: f.value,
      validFrom: now,
      validUntil: null,
      confidence: Math.min(1, Math.max(0, f.confidence || 0.8)),
      category: (f.category as ExtractedFact['category']) || 'fact',
      source,
      rawText: text.substring(0, 500)
    }));
  } catch {
    // LLM failed, fall back to rules
    return extractFactsRuleBased(text, source, timestamp);
  }
}
