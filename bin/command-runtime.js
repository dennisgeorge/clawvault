import { spawn } from 'child_process';
import chalk from 'chalk';
import {
  ClawVault,
  QmdUnavailableError,
  QMD_INSTALL_COMMAND,
  resolveVaultPath as resolveConfiguredVaultPath
} from '../dist/index.js';

export function resolveVaultPath(vaultPath) {
  return resolveConfiguredVaultPath({ explicitPath: vaultPath });
}

export async function getVault(vaultPath) {
  const vault = new ClawVault(resolveVaultPath(vaultPath));
  await vault.load();
  return vault;
}

export async function runQmd(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('qmd', args, { stdio: 'inherit' });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`qmd exited with code ${code}`));
    });
    proc.on('error', (err) => {
      if (err?.code === 'ENOENT') {
        reject(new QmdUnavailableError());
      } else {
        reject(err);
      }
    });
  });
}

export function printQmdMissing() {
  console.error(chalk.red('Error: ClawVault requires qmd.'));
  console.log(chalk.dim(`Install: ${QMD_INSTALL_COMMAND}`));
}

export { QmdUnavailableError };
