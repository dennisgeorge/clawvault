#!/usr/bin/env node
/**
 * Semantic reranking helper for ClawVault plugin.
 * Called synchronously via execFileSync.
 * 
 * Usage: node semantic-rerank.mjs <query> <cache-path> <results-json>
 * Outputs: JSON array of {docid, score, original_score, semantic_score} sorted by RRF
 */
import { readFileSync, existsSync } from 'fs';

const query = process.argv[2];
const cachePath = process.argv[3];
const resultsJson = process.argv[4];

if (!query || !cachePath || !resultsJson) {
  console.log(JSON.stringify([]));
  process.exit(0);
}

// Load embedding cache
let cache;
try {
  if (!existsSync(cachePath)) {
    // No cache yet — return original results unchanged
    console.log(resultsJson);
    process.exit(0);
  }
  cache = JSON.parse(readFileSync(cachePath, 'utf-8'));
} catch {
  console.log(resultsJson);
  process.exit(0);
}

// Parse BM25 results
let bm25Results;
try {
  bm25Results = JSON.parse(resultsJson);
} catch {
  console.log('[]');
  process.exit(0);
}

// Get query embedding from Ollama
async function getEmbedding(text) {
  try {
    const resp = await fetch('http://localhost:11434/api/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'nomic-embed-text', prompt: text }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.embedding;
  } catch {
    return null;
  }
}

function cosineSim(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-10);
}

async function main() {
  const queryEmb = await getEmbedding(query);
  if (!queryEmb) {
    // Ollama not available — return BM25 results unchanged
    console.log(JSON.stringify(bm25Results));
    return;
  }

  // Score each cached document by semantic similarity
  const semanticScores = new Map();
  for (const [docId, embedding] of Object.entries(cache)) {
    semanticScores.set(docId, cosineSim(queryEmb, embedding));
  }

  // RRF fusion (k=60)
  const k = 60;
  const rrfScores = new Map();
  
  // BM25 ranking
  for (let rank = 0; rank < bm25Results.length; rank++) {
    const docId = bm25Results[rank].docid || bm25Results[rank].file || '';
    rrfScores.set(docId, (rrfScores.get(docId) || 0) + 1 / (k + rank + 1));
  }
  
  // Semantic ranking (top 30)
  const semanticRanked = [...semanticScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30);
  
  for (let rank = 0; rank < semanticRanked.length; rank++) {
    const docId = semanticRanked[rank][0];
    rrfScores.set(docId, (rrfScores.get(docId) || 0) + 1 / (k + rank + 1));
  }
  
  // Re-rank BM25 results by RRF score
  const reranked = bm25Results
    .map(r => ({
      ...r,
      score: rrfScores.get(r.docid || r.file || '') || r.score,
    }))
    .sort((a, b) => b.score - a.score);
  
  // Add any semantic-only results not in BM25
  const bm25Ids = new Set(bm25Results.map(r => r.docid || r.file));
  for (const [docId, rrfScore] of rrfScores.entries()) {
    if (!bm25Ids.has(docId) && rrfScore > 0) {
      reranked.push({
        docid: docId,
        file: docId,
        score: rrfScore,
        title: docId.split('/').pop() || docId,
        snippet: '[semantic match]',
      });
    }
  }
  
  reranked.sort((a, b) => b.score - a.score);
  console.log(JSON.stringify(reranked));
}

main().catch(() => {
  console.log(JSON.stringify(bm25Results));
});
