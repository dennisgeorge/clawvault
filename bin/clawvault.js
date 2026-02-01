#!/usr/bin/env node

/**
 * ClawVault CLI 🐘
 * An elephant never forgets.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import {
  ClawVault,
  createVault,
  findVault,
  VERSION,
  hasQmd,
  QmdUnavailableError,
  QMD_INSTALL_URL
} from '../dist/index.js';

const program = new Command();

// Helper to get vault (required for most commands)
async function getVault(vaultPath) {
  if (vaultPath) {
    const vault = new ClawVault(path.resolve(vaultPath));
    await vault.load();
    return vault;
  }
  
  const vault = await findVault();
  if (!vault) {
    console.error(chalk.red('Error: No ClawVault found. Run `clawvault init` first.'));
    process.exit(1);
  }
  return vault;
}

async function runQmd(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('qmd', args, { stdio: 'inherit' });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`qmd exited with code ${code}`));
    });
    proc.on('error', reject);
  });
}

function printQmdMissing() {
  console.error(chalk.red('Error: qmd is not installed or not on PATH.'));
  console.log(chalk.dim(`Install qmd: ${QMD_INSTALL_URL}`));
}

program
  .name('clawvault')
  .description('🐘 An elephant never forgets. Structured memory for AI agents.')
  .version(VERSION);

// === INIT ===
program
  .command('init [path]')
  .description('Initialize a new ClawVault')
  .option('-n, --name <name>', 'Vault name')
  .option('--qmd', 'Set up qmd semantic search collection')
  .option('--qmd-collection <name>', 'qmd collection name (defaults to vault name)')
  .action(async (vaultPath, options) => {
    const targetPath = vaultPath || '.';
    console.log(chalk.cyan(`\n🐘 Initializing ClawVault at ${path.resolve(targetPath)}...\n`));
    
    try {
      const vault = await createVault(targetPath, {
        name: options.name || path.basename(path.resolve(targetPath)),
        qmdCollection: options.qmdCollection
      });
      
      console.log(chalk.green('✓ Vault created'));
      console.log(chalk.dim(`  Categories: ${vault.getCategories().join(', ')}`));

      const qmdAvailable = hasQmd();
      
      // Always set up qmd collection (qmd is required)
      console.log(chalk.cyan('\nSetting up qmd collection...'));
      if (!qmdAvailable) {
        console.log(chalk.red('✗ qmd not found. Install qmd first:'));
        console.log(chalk.dim(`  bun install -g qmd`));
        console.log(chalk.dim(`  # or: npm install -g qmd`));
        console.log(chalk.dim(`  Then run: qmd collection add ${vault.getQmdRoot()} --name ${vault.getQmdCollection()} --mask "**/*.md"`));
      } else {
        try {
          await runQmd([
            'collection',
            'add',
            vault.getQmdRoot(),
            '--name',
            vault.getQmdCollection(),
            '--mask',
            '**/*.md'
          ]);
          console.log(chalk.green('✓ qmd collection created'));
        } catch (err) {
          // Collection might already exist
          console.log(chalk.yellow('⚠ qmd collection may already exist'));
        }
      }
      
      console.log(chalk.green('\n✅ ClawVault ready!\n'));
      console.log(chalk.dim('Next steps:'));
      console.log(chalk.dim('  clawvault store --category inbox --title "My note" --content "Hello world"'));
      console.log(chalk.dim('  clawvault search "hello"'));
      console.log();
    } catch (err) {
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

// === STORE ===
program
  .command('store')
  .description('Store a new memory')
  .requiredOption('-c, --category <category>', 'Category (preferences, decisions, patterns, people, projects, goals, transcripts, inbox)')
  .requiredOption('-t, --title <title>', 'Document title')
  .option('--content <content>', 'Content body')
  .option('-f, --file <file>', 'Read content from file')
  .option('--stdin', 'Read content from stdin')
  .option('--overwrite', 'Overwrite if exists')
  .option('--no-index', 'Skip qmd index update (auto-updates by default)')
  .option('--embed', 'Also update qmd embeddings for vector search')
  .option('-v, --vault <path>', 'Vault path (default: find nearest)')
  .action(async (options) => {
    try {
      const vault = await getVault(options.vault);
      
      let content = options.content || '';
      
      if (options.file) {
        content = fs.readFileSync(options.file, 'utf-8');
      } else if (options.stdin) {
        content = fs.readFileSync(0, 'utf-8');
      }
      
      const doc = await vault.store({
        category: options.category,
        title: options.title,
        content,
        overwrite: options.overwrite
      });
      
      console.log(chalk.green(`✓ Stored: ${doc.id}`));
      console.log(chalk.dim(`  Path: ${doc.path}`));
      
      // Auto-update qmd index unless --no-index
      if (options.index !== false && hasQmd()) {
        try {
          const collection = vault.getQmdCollection();
          await runQmd(collection ? ['update', '-c', collection] : ['update']);
          if (options.embed) {
            await runQmd(['embed']);
          }
        } catch { /* ignore qmd errors */ }
      }
    } catch (err) {
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

// === CAPTURE ===
program
  .command('capture <note>')
  .description('Quick capture to inbox')
  .option('-t, --title <title>', 'Note title')
  .option('-v, --vault <path>', 'Vault path')
  .option('--no-index', 'Skip qmd index update')
  .action(async (note, options) => {
    try {
      const vault = await getVault(options.vault);
      const doc = await vault.capture(note, options.title);
      console.log(chalk.green(`✓ Captured: ${doc.id}`));
      
      // Auto-update qmd index unless --no-index
      if (options.index !== false && hasQmd()) {
        try {
          const collection = vault.getQmdCollection();
          await runQmd(collection ? ['update', '-c', collection] : ['update']);
        } catch { /* ignore qmd errors */ }
      }
    } catch (err) {
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

// === SEARCH ===
program
  .command('search <query>')
  .description('Search the vault via qmd (BM25)')
  .option('-n, --limit <n>', 'Max results', '10')
  .option('-c, --category <category>', 'Filter by category')
  .option('--tags <tags>', 'Filter by tags (comma-separated)')
  .option('--full', 'Include full content in results')
  .option('-v, --vault <path>', 'Vault path')
  .option('--json', 'Output as JSON')
  .action(async (query, options) => {
    try {
      const vault = await getVault(options.vault);
      
      const results = await vault.find(query, {
        limit: parseInt(options.limit),
        category: options.category,
        tags: options.tags?.split(',').map(t => t.trim()),
        fullContent: options.full
      });
      
      if (options.json) {
        console.log(JSON.stringify(results, null, 2));
        return;
      }
      
      if (results.length === 0) {
        console.log(chalk.yellow('No results found.'));
        return;
      }
      
      console.log(chalk.cyan(`\n🔍 Found ${results.length} result(s) for "${query}":\n`));
      
      for (const result of results) {
        const scoreBar = '█'.repeat(Math.round(result.score * 10)).padEnd(10, '░');
        console.log(chalk.green(`📄 ${result.document.title}`));
        console.log(chalk.dim(`   ${result.document.category}/${result.document.id.split('/').pop()}`));
        console.log(chalk.dim(`   Score: ${scoreBar} ${(result.score * 100).toFixed(0)}%`));
        if (result.snippet) {
          console.log(chalk.white(`   ${result.snippet.split('\n')[0].slice(0, 80)}...`));
        }
        console.log();
      }
    } catch (err) {
      if (err instanceof QmdUnavailableError) {
        printQmdMissing();
        process.exit(1);
      }
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

// === VSEARCH (qmd semantic search) ===
program
  .command('vsearch <query>')
  .description('Semantic search via qmd (requires qmd installed)')
  .option('-n, --limit <n>', 'Max results', '5')
  .option('-c, --category <category>', 'Filter by category')
  .option('--tags <tags>', 'Filter by tags (comma-separated)')
  .option('--full', 'Include full content in results')
  .option('-v, --vault <path>', 'Vault path')
  .option('--json', 'Output as JSON')
  .action(async (query, options) => {
    try {
      const vault = await getVault(options.vault);
      
      const results = await vault.vsearch(query, {
        limit: parseInt(options.limit),
        category: options.category,
        tags: options.tags?.split(',').map(t => t.trim()),
        fullContent: options.full
      });
      
      if (options.json) {
        console.log(JSON.stringify(results, null, 2));
        return;
      }
      
      if (results.length === 0) {
        console.log(chalk.yellow('No results found.'));
        return;
      }
      
      console.log(chalk.cyan(`\n🧠 Found ${results.length} result(s) for "${query}":\n`));
      
      for (const result of results) {
        const scoreBar = '█'.repeat(Math.round(result.score * 10)).padEnd(10, '░');
        console.log(chalk.green(`📄 ${result.document.title}`));
        console.log(chalk.dim(`   ${result.document.category}/${result.document.id.split('/').pop()}`));
        console.log(chalk.dim(`   Score: ${scoreBar} ${(result.score * 100).toFixed(0)}%`));
        if (result.snippet) {
          console.log(chalk.white(`   ${result.snippet.split('\n')[0].slice(0, 80)}...`));
        }
        console.log();
      }
    } catch (err) {
      if (err instanceof QmdUnavailableError) {
        printQmdMissing();
        process.exit(1);
      }
      console.error(chalk.red(`Error: ${err.message}`));
      console.log(chalk.dim(`\nTip: Install qmd for semantic search: ${QMD_INSTALL_URL}`));
      process.exit(1);
    }
  });

// === LIST ===
program
  .command('list [category]')
  .description('List documents')
  .option('-v, --vault <path>', 'Vault path')
  .option('--json', 'Output as JSON')
  .action(async (category, options) => {
    try {
      const vault = await getVault(options.vault);
      const docs = await vault.list(category);
      
      if (options.json) {
        console.log(JSON.stringify(docs.map(d => ({
          id: d.id,
          title: d.title,
          category: d.category,
          tags: d.tags,
          modified: d.modified
        })), null, 2));
        return;
      }
      
      if (docs.length === 0) {
        console.log(chalk.yellow('No documents found.'));
        return;
      }
      
      console.log(chalk.cyan(`\n📚 ${docs.length} document(s)${category ? ` in ${category}` : ''}:\n`));
      
      // Group by category
      const grouped = {};
      for (const doc of docs) {
        grouped[doc.category] = grouped[doc.category] || [];
        grouped[doc.category].push(doc);
      }
      
      for (const [cat, catDocs] of Object.entries(grouped)) {
        console.log(chalk.yellow(`${cat}/`));
        for (const doc of catDocs) {
          console.log(chalk.dim(`  - ${doc.title}`));
        }
      }
      console.log();
    } catch (err) {
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

// === GET ===
program
  .command('get <id>')
  .description('Get a document by ID')
  .option('-v, --vault <path>', 'Vault path')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    try {
      const vault = await getVault(options.vault);
      const doc = await vault.get(id);
      
      if (!doc) {
        console.error(chalk.red(`Document not found: ${id}`));
        process.exit(1);
      }
      
      if (options.json) {
        console.log(JSON.stringify(doc, null, 2));
        return;
      }
      
      console.log(chalk.cyan(`\n📄 ${doc.title}\n`));
      console.log(chalk.dim(`Category: ${doc.category}`));
      console.log(chalk.dim(`Path: ${doc.path}`));
      console.log(chalk.dim(`Tags: ${doc.tags.join(', ') || 'none'}`));
      console.log(chalk.dim(`Links: ${doc.links.join(', ') || 'none'}`));
      console.log(chalk.dim(`Modified: ${doc.modified.toISOString()}`));
      console.log(chalk.dim('---'));
      console.log(doc.content);
    } catch (err) {
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

// === STATS ===
program
  .command('stats')
  .description('Show vault statistics')
  .option('-v, --vault <path>', 'Vault path')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    try {
      const vault = await getVault(options.vault);
      const stats = await vault.stats();
      
      if (options.json) {
        console.log(JSON.stringify(stats, null, 2));
        return;
      }
      
      console.log(chalk.cyan(`\n🐘 ${vault.getName()} Stats\n`));
      console.log(chalk.dim(`Path: ${vault.getPath()}`));
      console.log(`Documents: ${chalk.green(stats.documents)}`);
      console.log(`Links: ${chalk.blue(stats.links)}`);
      console.log(`Tags: ${chalk.yellow(stats.tags.length)}`);
      console.log();
      console.log(chalk.dim('By category:'));
      for (const [cat, count] of Object.entries(stats.categories)) {
        console.log(chalk.dim(`  ${cat}: ${count}`));
      }
      console.log();
    } catch (err) {
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

// === SYNC ===
program
  .command('sync <target>')
  .description('Sync vault to another location (e.g., for Obsidian)')
  .option('--delete', 'Delete orphan files in target')
  .option('--dry-run', "Show what would be synced without syncing")
  .option('-v, --vault <path>', 'Vault path')
  .action(async (target, options) => {
    try {
      const vault = await getVault(options.vault);
      
      console.log(chalk.cyan(`\n🔄 Syncing to ${target}...\n`));
      
      const result = await vault.sync({
        target,
        deleteOrphans: options.delete,
        dryRun: options.dryRun
      });
      
      if (options.dryRun) {
        console.log(chalk.yellow('DRY RUN - no changes made\n'));
      }
      
      if (result.copied.length > 0) {
        console.log(chalk.green(`Copied: ${result.copied.length} files`));
        for (const f of result.copied.slice(0, 5)) {
          console.log(chalk.dim(`  + ${f}`));
        }
        if (result.copied.length > 5) {
          console.log(chalk.dim(`  ... and ${result.copied.length - 5} more`));
        }
      }
      
      if (result.deleted.length > 0) {
        console.log(chalk.red(`Deleted: ${result.deleted.length} files`));
      }
      
      if (result.unchanged.length > 0) {
        console.log(chalk.dim(`Unchanged: ${result.unchanged.length} files`));
      }
      
      if (result.errors.length > 0) {
        console.log(chalk.red(`\nErrors:`));
        for (const e of result.errors) {
          console.log(chalk.red(`  ${e}`));
        }
      }
      
      console.log();
    } catch (err) {
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

// === REINDEX ===
program
  .command('reindex')
  .description('Rebuild the search index')
  .option('-v, --vault <path>', 'Vault path')
  .option('--qmd', 'Also update qmd embeddings')
  .action(async (options) => {
    try {
      const vault = await getVault(options.vault);
      
      console.log(chalk.cyan('\n🔄 Reindexing...\n'));
      
      const count = await vault.reindex();
      console.log(chalk.green(`✓ Indexed ${count} documents`));
      
      if (options.qmd) {
        console.log(chalk.cyan('Updating qmd embeddings...'));
        try {
          const collection = vault.getQmdCollection();
          await runQmd(collection ? ['update', '-c', collection] : ['update']);
          console.log(chalk.green('✓ qmd updated'));
        } catch {
          console.log(chalk.yellow('⚠ qmd update failed'));
        }
      }
      
      console.log();
    } catch (err) {
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

// === REMEMBER (type-based storage) ===
program
  .command('remember <type> <title>')
  .description('Store a memory with type classification (fact|feeling|decision|lesson|commitment|preference|relationship|project)')
  .option('--content <content>', 'Content body')
  .option('-f, --file <file>', 'Read content from file')
  .option('--stdin', 'Read content from stdin')
  .option('-v, --vault <path>', 'Vault path')
  .option('--no-index', 'Skip qmd index update')
  .action(async (type, title, options) => {
    const validTypes = ['fact', 'feeling', 'decision', 'lesson', 'commitment', 'preference', 'relationship', 'project'];
    if (!validTypes.includes(type)) {
      console.error(chalk.red(`Invalid type: ${type}`));
      console.error(chalk.dim(`Valid types: ${validTypes.join(', ')}`));
      process.exit(1);
    }
    
    try {
      const vault = await getVault(options.vault);
      
      let content = options.content || '';
      if (options.file) {
        content = fs.readFileSync(options.file, 'utf-8');
      } else if (options.stdin) {
        content = fs.readFileSync(0, 'utf-8');
      }
      
      const doc = await vault.remember(type, title, content);
      console.log(chalk.green(`✓ Remembered (${type}): ${doc.id}`));
      
      // Auto-update qmd index unless --no-index
      if (options.index !== false && hasQmd()) {
        try {
          const collection = vault.getQmdCollection();
          await runQmd(collection ? ['update', '-c', collection] : ['update']);
        } catch { /* ignore qmd errors */ }
      }
    } catch (err) {
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

// === HANDOFF (session bridge) ===
program
  .command('handoff')
  .description('Create a session handoff document')
  .requiredOption('-w, --working-on <items>', 'What I was working on (comma-separated)')
  .option('-b, --blocked <items>', 'What is blocked (comma-separated)')
  .option('-n, --next <items>', 'What comes next (comma-separated)')
  .option('-d, --decisions <items>', 'Key decisions made (comma-separated)')
  .option('-q, --questions <items>', 'Open questions (comma-separated)')
  .option('-f, --feeling <state>', 'Emotional/energy state')
  .option('-s, --session <key>', 'Session key')
  .option('-v, --vault <path>', 'Vault path')
  .option('--no-index', 'Skip qmd index update (auto-updates by default)')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    try {
      const vault = await getVault(options.vault);
      
      const handoff = {
        workingOn: options.workingOn.split(',').map(s => s.trim()),
        blocked: options.blocked ? options.blocked.split(',').map(s => s.trim()) : [],
        nextSteps: options.next ? options.next.split(',').map(s => s.trim()) : [],
        decisions: options.decisions ? options.decisions.split(',').map(s => s.trim()) : undefined,
        openQuestions: options.questions ? options.questions.split(',').map(s => s.trim()) : undefined,
        feeling: options.feeling,
        sessionKey: options.session
      };
      
      const doc = await vault.createHandoff(handoff);
      
      if (options.json) {
        console.log(JSON.stringify({ id: doc.id, path: doc.path, handoff }, null, 2));
      } else {
        console.log(chalk.green(`✓ Handoff created: ${doc.id}`));
        console.log(chalk.dim(`  Path: ${doc.path}`));
      }
      
      // Auto-update qmd index unless --no-index
      if (options.index !== false && hasQmd()) {
        try {
          const collection = vault.getQmdCollection();
          await runQmd(collection ? ['update', '-c', collection] : ['update']);
        } catch { /* ignore qmd errors */ }
      }
    } catch (err) {
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

// === RECAP (session bootstrap) ===
program
  .command('recap')
  .description('Generate a session recap - who I was (bootstrap hook)')
  .option('-n, --handoff-limit <n>', 'Number of recent handoffs to include', '3')
  .option('-v, --vault <path>', 'Vault path')
  .option('--json', 'Output as JSON')
  .option('--markdown', 'Output as markdown (default)')
  .option('--brief', 'Minimal output for token savings')
  .action(async (options) => {
    try {
      const vault = await getVault(options.vault);
      
      const recap = await vault.generateRecap({
        handoffLimit: parseInt(options.handoffLimit),
        brief: options.brief
      });
      
      if (options.json) {
        console.log(JSON.stringify(recap, null, 2));
        return;
      }
      
      // Output as markdown (default)
      const md = vault.formatRecap(recap, { brief: options.brief });
      console.log(md);
    } catch (err) {
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

// === DOCTOR (health check) ===
program
  .command('doctor')
  .description('Check ClawVault setup health')
  .option('-v, --vault <path>', 'Vault path')
  .action(async (options) => {
    console.log(chalk.cyan('\n🩺 ClawVault Health Check\n'));
    
    let issues = 0;
    
    // Check qmd
    if (hasQmd()) {
      console.log(chalk.green('✓ qmd installed'));
    } else {
      console.log(chalk.red('✗ qmd not installed'));
      console.log(chalk.dim(`  Install: bun install -g qmd`));
      issues++;
    }
    
    // Check vault
    try {
      const vault = await getVault(options.vault);
      console.log(chalk.green(`✓ Vault found: ${vault.getPath()}`));
      
      const stats = await vault.stats();
      console.log(chalk.dim(`  ${stats.documents} documents, ${stats.links} links`));
      
      // Check qmd collection
      const collection = vault.getQmdCollection();
      if (collection) {
        console.log(chalk.green(`✓ qmd collection: ${collection}`));
      } else {
        console.log(chalk.yellow('⚠ No qmd collection configured'));
        issues++;
      }
      
      // Check for handoffs
      const handoffs = await vault.list('handoffs');
      if (handoffs.length > 0) {
        console.log(chalk.green(`✓ ${handoffs.length} handoff(s) stored`));
      } else {
        console.log(chalk.yellow('⚠ No handoffs yet — run `clawvault handoff` before context death'));
      }
      
      // Check for content
      if (stats.documents < 5) {
        console.log(chalk.yellow('⚠ Vault is sparse — start storing memories!'));
      }
      
    } catch (err) {
      console.log(chalk.red(`✗ Vault error: ${err.message}`));
      issues++;
    }
    
    console.log();
    if (issues === 0) {
      console.log(chalk.green('✅ ClawVault is healthy!\n'));
    } else {
      console.log(chalk.yellow(`⚠ ${issues} issue(s) found\n`));
    }
  });

// Parse and run
program.parse();
