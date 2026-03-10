import { EntityIndex, getSortedAliases } from './entity-index.js';

interface ProtectedRange {
  start: number;
  end: number;
}

interface PlannedLink {
  start: number;
  end: number;
  originalText: string;
  path: string;
}

/**
 * Find all protected ranges in the content that should not be linked:
 * - Frontmatter (--- blocks)
 * - Code blocks (``` or ~~~)
 * - Inline code (`)
 * - Existing wiki links ([[...]])
 * - URLs
 * - Filesystem paths
 */
function findProtectedRanges(content: string): ProtectedRange[] {
  const ranges: ProtectedRange[] = [];
  
  // Frontmatter (must be at start)
  const fmMatch = content.match(/^---\n[\s\S]*?\n---/);
  if (fmMatch) {
    ranges.push({ start: 0, end: fmMatch[0].length });
  }
  
  // Code blocks
  const codeBlockRegex = /```[\s\S]*?```|~~~[\s\S]*?~~~/g;
  let match;
  while ((match = codeBlockRegex.exec(content)) !== null) {
    ranges.push({ start: match.index, end: match.index + match[0].length });
  }
  
  // Inline code (single backticks only; avoids matching fenced code markers)
  const inlineCodeRegex = /(?<!`)`[^`\n]+`(?!`)/g;
  while ((match = inlineCodeRegex.exec(content)) !== null) {
    ranges.push({ start: match.index, end: match.index + match[0].length });
  }
  
  // Existing wiki links
  const wikiLinkRegex = /\[\[[^\]]+\]\]/g;
  while ((match = wikiLinkRegex.exec(content)) !== null) {
    ranges.push({ start: match.index, end: match.index + match[0].length });
  }
  
  // URLs
  const urlRegex = /https?:\/\/[^\s)>\]]+/g;
  while ((match = urlRegex.exec(content)) !== null) {
    ranges.push({ start: match.index, end: match.index + match[0].length });
  }

  // Filesystem-like paths. Protect whole path tokens so linking does not corrupt them.
  const filePathRegex = /(?:^|[\s([{"'])((?:~|\/)[^\s`<>\])}"']+|[A-Za-z]:\\[^\s`<>\])}"']+)/g;
  while ((match = filePathRegex.exec(content)) !== null) {
    const fullMatch = match[0];
    const pathValue = match[1];
    const start = match.index + fullMatch.indexOf(pathValue);
    ranges.push({ start, end: start + pathValue.length });
  }
  
  return ranges;
}

function isProtectedRange(start: number, end: number, ranges: ProtectedRange[]): boolean {
  return ranges.some(range => start < range.end && end > range.start);
}

function createAliasRegex(alias: string): RegExp {
  const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escapedAlias}\\b`, 'gi');
}

function formatWikiLink(path: string, originalText: string): string {
  return originalText.toLowerCase() === path.split('/').pop()?.toLowerCase()
    ? `[[${path}]]`
    : `[[${path}|${originalText}]]`;
}

function planLinks(content: string, index: EntityIndex, protectedRanges: ProtectedRange[]): PlannedLink[] {
  const sortedAliases = getSortedAliases(index);
  const linkedEntities = new Set<string>();
  const claimedRanges: ProtectedRange[] = [];
  const plannedLinks: PlannedLink[] = [];

  for (const { alias, path } of sortedAliases) {
    // Skip if we already linked this entity
    if (linkedEntities.has(path)) continue;

    const regex = createAliasRegex(alias);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const start = match.index;
      const end = start + match[0].length;

      if (isProtectedRange(start, end, protectedRanges)) continue;
      if (isProtectedRange(start, end, claimedRanges)) continue;

      plannedLinks.push({
        start,
        end,
        originalText: match[0],
        path
      });
      claimedRanges.push({ start, end });
      linkedEntities.add(path);
      break; // Only link first occurrence
    }
  }

  return plannedLinks;
}

function createLineLookup(content: string): (pos: number) => number {
  const lines = content.split('\n');
  let charPos = 0;
  const lineStarts: number[] = [];
  for (const line of lines) {
    lineStarts.push(charPos);
    charPos += line.length + 1;
  }

  return (pos: number) => {
    for (let i = lineStarts.length - 1; i >= 0; i--) {
      if (pos >= lineStarts[i]) return i + 1;
    }
    return 1;
  };
}

/**
 * Auto-link entities in markdown content.
 * Only links first occurrence of each entity.
 * Skips protected ranges (frontmatter, code, existing links, URLs).
 */
export function autoLink(content: string, index: EntityIndex): string {
  const protectedRanges = findProtectedRanges(content);
  const plannedLinks = planLinks(content, index, protectedRanges);
  let result = content;

  // Apply from end to start so indexes remain valid without offset bookkeeping.
  const sortedByPosition = plannedLinks.slice().sort((a, b) => b.start - a.start);
  for (const planned of sortedByPosition) {
    const replacement = formatWikiLink(planned.path, planned.originalText);
    result = result.substring(0, planned.start) + replacement + result.substring(planned.end);
  }
  
  return result;
}

/**
 * Show what would be linked (dry run)
 */
export function dryRunLink(content: string, index: EntityIndex): Array<{ alias: string; path: string; line: number }> {
  const protectedRanges = findProtectedRanges(content);
  const plannedLinks = planLinks(content, index, protectedRanges);
  const getLineNumber = createLineLookup(content);

  return plannedLinks.map((planned) => ({
    alias: planned.originalText,
    path: planned.path,
    line: getLineNumber(planned.start)
  }));
}

/**
 * Find unlinked mentions of entities (suggested links).
 */
export function findUnlinkedMentions(
  content: string,
  index: EntityIndex
): Array<{ alias: string; path: string; line: number }> {
  const protectedRanges = findProtectedRanges(content);
  const sortedAliases = getSortedAliases(index);
  const matches: Array<{ alias: string; path: string; line: number }> = [];
  const seen = new Set<string>();
  const getLineNumber = createLineLookup(content);

  for (const { alias, path } of sortedAliases) {
    if (seen.has(path)) continue;

    const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedAlias}\\b`, 'gi');

    let match;
    while ((match = regex.exec(content)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      if (isProtectedRange(start, end, protectedRanges)) continue;

      matches.push({
        alias: match[0],
        path,
        line: getLineNumber(match.index)
      });
      seen.add(path);
      break;
    }
  }

  return matches;
}
