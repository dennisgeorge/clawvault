/**
 * Core vault lifecycle and write command registrations.
 */

export function registerCoreCommands(
  program,
  { chalk, path, fs, createVault, getVault, runQmd }
) {
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

        console.log(chalk.cyan('\nSetting up qmd collection...'));
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
        } catch {
          console.log(chalk.yellow('⚠ qmd collection may already exist'));
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

  // === SETUP ===
  program
    .command('setup')
    .description('Auto-discover and configure a ClawVault')
    .action(async () => {
      try {
        const { setupCommand } = await import('../dist/commands/setup.js');
        await setupCommand();
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

        if (options.index !== false) {
          const collection = vault.getQmdCollection();
          await runQmd(collection ? ['update', '-c', collection] : ['update']);
          if (options.embed) {
            await runQmd(collection ? ['embed', '-c', collection] : ['embed']);
          }
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

        if (options.index !== false) {
          const collection = vault.getQmdCollection();
          await runQmd(collection ? ['update', '-c', collection] : ['update']);
        }
      } catch (err) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    });
}
