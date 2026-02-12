import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import type { Command } from 'commander';
import { Observer } from '../observer/observer.js';
import { SessionWatcher } from '../observer/watcher.js';

const VAULT_CONFIG_FILE = '.clawvault.json';

export interface ObserveCommandOptions {
  watch?: string;
  threshold?: number;
  reflectThreshold?: number;
  model?: string;
  compress?: string;
  daemon?: boolean;
  vaultPath?: string;
}

function findVaultRoot(startPath: string): string | null {
  let current = path.resolve(startPath);
  while (true) {
    if (fs.existsSync(path.join(current, VAULT_CONFIG_FILE))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function resolveVaultPath(explicitPath?: string): string {
  if (explicitPath) {
    return path.resolve(explicitPath);
  }

  if (process.env.CLAWVAULT_PATH) {
    return path.resolve(process.env.CLAWVAULT_PATH);
  }

  const discovered = findVaultRoot(process.cwd());
  if (!discovered) {
    throw new Error('No ClawVault found. Set CLAWVAULT_PATH or use --vault.');
  }

  return discovered;
}

function parsePositiveInteger(raw: string, optionName: string): number {
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${optionName}: ${raw}`);
  }
  return parsed;
}

function buildDaemonArgs(options: ObserveCommandOptions): string[] {
  const cliPath = process.argv[1];
  if (!cliPath) {
    throw new Error('Unable to resolve CLI script path for daemon mode.');
  }

  const args = [cliPath, 'observe'];
  if (options.watch) {
    args.push('--watch', options.watch);
  }
  if (options.threshold) {
    args.push('--threshold', String(options.threshold));
  }
  if (options.reflectThreshold) {
    args.push('--reflect-threshold', String(options.reflectThreshold));
  }
  if (options.model) {
    args.push('--model', options.model);
  }
  if (options.vaultPath) {
    args.push('--vault', options.vaultPath);
  }

  return args;
}

async function runOneShotCompression(
  observer: Observer,
  sourceFile: string,
  vaultPath: string
): Promise<void> {
  const resolved = path.resolve(sourceFile);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    throw new Error(`Conversation file not found: ${resolved}`);
  }

  const raw = fs.readFileSync(resolved, 'utf-8');
  const messages = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  await observer.processMessages(messages.length > 0 ? messages : [raw]);

  // Force flush to capture everything
  const { observations, routingSummary } = await observer.flush();

  const datePart = new Date().toISOString().split('T')[0];
  const outputPath = path.join(vaultPath, 'observations', `${datePart}.md`);
  console.log(`Observations updated: ${outputPath}`);
  if (routingSummary) {
    console.log(routingSummary);
  }
}

async function watchSessions(observer: Observer, watchPath: string): Promise<void> {
  const watcher = new SessionWatcher(watchPath, observer);
  await watcher.start();
  console.log(`Watching session updates: ${watchPath}`);

  await new Promise<void>((resolve) => {
    const shutdown = async (): Promise<void> => {
      process.off('SIGINT', onSigInt);
      process.off('SIGTERM', onSigTerm);
      await watcher.stop();
      resolve();
    };

    const onSigInt = (): void => {
      void shutdown();
    };
    const onSigTerm = (): void => {
      void shutdown();
    };

    process.once('SIGINT', onSigInt);
    process.once('SIGTERM', onSigTerm);
  });
}

export async function observeCommand(options: ObserveCommandOptions): Promise<void> {
  if (options.compress && options.daemon) {
    throw new Error('--compress cannot be combined with --daemon.');
  }

  const vaultPath = resolveVaultPath(options.vaultPath);
  const observer = new Observer(vaultPath, {
    tokenThreshold: options.threshold,
    reflectThreshold: options.reflectThreshold,
    model: options.model
  });

  if (options.compress) {
    await runOneShotCompression(observer, options.compress, vaultPath);
    return;
  }

  let watchPath = options.watch ? path.resolve(options.watch) : '';
  if (!watchPath && options.daemon) {
    watchPath = path.join(vaultPath, 'sessions');
  }

  if (!watchPath) {
    throw new Error('Either --watch or --compress must be provided.');
  }

  if (!fs.existsSync(watchPath)) {
    if (options.daemon && !options.watch) {
      fs.mkdirSync(watchPath, { recursive: true });
    } else {
      throw new Error(`Watch path does not exist: ${watchPath}`);
    }
  }

  if (options.daemon) {
    const daemonArgs = buildDaemonArgs({ ...options, watch: watchPath, vaultPath });
    const child = spawn(process.execPath, daemonArgs, {
      detached: true,
      stdio: 'ignore'
    });
    child.unref();
    console.log(`Observer daemon started (pid: ${child.pid})`);
    return;
  }

  await watchSessions(observer, watchPath);
}

export function registerObserveCommand(program: Command): void {
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
    .action(async (rawOptions: {
      watch?: string;
      threshold: string;
      reflectThreshold: string;
      model?: string;
      compress?: string;
      daemon?: boolean;
      vault?: string;
    }) => {
      await observeCommand({
        watch: rawOptions.watch,
        threshold: parsePositiveInteger(rawOptions.threshold, 'threshold'),
        reflectThreshold: parsePositiveInteger(rawOptions.reflectThreshold, 'reflect-threshold'),
        model: rawOptions.model,
        compress: rawOptions.compress,
        daemon: rawOptions.daemon,
        vaultPath: rawOptions.vault
      });
    });
}
