export type EntityKind = 'person' | 'project' | 'org' | 'place' | 'unknown';

export interface EntityRelationship {
  target: string;
  strength: number;
  evidence: string[];
}

export interface EntityProfile {
  name: string;
  aliases: string[];
  kind: EntityKind;
  summary: string;
  relationships: EntityRelationship[];
  lastMentioned: string;
}

