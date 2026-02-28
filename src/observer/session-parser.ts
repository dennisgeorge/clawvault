import * as fs from 'fs';
import * as path from 'path';

type SessionFormat = 'plain' | 'jsonl' | 'markdown';

const JSONL_SAMPLE_LIMIT = 20;
const MARKDOWN_SIGNAL_RE = /^(#{1,6}\s|[-*+]\s|>\s)/;
const MARKDOWN_INLINE_RE = /(\[[^\]]+\]\([^)]+\)|[*_`~])/;
const BASE64_DATA_URI_RE = /\bdata:[^;\s]+;base64,[A-Za-z0-9+/=]{24,}\b/gi;
const LONG_BASE64_TOKEN_RE = /\b[A-Za-z0-9+/]{80,}={0,2}\b/g;
const STRUCTURED_NOISE_MARKER_RE =
  /\b(?:tool[_-]?result|tool[_-]?use|toolcallid|tooluseid|function[_-]?(?:call|result)|stdout|stderr|exitcode|recordedat|trace(?:_|-)?id|parent(?:_|-)?id|session(?:_|-)?id|metadata|base64|mime(?:type)?)\b/i;
const NOISY_PREFIX_RE = /^(?:metadata|system metadata|session metadata)\s*:/i;

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function shouldDropRole(role: string): boolean {
  const normalized = normalizeToken(role);
  if (!normalized) {
    return false;
  }
  if (normalized === 'system' || normalized === 'developer' || normalized === 'metadata') {
    return true;
  }
  return normalized.startsWith('tool');
}

function isNoisyBlockType(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  const normalized = normalizeToken(value);
  if (!normalized || normalized === 'text' || normalized === 'markdown') {
    return false;
  }

  return normalized.includes('tool')
    || normalized.includes('functioncall')
    || normalized.includes('functionresult')
    || normalized.includes('thinking')
    || normalized.includes('reason')
    || normalized.includes('metadata');
}

function stripNoisyData(value: string): string {
  return normalizeText(
    value
      .replace(BASE64_DATA_URI_RE, ' ')
      .replace(LONG_BASE64_TOKEN_RE, ' ')
  );
}

function isLikelyStructuredNoise(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return true;
  }
  if (NOISY_PREFIX_RE.test(trimmed)) {
    return true;
  }

  const looksStructured = trimmed.startsWith('{') || trimmed.startsWith('[');
  if (looksStructured && STRUCTURED_NOISE_MARKER_RE.test(trimmed) && trimmed.length >= 40) {
    return true;
  }

  return false;
}

function sanitizeExtractedText(value: string): string {
  const stripped = stripNoisyData(value);
  if (!stripped) {
    return '';
  }
  if (isLikelyStructuredNoise(stripped)) {
    return '';
  }
  return stripped;
}

function sanitizeParsedMessage(message: string): string {
  const normalized = normalizeText(message);
  if (!normalized) {
    return '';
  }

  const roleMatch = /^([a-z][a-z0-9_-]{1,31})\s*:\s*(.+)$/i.exec(normalized);
  if (roleMatch) {
    const role = normalizeRole(roleMatch[1]);
    if (shouldDropRole(role)) {
      return '';
    }
    const content = sanitizeExtractedText(roleMatch[2]);
    if (!content) {
      return '';
    }
    return role ? `${role}: ${content}` : content;
  }

  return sanitizeExtractedText(normalized);
}

function extractText(value: unknown): string {
  if (typeof value === 'string') {
    return sanitizeExtractedText(value);
  }

  if (Array.isArray(value)) {
    const parts: string[] = [];
    for (const part of value) {
      const extracted = extractText(part);
      if (extracted) {
        parts.push(extracted);
      }
    }
    return normalizeText(parts.join(' '));
  }

  if (!value || typeof value !== 'object') {
    return '';
  }

  const record = value as Record<string, unknown>;
  if (isNoisyBlockType(record.type)) {
    return '';
  }

  if (typeof record.text === 'string') {
    return sanitizeExtractedText(record.text);
  }
  if (typeof record.content === 'string') {
    return sanitizeExtractedText(record.content);
  }
  if (record.content !== undefined) {
    return extractText(record.content);
  }

  return '';
}

function normalizeRole(role: unknown): string {
  if (typeof role !== 'string') {
    return '';
  }
  const normalized = role.trim().toLowerCase();
  if (!normalized) {
    return '';
  }
  return normalized;
}

function isLikelyJsonMessage(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  if ('role' in record && 'content' in record) {
    return true;
  }

  if (record.type === 'message' && record.message && typeof record.message === 'object') {
    return true;
  }

  return false;
}

function parseJsonLine(line: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return '';
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return '';
  }

  const entry = parsed as Record<string, unknown>;

  if ('role' in entry && 'content' in entry) {
    const role = normalizeRole(entry.role);
    if (shouldDropRole(role)) return '';
    const content = extractText(entry.content);
    if (!content) return '';
    return sanitizeParsedMessage(role ? `${role}: ${content}` : content);
  }

  if (entry.type === 'message' && entry.message && typeof entry.message === 'object') {
    const message = entry.message as Record<string, unknown>;
    const role = normalizeRole(message.role);
    if (shouldDropRole(role)) return '';
    const content = extractText(message.content);
    if (!content) return '';
    return sanitizeParsedMessage(role ? `${role}: ${content}` : content);
  }

  return '';
}

function parseJsonLines(raw: string): string[] {
  const messages: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parsed = parseJsonLine(trimmed);
    if (parsed) {
      messages.push(parsed);
    }
  }
  return messages;
}

function stripMarkdownSyntax(text: string): string {
  return normalizeText(
    text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[*_`~]/g, '')
      .replace(/<[^>]+>/g, '')
  );
}

function normalizeMarkdownLine(line: string): string {
  return stripMarkdownSyntax(
    line
      .replace(/^>\s*/, '')
      .replace(/^[-*+]\s+/, '')
      .replace(/^#{1,6}\s+/, '')
  );
}

function parseMarkdown(raw: string): string[] {
  const withoutCodeBlocks = raw.replace(/```[\s\S]*?```/g, ' ');
  const blocks = withoutCodeBlocks
    .split(/\r?\n\s*\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  const messages: string[] = [];
  for (const block of blocks) {
    const lines = block
      .split(/\r?\n/)
      .map((line) => normalizeMarkdownLine(line))
      .filter(Boolean);

    if (lines.length === 0) {
      continue;
    }

    const joined = stripMarkdownSyntax(lines.join(' '));
    if (!joined) continue;

    const roleMatch = /^(user|assistant|system|tool)\s*:?\s*(.+)$/i.exec(joined);
    if (roleMatch) {
      const role = normalizeRole(roleMatch[1]);
      const content = normalizeText(roleMatch[2]);
      const parsed = sanitizeParsedMessage(`${role}: ${content}`);
      if (parsed) {
        messages.push(parsed);
      }
      continue;
    }

    const parsed = sanitizeParsedMessage(joined);
    if (parsed) {
      messages.push(parsed);
    }
  }

  return messages;
}

function parsePlainText(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => sanitizeParsedMessage(line))
    .filter(Boolean);
}

function detectSessionFormat(raw: string, filePath: string): SessionFormat {
  const nonEmptyLines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (nonEmptyLines.length === 0) {
    return 'plain';
  }

  const sample = nonEmptyLines.slice(0, JSONL_SAMPLE_LIMIT);
  const jsonHits = sample.filter((line) => {
    try {
      const parsed = JSON.parse(line) as unknown;
      return isLikelyJsonMessage(parsed);
    } catch {
      return false;
    }
  }).length;

  if (jsonHits >= Math.max(1, Math.ceil(sample.length * 0.6))) {
    return 'jsonl';
  }

  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.md' || ext === '.markdown') {
    return 'markdown';
  }

  const markdownSignals = sample.filter((line) => MARKDOWN_SIGNAL_RE.test(line) || MARKDOWN_INLINE_RE.test(line)).length;
  if (markdownSignals >= Math.max(2, Math.ceil(sample.length * 0.4))) {
    return 'markdown';
  }

  return 'plain';
}

export function parseSessionFile(filePath: string): string[] {
  const resolved = path.resolve(filePath);
  const raw = fs.readFileSync(resolved, 'utf-8');
  const format = detectSessionFormat(raw, resolved);

  if (format === 'jsonl') {
    return parseJsonLines(raw);
  }

  if (format === 'markdown') {
    const parsed = parseMarkdown(raw);
    if (parsed.length > 0) {
      return parsed;
    }
  }

  return parsePlainText(raw);
}
