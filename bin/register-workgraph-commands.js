/**
 * Workgraph CLI commands — multi-agent coordination primitives.
 *
 * Commands:
 *   thread create <title>    Create a new thread
 *   thread list              List threads (filterable by status)
 *   thread show <path>       Show thread details + ledger history
 *   thread claim <path>      Claim a thread for this agent
 *   thread release <path>    Release a claimed thread
 *   thread done <path>       Mark thread complete
 *   thread block <path>      Mark thread blocked
 *   thread unblock <path>    Unblock a thread
 *   thread decompose <path>  Break into sub-threads
 *   primitive define <name>  Define a new primitive type
 *   primitive list           List all primitive types
 *   primitive create <type>  Create an instance of any type
 *   ledger show              Show recent ledger entries
 *   ledger history <path>    Show history of a specific file
 */

export function registerWorkgraphCommands(program, { chalk, resolveVaultPath }) {
  const agentName = process.env.CLAWVAULT_AGENT || process.env.USER || 'anonymous';

  // =========================================================================
  // thread
  // =========================================================================
  const threadCmd = program
    .command('thread')
    .description('Coordinate work through threads (workgraph core)');

  threadCmd
    .command('create <title>')
    .description('Create a new thread')
    .requiredOption('-g, --goal <goal>', 'What success looks like')
    .option('-v, --vault <path>', 'Vault path')
    .option('-a, --actor <name>', 'Agent name', agentName)
    .option('-p, --priority <level>', 'urgent | high | medium | low', 'medium')
    .option('--deps <paths>', 'Comma-separated dependency thread paths')
    .option('--parent <path>', 'Parent thread path')
    .option('--context <refs>', 'Comma-separated vault doc refs for context')
    .option('--tags <tags>', 'Comma-separated tags')
    .action(async (title, opts) => {
      try {
        const vaultPath = resolveVaultPath(opts.vault);
        const { thread } = await import('../dist/workgraph/index.js');
        const t = thread.createThread(vaultPath, title, opts.goal, opts.actor, {
          priority: opts.priority,
          deps: csv(opts.deps),
          parent: opts.parent,
          context_refs: csv(opts.context),
          tags: csv(opts.tags),
        });
        console.log(chalk.green(`✓ Thread created: ${t.path}`));
        console.log(`  Title:    ${t.fields.title}`);
        console.log(`  Status:   ${t.fields.status}`);
        console.log(`  Priority: ${t.fields.priority}`);
      } catch (err) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    });

  threadCmd
    .command('list')
    .description('List threads')
    .option('-v, --vault <path>', 'Vault path')
    .option('-s, --status <status>', 'Filter: open | active | blocked | done | cancelled')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      try {
        const vaultPath = resolveVaultPath(opts.vault);
        const { store } = await import('../dist/workgraph/index.js');
        let threads = store.list(vaultPath, 'thread');
        if (opts.status) threads = threads.filter(t => t.fields.status === opts.status);

        if (opts.json) {
          console.log(JSON.stringify(threads.map(t => ({ path: t.path, ...t.fields })), null, 2));
          return;
        }

        if (threads.length === 0) {
          console.log(chalk.dim('No threads found.'));
          return;
        }

        const statusColor = { open: 'blue', active: 'yellow', blocked: 'red', done: 'green', cancelled: 'dim' };
        for (const t of threads) {
          const s = String(t.fields.status);
          const colorFn = chalk[statusColor[s]] || chalk.white;
          const owner = t.fields.owner ? chalk.dim(` (${t.fields.owner})`) : '';
          console.log(`  ${colorFn(`[${s}]`)} ${t.fields.title}${owner}`);
          console.log(chalk.dim(`         ${t.path}`));
        }
        console.log(chalk.dim(`\n${threads.length} thread(s)`));
      } catch (err) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    });

  threadCmd
    .command('show <path>')
    .description('Show thread details and ledger history')
    .option('-v, --vault <path>', 'Vault path')
    .action(async (threadPath, opts) => {
      try {
        const vaultPath = resolveVaultPath(opts.vault);
        const { store, ledger } = await import('../dist/workgraph/index.js');
        const t = store.read(vaultPath, threadPath);
        if (!t) { console.error(chalk.red(`Not found: ${threadPath}`)); process.exit(1); }

        console.log(chalk.bold(String(t.fields.title)));
        console.log(chalk.dim('─'.repeat(50)));
        console.log(`Status:   ${t.fields.status}`);
        console.log(`Owner:    ${t.fields.owner || chalk.dim('unclaimed')}`);
        console.log(`Priority: ${t.fields.priority}`);
        if (t.fields.deps?.length) console.log(`Deps:     ${(t.fields.deps).join(', ')}`);
        if (t.fields.parent) console.log(`Parent:   ${t.fields.parent}`);
        if (t.fields.tags?.length) console.log(`Tags:     ${(t.fields.tags).join(', ')}`);
        console.log(`Path:     ${t.path}`);
        console.log();
        if (t.body) console.log(t.body);

        const history = ledger.historyOf(vaultPath, threadPath);
        if (history.length > 0) {
          console.log(chalk.dim('\n─── Ledger History ───'));
          for (const e of history) {
            const time = new Date(e.ts).toLocaleTimeString();
            const data = e.data ? chalk.dim(` ${JSON.stringify(e.data)}`) : '';
            console.log(`  ${chalk.dim(time)} ${chalk.cyan(e.op)} by ${e.actor}${data}`);
          }
        }
      } catch (err) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    });

  threadCmd
    .command('claim <path>')
    .description('Claim a thread — only you can work on it')
    .option('-v, --vault <path>', 'Vault path')
    .option('-a, --actor <name>', 'Agent name', agentName)
    .action(async (threadPath, opts) => {
      try {
        const vaultPath = resolveVaultPath(opts.vault);
        const { thread } = await import('../dist/workgraph/index.js');
        const t = thread.claim(vaultPath, threadPath, opts.actor);
        console.log(chalk.green(`✓ Claimed: ${threadPath}`));
        console.log(`  Owner: ${opts.actor}`);
      } catch (err) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    });

  threadCmd
    .command('release <path>')
    .description('Release a claimed thread back to open')
    .option('-v, --vault <path>', 'Vault path')
    .option('-a, --actor <name>', 'Agent name', agentName)
    .option('--reason <reason>', 'Why you are releasing')
    .action(async (threadPath, opts) => {
      try {
        const vaultPath = resolveVaultPath(opts.vault);
        const { thread } = await import('../dist/workgraph/index.js');
        thread.release(vaultPath, threadPath, opts.actor, opts.reason);
        console.log(chalk.green(`✓ Released: ${threadPath}`));
      } catch (err) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    });

  threadCmd
    .command('done <path>')
    .description('Mark thread complete')
    .option('-v, --vault <path>', 'Vault path')
    .option('-a, --actor <name>', 'Agent name', agentName)
    .option('-o, --output <text>', 'Output/result summary')
    .action(async (threadPath, opts) => {
      try {
        const vaultPath = resolveVaultPath(opts.vault);
        const { thread } = await import('../dist/workgraph/index.js');
        thread.done(vaultPath, threadPath, opts.actor, opts.output);
        console.log(chalk.green(`✓ Done: ${threadPath}`));
      } catch (err) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    });

  threadCmd
    .command('block <path>')
    .description('Mark thread blocked on a dependency')
    .option('-v, --vault <path>', 'Vault path')
    .option('-a, --actor <name>', 'Agent name', agentName)
    .requiredOption('-b, --blocked-by <dep>', 'What is blocking this thread')
    .option('--reason <reason>', 'Why it is blocked')
    .action(async (threadPath, opts) => {
      try {
        const vaultPath = resolveVaultPath(opts.vault);
        const { thread } = await import('../dist/workgraph/index.js');
        thread.block(vaultPath, threadPath, opts.actor, opts.blockedBy, opts.reason);
        console.log(chalk.red(`⊘ Blocked: ${threadPath}`));
        console.log(`  Blocked by: ${opts.blockedBy}`);
      } catch (err) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    });

  threadCmd
    .command('unblock <path>')
    .description('Unblock a thread')
    .option('-v, --vault <path>', 'Vault path')
    .option('-a, --actor <name>', 'Agent name', agentName)
    .action(async (threadPath, opts) => {
      try {
        const vaultPath = resolveVaultPath(opts.vault);
        const { thread } = await import('../dist/workgraph/index.js');
        thread.unblock(vaultPath, threadPath, opts.actor);
        console.log(chalk.green(`✓ Unblocked: ${threadPath}`));
      } catch (err) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    });

  threadCmd
    .command('decompose <path>')
    .description('Break a thread into sub-threads')
    .option('-v, --vault <path>', 'Vault path')
    .option('-a, --actor <name>', 'Agent name', agentName)
    .requiredOption('--sub <specs...>', 'Sub-threads as "title|goal" pairs')
    .action(async (threadPath, opts) => {
      try {
        const vaultPath = resolveVaultPath(opts.vault);
        const { thread } = await import('../dist/workgraph/index.js');
        const subs = opts.sub.map(spec => {
          const [title, ...goalParts] = spec.split('|');
          return { title: title.trim(), goal: goalParts.join('|').trim() || title.trim() };
        });
        const children = thread.decompose(vaultPath, threadPath, subs, opts.actor);
        console.log(chalk.green(`✓ Decomposed ${threadPath} into ${children.length} sub-threads:`));
        for (const c of children) {
          console.log(`  → ${c.path}`);
        }
      } catch (err) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    });

  // =========================================================================
  // primitive
  // =========================================================================
  const primitiveCmd = program
    .command('primitive')
    .description('Manage workgraph primitive types (define new types, list, create)');

  primitiveCmd
    .command('define <name>')
    .description('Define a new primitive type that agents can instantiate')
    .requiredOption('-d, --description <desc>', 'What this type represents')
    .option('-v, --vault <path>', 'Vault path')
    .option('-a, --actor <name>', 'Agent name', agentName)
    .option('--fields <specs...>', 'Field definitions as "name:type" (types: string, number, boolean, list, date, ref)')
    .option('--dir <directory>', 'Storage directory name')
    .action(async (name, opts) => {
      try {
        const vaultPath = resolveVaultPath(opts.vault);
        const { registry } = await import('../dist/workgraph/index.js');
        const fields = {};
        if (opts.fields) {
          for (const spec of opts.fields) {
            const [fieldName, fieldType = 'string'] = spec.split(':');
            fields[fieldName.trim()] = { type: fieldType.trim() };
          }
        }
        const typeDef = registry.defineType(vaultPath, name, opts.description, fields, opts.actor, opts.dir);
        console.log(chalk.green(`✓ Defined type: ${typeDef.name}`));
        console.log(`  Directory: ${typeDef.directory}/`);
        console.log(`  Fields:    ${Object.keys(typeDef.fields).join(', ')}`);
      } catch (err) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    });

  primitiveCmd
    .command('list')
    .description('List all registered primitive types')
    .option('-v, --vault <path>', 'Vault path')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      try {
        const vaultPath = resolveVaultPath(opts.vault);
        const { registry } = await import('../dist/workgraph/index.js');
        const types = registry.listTypes(vaultPath);

        if (opts.json) {
          console.log(JSON.stringify(types, null, 2));
          return;
        }

        for (const t of types) {
          const badge = t.builtIn ? chalk.dim('[built-in]') : chalk.cyan(`[${t.createdBy}]`);
          console.log(`  ${chalk.bold(t.name)} ${badge}`);
          console.log(chalk.dim(`    ${t.description}`));
          console.log(chalk.dim(`    dir: ${t.directory}/  fields: ${Object.keys(t.fields).join(', ')}`));
        }
        console.log(chalk.dim(`\n${types.length} type(s) — ${types.filter(t => !t.builtIn).length} agent-defined`));
      } catch (err) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    });

  primitiveCmd
    .command('create <type> <title>')
    .description('Create an instance of any primitive type')
    .option('-v, --vault <path>', 'Vault path')
    .option('-a, --actor <name>', 'Agent name', agentName)
    .option('--set <fields...>', 'Set fields as "key=value" pairs')
    .option('--body <text>', 'Markdown body content', '')
    .action(async (type, title, opts) => {
      try {
        const vaultPath = resolveVaultPath(opts.vault);
        const { store } = await import('../dist/workgraph/index.js');
        const fields = { title };
        if (opts.set) {
          for (const pair of opts.set) {
            const eqIdx = pair.indexOf('=');
            if (eqIdx === -1) continue;
            const key = pair.slice(0, eqIdx).trim();
            let val = pair.slice(eqIdx + 1).trim();
            if (val.includes(',')) val = val.split(',').map(s => s.trim());
            fields[key] = val;
          }
        }
        const inst = store.create(vaultPath, type, fields, opts.body, opts.actor);
        console.log(chalk.green(`✓ Created ${type}: ${inst.path}`));
      } catch (err) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    });

  // =========================================================================
  // ledger
  // =========================================================================
  const ledgerCmd = program
    .command('ledger')
    .description('View the workgraph audit trail');

  ledgerCmd
    .command('show')
    .description('Show recent ledger entries')
    .option('-v, --vault <path>', 'Vault path')
    .option('-n, --count <n>', 'Number of entries', '20')
    .option('--actor <name>', 'Filter by actor')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      try {
        const vaultPath = resolveVaultPath(opts.vault);
        const { ledger } = await import('../dist/workgraph/index.js');
        let entries = ledger.recent(vaultPath, parseInt(opts.count));
        if (opts.actor) entries = entries.filter(e => e.actor === opts.actor);

        if (opts.json) {
          console.log(JSON.stringify(entries, null, 2));
          return;
        }

        if (entries.length === 0) {
          console.log(chalk.dim('No ledger entries.'));
          return;
        }

        const opColor = { create: 'green', claim: 'yellow', release: 'blue', done: 'green', block: 'red', unblock: 'cyan', cancel: 'dim', update: 'white', delete: 'red', define: 'magenta', decompose: 'cyan' };
        for (const e of entries) {
          const time = new Date(e.ts).toLocaleString();
          const colorFn = chalk[opColor[e.op]] || chalk.white;
          const data = e.data ? chalk.dim(` ${JSON.stringify(e.data)}`) : '';
          console.log(`  ${chalk.dim(time)} ${colorFn(e.op.padEnd(10))} ${e.actor.padEnd(15)} ${e.target}${data}`);
        }
      } catch (err) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    });

  ledgerCmd
    .command('history <path>')
    .description('Show full history of a specific file')
    .option('-v, --vault <path>', 'Vault path')
    .action(async (targetPath, opts) => {
      try {
        const vaultPath = resolveVaultPath(opts.vault);
        const { ledger } = await import('../dist/workgraph/index.js');
        const history = ledger.historyOf(vaultPath, targetPath);

        if (history.length === 0) {
          console.log(chalk.dim(`No history for ${targetPath}`));
          return;
        }

        console.log(chalk.bold(`History: ${targetPath}`));
        console.log(chalk.dim('─'.repeat(50)));
        for (const e of history) {
          const time = new Date(e.ts).toLocaleString();
          const data = e.data ? chalk.dim(` ${JSON.stringify(e.data)}`) : '';
          console.log(`  ${chalk.dim(time)} ${chalk.cyan(e.op)} by ${e.actor}${data}`);
        }
      } catch (err) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    });

  ledgerCmd
    .command('claims')
    .description('Show all active claims')
    .option('-v, --vault <path>', 'Vault path')
    .action(async (opts) => {
      try {
        const vaultPath = resolveVaultPath(opts.vault);
        const { ledger } = await import('../dist/workgraph/index.js');
        const claims = ledger.allClaims(vaultPath);

        if (claims.size === 0) {
          console.log(chalk.dim('No active claims.'));
          return;
        }

        for (const [target, owner] of claims) {
          console.log(`  ${chalk.yellow(owner.padEnd(20))} → ${target}`);
        }
        console.log(chalk.dim(`\n${claims.size} active claim(s)`));
      } catch (err) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    });
}

function csv(value) {
  if (!value) return undefined;
  return String(value).split(',').map(s => s.trim()).filter(Boolean);
}
