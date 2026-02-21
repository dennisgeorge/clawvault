#!/usr/bin/env node
/**
 * Build embedding cache for all vault documents.
 * Uses Ollama nomic-embed-text model.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'fs';
import { join, relative } from 'path';

const vaultPath = process.env.CLAWVAULT_PATH || join(process.env.HOME, 'clawvault');
const cachePath = join(vaultPath, '.clawvault', 'embeddings.bin.json');

async function getEmbedding(text) {
  const resp = await fetch('http://localhost:11434/api/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'nomic-embed-text', prompt: text.slice(0, 2000) }),
  });
  if (!resp.ok) throw new Error(`Ollama error: ${resp.status}`);
  const data = await resp.json();
  return data.embedding;
}

function walkDir(dir, base) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.') || entry === 'node_modules') continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...walkDir(full, base));
    } else if (entry.endsWith('.md')) {
      files.push(relative(base, full));
    }
  }
  return files;
}

async function main() {
  // Load existing cache
  let cache = {};
  if (existsSync(cachePath)) {
    try { cache = JSON.parse(readFileSync(cachePath, 'utf-8')); } catch {}
  }
  
  const mdFiles = walkDir(vaultPath, vaultPath)
    .filter(f => !f.startsWith('node_modules') && !f.startsWith('.'));
  
  console.log(`Found ${mdFiles.length} markdown files, ${Object.keys(cache).length} cached`);
  
  let updated = 0;
  for (const file of mdFiles) {
    const docId = file.replace(/\.md$/, '');
    if (cache[docId]) continue; // Already cached
    
    try {
      const content = readFileSync(join(vaultPath, file), 'utf-8');
      if (content.length < 20) continue;
      
      const embedding = await getEmbedding(content);
      cache[docId] = embedding;
      updated++;
      
      if (updated % 10 === 0) {
        console.log(`  Embedded ${updated} new docs...`);
        // Save incrementally
        const dir = join(vaultPath, '.clawvault');
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        writeFileSync(cachePath, JSON.stringify(cache));
      }
    } catch (err) {
      console.error(`  Error embedding ${file}: ${err.message}`);
    }
  }
  
  // Final save
  const dir = join(vaultPath, '.clawvault');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(cachePath, JSON.stringify(cache));
  console.log(`Done. ${Object.keys(cache).length} total embeddings (${updated} new)`);
}

main().catch(console.error);
