import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const WINDOWS_PATHEXT_DEFAULT = '.EXE;.CMD;.BAT;.COM';

function splitPathEnv(pathEnv) {
  if (typeof pathEnv !== 'string' || !pathEnv.trim()) {
    return [];
  }
  return pathEnv
    .split(path.delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function listExecutableCandidates(commandName) {
  if (process.platform !== 'win32') {
    return [commandName];
  }

  const ext = path.extname(commandName);
  if (ext) {
    return [commandName];
  }

  const pathext = splitPathEnv(process.env.PATHEXT || WINDOWS_PATHEXT_DEFAULT)
    .map((candidate) => candidate.toLowerCase());
  if (pathext.length === 0) {
    return [commandName];
  }
  return pathext.map((candidate) => `${commandName}${candidate}`);
}

function isExecutablePath(candidatePath) {
  try {
    const stats = fs.statSync(candidatePath);
    if (!stats.isFile()) return false;
    if (process.platform === 'win32') return true;
    return (stats.mode & 0o111) !== 0;
  } catch {
    return false;
  }
}

function resolveFromPath(commandName, pathEnv) {
  const candidates = listExecutableCandidates(commandName);
  const directories = splitPathEnv(pathEnv);
  for (const directory of directories) {
    for (const candidate of candidates) {
      const absoluteCandidate = path.resolve(directory, candidate);
      if (isExecutablePath(absoluteCandidate)) {
        return absoluteCandidate;
      }
    }
  }
  return null;
}

export function resolveExecutablePath(commandName, options = {}) {
  if (typeof commandName !== 'string' || !commandName.trim()) {
    return null;
  }

  const explicitPath = typeof options.explicitPath === 'string'
    ? options.explicitPath.trim()
    : '';
  if (explicitPath) {
    const absolute = path.resolve(explicitPath);
    return isExecutablePath(absolute) ? absolute : null;
  }

  if (commandName.includes(path.sep)) {
    const absolute = path.resolve(commandName);
    return isExecutablePath(absolute) ? absolute : null;
  }

  return resolveFromPath(commandName, process.env.PATH || '');
}

export function sanitizeExecArgs(args) {
  if (!Array.isArray(args)) {
    throw new Error('Arguments must be an array');
  }
  return args.map((value, index) => {
    if (typeof value !== 'string') {
      throw new Error(`Argument ${index} is not a string`);
    }
    if (value.includes('\0')) {
      throw new Error(`Argument ${index} contains a null byte`);
    }
    return value;
  });
}

export function verifyExecutableIntegrity(executablePath, expectedSha256) {
  if (typeof expectedSha256 !== 'string' || !expectedSha256.trim()) {
    return { ok: true, actualSha256: null };
  }

  const normalizedExpected = expectedSha256.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalizedExpected)) {
    return { ok: false, actualSha256: null };
  }

  const payload = fs.readFileSync(executablePath);
  const actualSha256 = createHash('sha256').update(payload).digest('hex').toLowerCase();
  return {
    ok: actualSha256 === normalizedExpected,
    actualSha256
  };
}
