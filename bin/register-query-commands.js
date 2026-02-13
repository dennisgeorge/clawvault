/**
 * Query and context command registrations.
 */

export function registerQueryCommands(
  program,
  {
    chalk,
    getVault,
    resolveVaultPath,
    QmdUnavailableError,
    printQmdMissing
  }
) {
  // === SEARCH ===
  program
    .command('search <query>')
    .description('Search the vault via qmd (BM25)')
    .option('-n, --limit <n>', 'Max results', '10')
    .option('-c, --category <category>', 'Filter by category')
    .option('--tags <tags>', 'Filter by tags (comma-separated)')
    .option('--recent', 'Boost recent documents')
    .option('--full', 'Include full content in results')
    .option('-v, --vault <path>', 'Vault path')
    .option('--json', 'Output as JSON')
    .action(async (query, options) => {
      try {
        const vault = await getVault(options.vault);

        const results = await vault.find(query, {
          limit: parseInt(options.limit, 10),
          category: options.category,
          tags: options.tags?.split(',').map((value) => value.trim()),
          fullContent: options.full,
          temporalBoost: options.recent
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

  // === VSEARCH ===
  program
    .command('vsearch <query>')
    .description('Semantic search via qmd (requires qmd installed)')
    .option('-n, --limit <n>', 'Max results', '5')
    .option('-c, --category <category>', 'Filter by category')
    .option('--tags <tags>', 'Filter by tags (comma-separated)')
    .option('--recent', 'Boost recent documents')
    .option('--full', 'Include full content in results')
    .option('-v, --vault <path>', 'Vault path')
    .option('--json', 'Output as JSON')
    .action(async (query, options) => {
      try {
        const vault = await getVault(options.vault);

        const results = await vault.vsearch(query, {
          limit: parseInt(options.limit, 10),
          category: options.category,
          tags: options.tags?.split(',').map((value) => value.trim()),
          fullContent: options.full,
          temporalBoost: options.recent
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
        process.exit(1);
      }
    });

  // === CONTEXT ===
  program
    .command('context <task>')
    .description('Generate task-relevant context for prompt injection')
    .option('-n, --limit <n>', 'Max results', '5')
    .option('--format <format>', 'Output format (markdown|json)', 'markdown')
    .option('--recent', 'Boost recent documents (enabled by default)', true)
    .option('--include-observations', 'Include observation memories in output', true)
    .option('--budget <number>', 'Optional token budget for assembled context')
    .option('--profile <profile>', 'Context profile (default|planning|incident|handoff|auto)', 'default')
    .option('-v, --vault <path>', 'Vault path')
    .action(async (task, options) => {
      try {
        const vaultPath = resolveVaultPath(options.vault);
        const format = options.format === 'json' ? 'json' : 'markdown';
        const parsedBudget = options.budget ? Number.parseInt(options.budget, 10) : undefined;
        if (options.budget && (!Number.isFinite(parsedBudget) || parsedBudget <= 0)) {
          throw new Error(`Invalid --budget value: ${options.budget}`);
        }

        const { contextCommand } = await import('../dist/commands/context.js');
        await contextCommand(task, {
          vaultPath,
          limit: parseInt(options.limit, 10),
          format,
          recent: options.recent,
          includeObservations: options.includeObservations,
          budget: parsedBudget,
          profile: options.profile
        });
      } catch (err) {
        if (err instanceof QmdUnavailableError) {
          printQmdMissing();
          process.exit(1);
        }
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    });

  // === OBSERVE ===
  program
    .command('observe')
    .description('Observe session files and build observational memory')
    .option('--watch <path>', 'Watch session file or directory')
    .option('--threshold <n>', 'Compression token threshold', '30000')
    .option('--reflect-threshold <n>', 'Reflection token threshold', '40000')
    .option('--model <model>', 'LLM model override')
    .option('--compress <file>', 'One-shot compression for a conversation file')
    .option('--daemon', 'Run in detached background mode')
    .option('-v, --vault <path>', 'Vault path')
    .action(async (options) => {
      try {
        const { observeCommand } = await import('../dist/commands/observe.js');
        const threshold = Number.parseInt(options.threshold, 10);
        const reflectThreshold = Number.parseInt(options.reflectThreshold, 10);
        if (Number.isNaN(threshold) || threshold <= 0) {
          throw new Error(`Invalid --threshold value: ${options.threshold}`);
        }
        if (Number.isNaN(reflectThreshold) || reflectThreshold <= 0) {
          throw new Error(`Invalid --reflect-threshold value: ${options.reflectThreshold}`);
        }

        await observeCommand({
          watch: options.watch,
          threshold,
          reflectThreshold,
          model: options.model,
          compress: options.compress,
          daemon: options.daemon,
          vaultPath: resolveVaultPath(options.vault)
        });
      } catch (err) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    });

  // === SESSION-RECAP ===
  program
    .command('session-recap <sessionKey>')
    .description('Generate recap from a specific OpenClaw session transcript')
    .option('-n, --limit <n>', 'Number of messages to include', '15')
    .option('--format <format>', 'Output format (markdown|json)', 'markdown')
    .option('-a, --agent <id>', 'Agent ID (default: OPENCLAW_AGENT_ID or clawdious)')
    .action(async (sessionKey, options) => {
      try {
        const { sessionRecapCommand } = await import('../dist/commands/session-recap.js');
        const format = options.format === 'json' ? 'json' : 'markdown';
        const parsedLimit = Number.parseInt(options.limit, 10);
        await sessionRecapCommand(sessionKey, {
          limit: Number.isNaN(parsedLimit) ? 15 : parsedLimit,
          format,
          agentId: options.agent
        });
      } catch (err) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    });
}
