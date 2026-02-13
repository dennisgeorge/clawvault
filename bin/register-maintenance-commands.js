/**
 * Maintenance and graph-oriented command registrations.
 * Split from the main CLI entrypoint to keep bin/clawvault.js maintainable.
 */

export function registerMaintenanceCommands(program, { chalk }) {
  // === DOCTOR (health check) ===
  program
    .command('doctor')
    .description('Check ClawVault setup health')
    .option('-v, --vault <path>', 'Vault path')
    .action(async (options) => {
      try {
        const { doctor } = await import('../dist/commands/doctor.js');
        const report = await doctor(options.vault);

        console.log(chalk.cyan('\n🩺 ClawVault Health Check\n'));
        if (report.vaultPath) {
          console.log(chalk.dim(`Vault: ${report.vaultPath}`));
          console.log();
        }

        for (const check of report.checks) {
          const prefix = check.status === 'ok'
            ? chalk.green('✓')
            : check.status === 'warn'
              ? chalk.yellow('⚠')
              : chalk.red('✗');
          const detail = check.detail ? ` — ${check.detail}` : '';
          console.log(`${prefix} ${check.label}${detail}`);
          if (check.hint) {
            console.log(chalk.dim(`  ${check.hint}`));
          }
        }

        const issues = report.warnings + report.errors;
        console.log();
        if (issues === 0) {
          console.log(chalk.green('✅ ClawVault is healthy!\n'));
        } else {
          console.log(chalk.yellow(`⚠ ${issues} issue(s) found\n`));
        }
      } catch (err) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    });

  // === COMPAT (OpenClaw compatibility) ===
  program
    .command('compat')
    .description('Check OpenClaw compatibility status')
    .option('--strict', 'Exit non-zero when warnings are present')
    .option('--base-dir <path>', 'Validate compatibility against alternate project root')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const { compatCommand, compatibilityExitCode } = await import('../dist/commands/compat.js');
        const report = await compatCommand({
          json: options.json,
          strict: options.strict,
          baseDir: options.baseDir
        });
        const exitCode = compatibilityExitCode(report, { strict: options.strict });
        if (exitCode !== 0) {
          process.exitCode = exitCode;
        }
      } catch (err) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    });

  // === GRAPH ===
  program
    .command('graph')
    .description('Show typed memory graph summary')
    .option('-v, --vault <path>', 'Vault path')
    .option('--refresh', 'Rebuild graph index before showing summary')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const { graphCommand } = await import('../dist/commands/graph.js');
        await graphCommand({
          vaultPath: options.vault,
          refresh: options.refresh,
          json: options.json
        });
      } catch (err) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    });

  // === ENTITIES ===
  program
    .command('entities')
    .description('List all linkable entities in the vault')
    .option('-v, --vault <path>', 'Vault path')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const { entitiesCommand } = await import('../dist/commands/entities.js');
        await entitiesCommand({ json: options.json, vaultPath: options.vault });
      } catch (err) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    });

  // === LINK ===
  program
    .command('link [file]')
    .description('Auto-link entity mentions in markdown files')
    .option('--all', 'Link all files in vault')
    .option('--backlinks <file>', 'Show backlinks to a file')
    .option('--dry-run', 'Show what would be linked without changing files')
    .option('--orphans', 'List broken wiki-links')
    .option('--rebuild', 'Rebuild backlinks index')
    .option('-v, --vault <path>', 'Vault path')
    .action(async (file, options) => {
      try {
        const { linkCommand } = await import('../dist/commands/link.js');
        await linkCommand(file, {
          all: options.all,
          dryRun: options.dryRun,
          backlinks: options.backlinks,
          orphans: options.orphans,
          rebuild: options.rebuild,
          vaultPath: options.vault
        });
      } catch (err) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    });
}
