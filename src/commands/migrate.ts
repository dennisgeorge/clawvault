import * as fs from 'fs';
import * as path from 'path';
import type { Command } from 'commander';
import { execFileSync } from 'child_process';
import { resolveVaultPath } from '../lib/config.js';
import { hasQmd, QMD_INSTALL_COMMAND, QMD_INSTALL_URL } from '../lib/search.js';
import { loadVaultQmdConfig } from '../lib/vault-qmd-config.js';
import { listQmdCollections, removeQmdCollection, type QmdCollectionInfo } from '../lib/qmd-collections.js';
import { doctor, type MigrationIssue, type MigrationIssueType } from './doctor.js';

export interface MigrateCommandOptions {
  vaultPath?: string;
  dryRun?: boolean;
  force?: boolean;
  json?: boolean;
}

export interface MigrationAction {
  type: MigrationIssueType;
  description: string;
  success: boolean;
  error?: string;
}

export interface MigrateResult {
  vaultPath: string;
  issuesFound: number;
  issuesFixed: number;
  actions: MigrationAction[];
  dryRun: boolean;
}

function addQmdCollection(name: string, rootPath: string): void {
  execFileSync('qmd', ['collection', 'add', name, rootPath], { stdio: 'ignore', shell: process.platform === 'win32' });
}

function updateVaultConfig(
  vaultPath: string,
  updates: { qmdCollection?: string; qmdRoot?: string }
): void {
  const configPath = path.join(vaultPath, '.clawvault.json');
  let config: Record<string, unknown> = {};
  
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch {
      config = {};
    }
  }

  if (updates.qmdCollection !== undefined) {
    config.qmdCollection = updates.qmdCollection;
  }
  if (updates.qmdRoot !== undefined) {
    config.qmdRoot = updates.qmdRoot;
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
}

function fixStaleCollectionName(
  issue: MigrationIssue,
  dryRun: boolean
): MigrationAction {
  const details = issue.details as { oldName: string; newName: string; root: string };
  const action: MigrationAction = {
    type: 'stale_collection_name',
    description: `Rename collection "${details.oldName}" to "${details.newName}"`,
    success: false
  };

  if (dryRun) {
    action.success = true;
    action.description += ' (dry run)';
    return action;
  }

  try {
    removeQmdCollection(details.oldName);
    addQmdCollection(details.newName, details.root);
    action.success = true;
  } catch (err: any) {
    action.error = err?.message || 'Failed to rename collection';
  }

  return action;
}

function fixMissingQmdCollection(
  issue: MigrationIssue,
  dryRun: boolean
): MigrationAction {
  const details = issue.details as { collectionName: string; expectedRoot: string };
  const action: MigrationAction = {
    type: 'missing_qmd_collection',
    description: `Create qmd collection "${details.collectionName}" at "${details.expectedRoot}"`,
    success: false
  };

  if (dryRun) {
    action.success = true;
    action.description += ' (dry run)';
    return action;
  }

  try {
    addQmdCollection(details.collectionName, details.expectedRoot);
    action.success = true;
  } catch (err: any) {
    action.error = err?.message || 'Failed to create collection';
  }

  return action;
}

function fixWrongVaultPath(
  issue: MigrationIssue,
  dryRun: boolean
): MigrationAction {
  const details = issue.details as { collectionName: string; currentRoot: string; expectedRoot: string };
  const action: MigrationAction = {
    type: 'wrong_vault_path',
    description: `Update collection "${details.collectionName}" path from "${details.currentRoot}" to "${details.expectedRoot}"`,
    success: false
  };

  if (dryRun) {
    action.success = true;
    action.description += ' (dry run)';
    return action;
  }

  try {
    removeQmdCollection(details.collectionName);
    addQmdCollection(details.collectionName, details.expectedRoot);
    action.success = true;
  } catch (err: any) {
    action.error = err?.message || 'Failed to update collection path';
  }

  return action;
}

function fixOrphanedCollection(
  issue: MigrationIssue,
  dryRun: boolean
): MigrationAction {
  const details = issue.details as { collectionName: string; root: string };
  const action: MigrationAction = {
    type: 'orphaned_collection',
    description: `Remove orphaned collection "${details.collectionName}"`,
    success: false
  };

  if (dryRun) {
    action.success = true;
    action.description += ' (dry run)';
    return action;
  }

  try {
    removeQmdCollection(details.collectionName);
    action.success = true;
  } catch (err: any) {
    action.error = err?.message || 'Failed to remove orphaned collection';
  }

  return action;
}

function fixMissingQmdConfig(
  issue: MigrationIssue,
  vaultPath: string,
  dryRun: boolean
): MigrationAction {
  const vaultConfig = loadVaultQmdConfig(vaultPath);
  const action: MigrationAction = {
    type: 'missing_qmd_config',
    description: `Add qmdCollection="${vaultConfig.qmdCollection}" and qmdRoot="${vaultConfig.qmdRoot}" to .clawvault.json`,
    success: false
  };

  if (dryRun) {
    action.success = true;
    action.description += ' (dry run)';
    return action;
  }

  try {
    updateVaultConfig(vaultPath, {
      qmdCollection: vaultConfig.qmdCollection,
      qmdRoot: vaultConfig.qmdRoot
    });
    action.success = true;
  } catch (err: any) {
    action.error = err?.message || 'Failed to update vault config';
  }

  return action;
}

function fixIssue(
  issue: MigrationIssue,
  vaultPath: string,
  dryRun: boolean
): MigrationAction | null {
  if (!issue.autoFixable) {
    return null;
  }

  switch (issue.type) {
    case 'stale_collection_name':
      return fixStaleCollectionName(issue, dryRun);
    case 'missing_qmd_collection':
      return fixMissingQmdCollection(issue, dryRun);
    case 'wrong_vault_path':
      return fixWrongVaultPath(issue, dryRun);
    case 'orphaned_collection':
      return fixOrphanedCollection(issue, dryRun);
    case 'missing_qmd_config':
      return fixMissingQmdConfig(issue, vaultPath, dryRun);
    default:
      return null;
  }
}

export async function migrate(options: MigrateCommandOptions = {}): Promise<MigrateResult> {
  const vaultPath = resolveVaultPath({ explicitPath: options.vaultPath });
  const dryRun = options.dryRun ?? false;

  if (!hasQmd()) {
    return {
      vaultPath,
      issuesFound: 1,
      issuesFixed: 0,
      actions: [{
        type: 'missing_qmd_collection',
        description: 'qmd is not installed',
        success: false,
        error: `Install qmd first: ${QMD_INSTALL_COMMAND}\nMore info: ${QMD_INSTALL_URL}`
      }],
      dryRun
    };
  }

  const report = await doctor(vaultPath);
  const issues = report.migrationIssues;
  const actions: MigrationAction[] = [];

  for (const issue of issues) {
    const action = fixIssue(issue, vaultPath, dryRun);
    if (action) {
      actions.push(action);
    }
  }

  const issuesFixed = actions.filter(a => a.success).length;

  return {
    vaultPath,
    issuesFound: issues.length,
    issuesFixed,
    actions,
    dryRun
  };
}

function formatMigrateResult(result: MigrateResult): string {
  const lines: string[] = [];
  
  lines.push('ClawVault Migration Report');
  lines.push('-'.repeat(30));
  lines.push(`Vault: ${result.vaultPath}`);
  lines.push(`Mode: ${result.dryRun ? 'Dry Run' : 'Live'}`);
  lines.push('');

  if (result.issuesFound === 0) {
    lines.push('✓ No migration issues found. Your vault is up to date.');
    return lines.join('\n');
  }

  lines.push(`Found ${result.issuesFound} issue(s)`);
  lines.push('');

  for (const action of result.actions) {
    const prefix = action.success ? '✓' : '✗';
    lines.push(`${prefix} ${action.description}`);
    if (action.error) {
      lines.push(`  Error: ${action.error}`);
    }
  }

  lines.push('');
  if (result.dryRun) {
    lines.push(`Would fix ${result.issuesFixed}/${result.issuesFound} issue(s).`);
    lines.push('Run without --dry-run to apply changes.');
  } else {
    lines.push(`Fixed ${result.issuesFixed}/${result.issuesFound} issue(s).`);
    if (result.issuesFixed < result.issuesFound) {
      lines.push('Some issues require manual intervention.');
    }
  }

  return lines.join('\n');
}

export async function migrateCommand(options: MigrateCommandOptions = {}): Promise<MigrateResult> {
  const result = await migrate(options);

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatMigrateResult(result));
  }

  return result;
}

export function registerMigrateCommand(program: Command): void {
  program
    .command('migrate')
    .description('Auto-fix common v2→v3 migration issues (stale collections, missing qmd config, wrong paths)')
    .option('-v, --vault <path>', 'Vault path')
    .option('--dry-run', 'Preview changes without applying them')
    .option('--force', 'Force migration even if no issues detected')
    .option('--json', 'Output results as JSON')
    .action(async (rawOptions: { vault?: string; dryRun?: boolean; force?: boolean; json?: boolean }) => {
      await migrateCommand({
        vaultPath: rawOptions.vault,
        dryRun: rawOptions.dryRun,
        force: rawOptions.force,
        json: rawOptions.json
      });
    });
}
