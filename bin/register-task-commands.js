/**
 * Task tracking command registrations for ClawVault
 * Registers task, backlog, blocked, and canvas commands
 */

export function registerTaskCommands(
  program,
  { chalk, resolveVaultPath }
) {
  // === TASK ===
  const taskCmd = program
    .command('task')
    .description('Task management');

  // task add
  taskCmd
    .command('add <title>')
    .description('Add a new task')
    .option('-v, --vault <path>', 'Vault path')
    .option('--owner <owner>', 'Task owner')
    .option('--project <project>', 'Project name')
    .option('--priority <priority>', 'Priority (critical, high, medium, low)')
    .option('--due <date>', 'Due date (YYYY-MM-DD)')
    .action(async (title, options) => {
      try {
        const vaultPath = resolveVaultPath(options.vault);
        const { taskCommand } = await import('../dist/commands/task.js');
        await taskCommand(vaultPath, 'add', {
          title,
          options: {
            owner: options.owner,
            project: options.project,
            priority: options.priority,
            due: options.due
          }
        });
      } catch (err) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    });

  // task list
  taskCmd
    .command('list')
    .description('List tasks')
    .option('-v, --vault <path>', 'Vault path')
    .option('--owner <owner>', 'Filter by owner')
    .option('--project <project>', 'Filter by project')
    .option('--status <status>', 'Filter by status (open, in-progress, blocked, done)')
    .option('--priority <priority>', 'Filter by priority')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const vaultPath = resolveVaultPath(options.vault);
        const { taskCommand } = await import('../dist/commands/task.js');
        await taskCommand(vaultPath, 'list', {
          options: {
            owner: options.owner,
            project: options.project,
            status: options.status,
            priority: options.priority,
            json: options.json
          }
        });
      } catch (err) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    });

  // task update
  taskCmd
    .command('update <slug>')
    .description('Update a task')
    .option('-v, --vault <path>', 'Vault path')
    .option('--status <status>', 'New status')
    .option('--owner <owner>', 'New owner')
    .option('--project <project>', 'New project')
    .option('--priority <priority>', 'New priority')
    .option('--blocked-by <blocker>', 'What is blocking this task')
    .option('--due <date>', 'New due date')
    .option('--confidence <value>', 'Transition confidence (0-1)', parseFloat)
    .option('--reason <reason>', 'Reason for status change')
    .action(async (slug, options) => {
      try {
        const vaultPath = resolveVaultPath(options.vault);
        const { taskCommand } = await import('../dist/commands/task.js');
        await taskCommand(vaultPath, 'update', {
          slug,
          options: {
            status: options.status,
            owner: options.owner,
            project: options.project,
            priority: options.priority,
            blockedBy: options.blockedBy,
            due: options.due,
            confidence: options.confidence,
            reason: options.reason
          }
        });
      } catch (err) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    });

  // task done
  taskCmd
    .command('done <slug>')
    .description('Mark a task as done')
    .option('-v, --vault <path>', 'Vault path')
    .option('--confidence <value>', 'Transition confidence (0-1)', parseFloat)
    .option('--reason <reason>', 'Reason for completion')
    .action(async (slug, options) => {
      try {
        const vaultPath = resolveVaultPath(options.vault);
        const { taskCommand } = await import('../dist/commands/task.js');
        await taskCommand(vaultPath, 'done', {
          slug,
          options: {
            confidence: options.confidence,
            reason: options.reason
          }
        });
      } catch (err) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    });

  // task transitions
  taskCmd
    .command('transitions [task_id]')
    .description('Show transition history')
    .option('-v, --vault <path>', 'Vault path')
    .option('--agent <id>', 'Filter by agent')
    .option('--failed', 'Show only regression transitions')
    .option('--json', 'Output as JSON')
    .action(async (taskId, options) => {
      try {
        const vaultPath = resolveVaultPath(options.vault);
        const { taskCommand } = await import('../dist/commands/task.js');
        await taskCommand(vaultPath, 'transitions', {
          slug: taskId,
          options: {
            agent: options.agent,
            failed: options.failed,
            json: options.json
          }
        });
      } catch (err) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    });

  // task show
  taskCmd
    .command('show <slug>')
    .description('Show task details')
    .option('-v, --vault <path>', 'Vault path')
    .option('--json', 'Output as JSON')
    .action(async (slug, options) => {
      try {
        const vaultPath = resolveVaultPath(options.vault);
        const { taskCommand } = await import('../dist/commands/task.js');
        await taskCommand(vaultPath, 'show', {
          slug,
          options: { json: options.json }
        });
      } catch (err) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    });

  // === BACKLOG ===
  const backlogCmd = program
    .command('backlog')
    .description('Backlog management');

  // backlog add (also supports "backlog <title>" shorthand)
  backlogCmd
    .command('add <title>')
    .description('Add item to backlog')
    .option('-v, --vault <path>', 'Vault path')
    .option('--source <source>', 'Source of the idea')
    .option('--project <project>', 'Project name')
    .action(async (title, options) => {
      try {
        const vaultPath = resolveVaultPath(options.vault);
        const { backlogCommand } = await import('../dist/commands/backlog.js');
        await backlogCommand(vaultPath, 'add', {
          title,
          options: {
            source: options.source,
            project: options.project
          }
        });
      } catch (err) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    });

  // backlog list
  backlogCmd
    .command('list')
    .description('List backlog items')
    .option('-v, --vault <path>', 'Vault path')
    .option('--project <project>', 'Filter by project')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const vaultPath = resolveVaultPath(options.vault);
        const { backlogCommand } = await import('../dist/commands/backlog.js');
        await backlogCommand(vaultPath, 'list', {
          options: {
            project: options.project,
            json: options.json
          }
        });
      } catch (err) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    });

  // backlog promote
  backlogCmd
    .command('promote <slug>')
    .description('Promote backlog item to task')
    .option('-v, --vault <path>', 'Vault path')
    .option('--owner <owner>', 'Task owner')
    .option('--priority <priority>', 'Task priority')
    .option('--due <date>', 'Due date')
    .action(async (slug, options) => {
      try {
        const vaultPath = resolveVaultPath(options.vault);
        const { backlogCommand } = await import('../dist/commands/backlog.js');
        await backlogCommand(vaultPath, 'promote', {
          slug,
          options: {
            owner: options.owner,
            priority: options.priority,
            due: options.due
          }
        });
      } catch (err) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    });

  // === BLOCKED ===
  program
    .command('blocked')
    .description('View blocked tasks')
    .option('-v, --vault <path>', 'Vault path')
    .option('--project <project>', 'Filter by project')
    .option('--escalated', 'Show only escalated tasks (3+ blocked transitions)')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const vaultPath = resolveVaultPath(options.vault);
        const { blockedCommand } = await import('../dist/commands/blocked.js');
        await blockedCommand(vaultPath, {
          project: options.project,
          escalated: options.escalated,
          json: options.json
        });
      } catch (err) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    });

  // === CANVAS ===
  program
    .command('canvas')
    .description('Generate Obsidian canvas dashboard')
    .option('-v, --vault <path>', 'Vault path')
    .option('--output <path>', 'Output file path (default: dashboard.canvas)')
    .option('--template <id>', 'Canvas template ID (default, project-board, brain, sprint)')
    .option('--project <project>', 'Project filter for template-aware canvases')
    .option('--owner <owner>', 'Filter tasks by owner (agent name or human)')
    .option('--width <pixels>', 'Canvas width in pixels', parseInt)
    .option('--height <pixels>', 'Canvas height in pixels', parseInt)
    .option('--include-done', 'Include completed tasks (default: limited)')
    .option('--list-templates', 'List available canvas templates and exit')
    .action(async (options) => {
      try {
        const vaultPath = options.listTemplates
          ? (options.vault || '.')
          : resolveVaultPath(options.vault);
        const { canvasCommand } = await import('../dist/commands/canvas.js');
        await canvasCommand(vaultPath, {
          output: options.output,
          template: options.template,
          project: options.project,
          owner: options.owner,
          width: options.width,
          height: options.height,
          includeDone: options.includeDone,
          listTemplates: options.listTemplates
        });
      } catch (err) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    });
}
