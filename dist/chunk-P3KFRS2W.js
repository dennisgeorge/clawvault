import {
  Observer,
  parseSessionFile
} from "./chunk-PBLNXOPM.js";

// src/commands/observe.ts
import * as fs2 from "fs";
import * as path2 from "path";
import { spawn } from "child_process";

// src/observer/watcher.ts
import * as fs from "fs";
import * as path from "path";
import chokidar from "chokidar";
var SessionWatcher = class {
  watchPath;
  observer;
  ignoreInitial;
  watcher = null;
  fileOffsets = /* @__PURE__ */ new Map();
  processingQueue = Promise.resolve();
  constructor(watchPath, observer, options = {}) {
    this.watchPath = path.resolve(watchPath);
    this.observer = observer;
    this.ignoreInitial = options.ignoreInitial ?? false;
  }
  async start() {
    if (!fs.existsSync(this.watchPath)) {
      throw new Error(`Watch path does not exist: ${this.watchPath}`);
    }
    this.watcher = chokidar.watch(this.watchPath, {
      persistent: true,
      ignoreInitial: this.ignoreInitial,
      awaitWriteFinish: {
        stabilityThreshold: 120,
        pollInterval: 30
      }
    });
    const enqueue = (changedPath) => {
      this.processingQueue = this.processingQueue.then(() => this.consumeFile(changedPath)).catch(() => void 0);
    };
    this.watcher.on("add", enqueue);
    this.watcher.on("change", enqueue);
    this.watcher.on("unlink", (deletedPath) => {
      this.fileOffsets.delete(path.resolve(deletedPath));
    });
  }
  async stop() {
    await this.watcher?.close();
    this.watcher = null;
  }
  async consumeFile(filePath) {
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) {
      return;
    }
    const stats = fs.statSync(resolved);
    if (!stats.isFile()) {
      return;
    }
    const previousOffset = this.fileOffsets.get(resolved) ?? 0;
    const startOffset = stats.size < previousOffset ? 0 : previousOffset;
    if (stats.size <= startOffset) {
      this.fileOffsets.set(resolved, stats.size);
      return;
    }
    const bytesToRead = stats.size - startOffset;
    const buffer = Buffer.alloc(bytesToRead);
    const fd = fs.openSync(resolved, "r");
    try {
      fs.readSync(fd, buffer, 0, bytesToRead, startOffset);
    } finally {
      fs.closeSync(fd);
    }
    this.fileOffsets.set(resolved, stats.size);
    const chunk = buffer.toString("utf-8");
    const messages = chunk.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (messages.length === 0) {
      return;
    }
    await this.observer.processMessages(messages);
  }
};

// src/commands/observe.ts
var VAULT_CONFIG_FILE = ".clawvault.json";
function findVaultRoot(startPath) {
  let current = path2.resolve(startPath);
  while (true) {
    if (fs2.existsSync(path2.join(current, VAULT_CONFIG_FILE))) {
      return current;
    }
    const parent = path2.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}
function resolveVaultPath(explicitPath) {
  if (explicitPath) {
    return path2.resolve(explicitPath);
  }
  if (process.env.CLAWVAULT_PATH) {
    return path2.resolve(process.env.CLAWVAULT_PATH);
  }
  const discovered = findVaultRoot(process.cwd());
  if (!discovered) {
    throw new Error("No ClawVault found. Set CLAWVAULT_PATH or use --vault.");
  }
  return discovered;
}
function parsePositiveInteger(raw, optionName) {
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${optionName}: ${raw}`);
  }
  return parsed;
}
function buildDaemonArgs(options) {
  const cliPath = process.argv[1];
  if (!cliPath) {
    throw new Error("Unable to resolve CLI script path for daemon mode.");
  }
  const args = [cliPath, "observe"];
  if (options.watch) {
    args.push("--watch", options.watch);
  }
  if (options.threshold) {
    args.push("--threshold", String(options.threshold));
  }
  if (options.reflectThreshold) {
    args.push("--reflect-threshold", String(options.reflectThreshold));
  }
  if (options.model) {
    args.push("--model", options.model);
  }
  if (options.vaultPath) {
    args.push("--vault", options.vaultPath);
  }
  return args;
}
async function runOneShotCompression(observer, sourceFile, vaultPath) {
  const resolved = path2.resolve(sourceFile);
  if (!fs2.existsSync(resolved) || !fs2.statSync(resolved).isFile()) {
    throw new Error(`Conversation file not found: ${resolved}`);
  }
  const messages = parseSessionFile(resolved);
  await observer.processMessages(messages);
  const { observations, routingSummary } = await observer.flush();
  const datePart = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const outputPath = path2.join(vaultPath, "observations", `${datePart}.md`);
  console.log(`Observations updated: ${outputPath}`);
  if (routingSummary) {
    console.log(routingSummary);
  }
}
async function watchSessions(observer, watchPath) {
  const watcher = new SessionWatcher(watchPath, observer);
  await watcher.start();
  console.log(`Watching session updates: ${watchPath}`);
  await new Promise((resolve3) => {
    const shutdown = async () => {
      process.off("SIGINT", onSigInt);
      process.off("SIGTERM", onSigTerm);
      await watcher.stop();
      resolve3();
    };
    const onSigInt = () => {
      void shutdown();
    };
    const onSigTerm = () => {
      void shutdown();
    };
    process.once("SIGINT", onSigInt);
    process.once("SIGTERM", onSigTerm);
  });
}
async function observeCommand(options) {
  if (options.compress && options.daemon) {
    throw new Error("--compress cannot be combined with --daemon.");
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
  let watchPath = options.watch ? path2.resolve(options.watch) : "";
  if (!watchPath && options.daemon) {
    watchPath = path2.join(vaultPath, "sessions");
  }
  if (!watchPath) {
    throw new Error("Either --watch or --compress must be provided.");
  }
  if (!fs2.existsSync(watchPath)) {
    if (options.daemon && !options.watch) {
      fs2.mkdirSync(watchPath, { recursive: true });
    } else {
      throw new Error(`Watch path does not exist: ${watchPath}`);
    }
  }
  if (options.daemon) {
    const daemonArgs = buildDaemonArgs({ ...options, watch: watchPath, vaultPath });
    const child = spawn(process.execPath, daemonArgs, {
      detached: true,
      stdio: "ignore"
    });
    child.unref();
    console.log(`Observer daemon started (pid: ${child.pid})`);
    return;
  }
  await watchSessions(observer, watchPath);
}
function registerObserveCommand(program) {
  program.command("observe").description("Observe session files and build observational memory").option("--watch <path>", "Watch session file or directory").option("--threshold <n>", "Compression token threshold", "30000").option("--reflect-threshold <n>", "Reflection token threshold", "40000").option("--model <model>", "LLM model override").option("--compress <file>", "One-shot compression for a conversation file").option("--daemon", "Run in detached background mode").option("-v, --vault <path>", "Vault path").action(async (rawOptions) => {
    await observeCommand({
      watch: rawOptions.watch,
      threshold: parsePositiveInteger(rawOptions.threshold, "threshold"),
      reflectThreshold: parsePositiveInteger(rawOptions.reflectThreshold, "reflect-threshold"),
      model: rawOptions.model,
      compress: rawOptions.compress,
      daemon: rawOptions.daemon,
      vaultPath: rawOptions.vault
    });
  });
}

export {
  SessionWatcher,
  observeCommand,
  registerObserveCommand
};
