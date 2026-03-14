import { normalizeForDedup, similarityScore } from '../lib/maintenance/heuristics.js';
import type { CaptureCandidate } from './types.js';

const SECRET_PATTERNS: RegExp[] = [
  /sk-[A-Za-z0-9]{20,}/,
  /AKIA[0-9A-Z]{16}/,
  /-----BEGIN (?:RSA|EC|OPENSSH|PGP|DSA) PRIVATE KEY-----/,
  /(?:api[-_ ]?key|access[-_ ]?token|secret)(?:\s*[:=]\s*|\s+)[A-Za-z0-9_\-]{12,}/i
];

const NOISE_PATTERNS: RegExp[] = [
  /^\s*[{[][\s\S]{30,}[}\]]\s*$/m,
  /^\s*\$?\s*(?:npm|pnpm|yarn|bun|git|docker|kubectl|curl|node)\b/m,
  /(?:stdout|stderr|exit code|stack trace|traceback|at\s+[A-Za-z0-9_.$]+\s+\()/i,
  /^\s*[|+]{2,}[-+| ]+\s*$/m
];

export interface QualityGateOptions {
  minConfidence?: number;
  minQualityScore?: number;
  dedupThreshold?: number;
}

export interface QualityGateResult {
  accepted: boolean;
  reason?: string;
  qualityScore: number;
  plausibilityScore: number;
  confidenceScore: number;
  maxSimilarity: number;
}

function countAlphaWords(value: string): number {
  const words = value.match(/[A-Za-z][A-Za-z0-9'-]*/g) ?? [];
  return words.length;
}

function symbolRatio(value: string): number {
  if (!value) return 1;
  const symbols = value.replace(/[A-Za-z0-9\s]/g, '').length;
  return symbols / value.length;
}

function lineDensity(value: string): number {
  const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return 0;
  const averageLength = lines.reduce((sum, line) => sum + line.length, 0) / lines.length;
  return averageLength;
}

export function isLikelyJunkMemory(content: string): boolean {
  if (!content || content.trim().length < 12) {
    return true;
  }

  if (SECRET_PATTERNS.some((pattern) => pattern.test(content))) {
    return true;
  }

  if (NOISE_PATTERNS.some((pattern) => pattern.test(content))) {
    return true;
  }

  if (symbolRatio(content) > 0.3) {
    return true;
  }

  if (lineDensity(content) > 180) {
    return true;
  }

  return false;
}

export function plausibilityScore(content: string): number {
  const trimmed = content.trim();
  if (trimmed.length === 0) return 0;

  const alphaWords = countAlphaWords(trimmed);
  const hasSentencePunctuation = /[.!?]$/.test(trimmed) || trimmed.length > 40;
  const hasVerbLikeWord = /\b(is|are|was|were|has|have|will|should|decided|prefer|learned|met|works|uses)\b/i.test(trimmed);
  const hasBalancedLength = trimmed.length >= 20 && trimmed.length <= 400;

  let score = 0;
  if (alphaWords >= 4) score += 0.3;
  if (alphaWords >= 8) score += 0.2;
  if (hasSentencePunctuation) score += 0.2;
  if (hasVerbLikeWord) score += 0.2;
  if (hasBalancedLength) score += 0.1;
  return Math.min(1, score);
}

function maxJaccardSimilarity(candidate: string, existingContents: string[]): number {
  if (existingContents.length === 0) return 0;
  let best = 0;
  const normalizedCandidate = normalizeForDedup(candidate);
  for (const entry of existingContents) {
    const score = similarityScore(normalizedCandidate, normalizeForDedup(entry));
    if (score > best) {
      best = score;
    }
  }
  return best;
}

export function evaluateCandidateQuality(
  candidate: CaptureCandidate,
  existingContents: string[],
  stagedContents: string[] = [],
  options: QualityGateOptions = {}
): QualityGateResult {
  const minConfidence = options.minConfidence ?? 0.4;
  const minQualityScore = options.minQualityScore ?? 0.4;
  const dedupThreshold = options.dedupThreshold ?? 0.82;

  if (candidate.confidence < minConfidence) {
    return {
      accepted: false,
      reason: `confidence below threshold (${candidate.confidence.toFixed(2)} < ${minConfidence.toFixed(2)})`,
      qualityScore: candidate.confidence,
      plausibilityScore: 0,
      confidenceScore: candidate.confidence,
      maxSimilarity: 0
    };
  }

  if (isLikelyJunkMemory(candidate.content)) {
    return {
      accepted: false,
      reason: 'candidate flagged as junk/tool noise',
      qualityScore: 0,
      plausibilityScore: 0,
      confidenceScore: candidate.confidence,
      maxSimilarity: 0
    };
  }

  const plausibility = plausibilityScore(candidate.content);
  const maxSimilarity = maxJaccardSimilarity(candidate.content, [...existingContents, ...stagedContents]);
  if (maxSimilarity >= dedupThreshold) {
    return {
      accepted: false,
      reason: `candidate too similar to existing memory (similarity=${maxSimilarity.toFixed(2)})`,
      qualityScore: 0,
      plausibilityScore: plausibility,
      confidenceScore: candidate.confidence,
      maxSimilarity
    };
  }

  const qualityScore = (candidate.confidence * 0.6) + (plausibility * 0.4);
  if (qualityScore < minQualityScore) {
    return {
      accepted: false,
      reason: `quality score below threshold (${qualityScore.toFixed(2)} < ${minQualityScore.toFixed(2)})`,
      qualityScore,
      plausibilityScore: plausibility,
      confidenceScore: candidate.confidence,
      maxSimilarity
    };
  }

  return {
    accepted: true,
    qualityScore,
    plausibilityScore: plausibility,
    confidenceScore: candidate.confidence,
    maxSimilarity
  };
}

