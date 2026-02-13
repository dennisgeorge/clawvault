#!/usr/bin/env node

/**
 * ClawVault CLI 🐘
 * An elephant never forgets.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { registerMaintenanceCommands } from './register-maintenance-commands.js';
import { registerCoreCommands } from './register-core-commands.js';
import { registerQueryCommands } from './register-query-commands.js';
import { registerResilienceCommands } from './register-resilience-commands.js';
import { registerSessionLifecycleCommands } from './register-session-lifecycle-commands.js';
import { registerTemplateCommands } from './register-template-commands.js';
import { registerVaultOperationsCommands } from './register-vault-operations-commands.js';
import {
  getVault,
  resolveVaultPath,
  runQmd,
  printQmdMissing,
  QmdUnavailableError
} from './command-runtime.js';
import {
  createVault
} from '../dist/index.js';

const program = new Command();

const CLI_VERSION = (() => {
  try {
    const pkgUrl = new URL('../package.json', import.meta.url);
    const pkg = JSON.parse(fs.readFileSync(pkgUrl, 'utf-8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
})();

program
  .name('clawvault')
  .description('🐘 An elephant never forgets. Structured memory for AI agents.')
  .version(CLI_VERSION);

registerCoreCommands(program, {
  chalk,
  path,
  fs,
  createVault,
  getVault,
  runQmd
});

registerQueryCommands(program, {
  chalk,
  getVault,
  resolveVaultPath,
  QmdUnavailableError,
  printQmdMissing
});

registerSessionLifecycleCommands(program, {
  chalk,
  resolveVaultPath,
  QmdUnavailableError,
  printQmdMissing,
  getVault,
  runQmd
});

registerTemplateCommands(program, { chalk });
registerMaintenanceCommands(program, { chalk });
registerResilienceCommands(program, { chalk, resolveVaultPath });
registerVaultOperationsCommands(program, {
  chalk,
  fs,
  getVault,
  runQmd,
  resolveVaultPath,
  path
});

// Parse and run
program.parse();