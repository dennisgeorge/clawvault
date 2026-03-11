/**
 * ClawVault OpenClaw Hook
 * 
 * Provides automatic context death resilience:
 * - gateway:startup → detect context death, inject recovery info
 * - gateway:heartbeat → cheap active-session threshold checks
 * - command:new → auto-checkpoint before session reset
 * - compaction:memoryFlush → force active-session flush before compaction
 * - session:start → inject relevant context for first user prompt
 * 
 * SECURITY: Uses execFileSync (no shell) to prevent command injection
 */

import { execFileSync } from 'child_process';
import { createHash, randomUUID } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  resolveExecutablePath,
  sanitizeExecArgs,
  verifyExecutableIntegrity
} from './integrity.js';

const MAX_CONTEXT_RESULTS = 4;
const MAX_CONTEXT_PROMPT_LENGTH = 500;
const MAX_CONTEXT_SNIPPET_LENGTH = 220;
const MAX_RECAP_RESULTS = 6;
const MAX_RECAP_SNIPPET_LENGTH = 220;
const EVENT_NAME_SEPARATOR_RE = /[.:/]/g;
const OBSERVE_CURSOR_FILE = 'observe-cursors.json';
const ONE_KIB = 1024;
const ONE_MIB = ONE_KIB * ONE_KIB;
const SMALL_SESSION_THRESHOLD_BYTES = 50 * ONE_KIB;
const MEDIUM_SESSION_THRESHOLD_BYTES = 150 * ONE_KIB;
const LARGE_SESSION_THRESHOLD_BYTES = 300 * ONE_KIB;
const FACTS_FILE = 'facts.jsonl';
const ENTITY_GRAPH_FILE = 'entity-graph.json';
const ENTITY_GRAPH_VERSION = 1;
const MAX_FACT_TEXT_LENGTH = 600;
const FACT_SENTENCE_SPLIT_RE = /[.!?]+\s+|\r?\n+/;
const EXCLUSIVE_FACT_RELATIONS = new Set(['lives_in', 'works_at', 'age']);
const ENTITY_TARGET_RELATIONS = new Set(['works_at', 'lives_in', 'partner_name', 'dog_name', 'parent_name']);
const CLAWVAULT_EXECUTABLE = 'clawvault';

// Sanitize string for safe display (prevent prompt injection via control chars)
function sanitizeForDisplay(str) {
  if (typeof str !== 'string') return '';
  // Remove control characters, limit length, escape markdown
  return str
    .replace(/[\x00-\x1f\x7f]/g, '') // Remove control chars
    .replace(/[`*_~\[\]]/g, '\\$&')  // Escape markdown
    .slice(0, 200);                   // Limit length
}

// Sanitize prompt before passing to CLI command
function sanitizePromptForContext(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/[\x00-\x1f\x7f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_CONTEXT_PROMPT_LENGTH);
}

function sanitizeSessionKey(str) {
  if (typeof str !== 'string') return '';
  const trimmed = str.trim();
  if (!/^agent:[a-zA-Z0-9_-]+:[a-zA-Z0-9:_-]+$/.test(trimmed)) {
    return '';
  }
  return trimmed.slice(0, 200);
}

function extractSessionKey(event) {
  const candidates = [
    event?.sessionKey,
    event?.context?.sessionKey,
    event?.session?.key,
    event?.context?.session?.key,
    event?.metadata?.sessionKey
  ];

  for (const candidate of candidates) {
    const key = sanitizeSessionKey(candidate);
    if (key) return key;
  }

  return '';
}

function extractAgentIdFromSessionKey(sessionKey) {
  const match = /^agent:([^:]+):/.exec(sessionKey);
  if (!match?.[1]) return '';
  const agentId = match[1].trim();
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(agentId)) return '';
  return agentId;
}

function sanitizeAgentId(agentId) {
  if (typeof agentId !== 'string') return '';
  const normalized = agentId.trim();
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(normalized)) return '';
  return normalized;
}

function normalizeAbsoluteEnvPath(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const resolved = path.resolve(trimmed);
  if (!path.isAbsolute(resolved)) return null;
  return resolved;
}

function getOpenClawAgentsDir(pluginConfig) {
  if (allowsEnvAccess(pluginConfig)) {
    const stateDir = normalizeAbsoluteEnvPath(process.env.OPENCLAW_STATE_DIR);
    if (stateDir) {
      return path.join(stateDir, 'agents');
    }

    const openClawHome = normalizeAbsoluteEnvPath(process.env.OPENCLAW_HOME);
    if (openClawHome) {
      return path.join(openClawHome, 'agents');
    }
  }

  return path.join(os.homedir(), '.openclaw', 'agents');
}

function getObserveCursorPath(vaultPath) {
  return path.join(vaultPath, '.clawvault', OBSERVE_CURSOR_FILE);
}

function loadObserveCursors(vaultPath) {
  const cursorPath = getObserveCursorPath(vaultPath);
  if (!fs.existsSync(cursorPath)) {
    return {};
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(cursorPath, 'utf-8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

function getScaledObservationThresholdBytes(fileSizeBytes) {
  if (!Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0) {
    return SMALL_SESSION_THRESHOLD_BYTES;
  }
  if (fileSizeBytes < ONE_MIB) {
    return SMALL_SESSION_THRESHOLD_BYTES;
  }
  if (fileSizeBytes <= 5 * ONE_MIB) {
    return MEDIUM_SESSION_THRESHOLD_BYTES;
  }
  return LARGE_SESSION_THRESHOLD_BYTES;
}

function parseSessionIndex(agentId, pluginConfig) {
  const sessionsDir = path.join(getOpenClawAgentsDir(pluginConfig), agentId, 'sessions');
  const sessionsJsonPath = path.join(sessionsDir, 'sessions.json');
  if (!fs.existsSync(sessionsJsonPath)) {
    return { sessionsDir, index: {} };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(sessionsJsonPath, 'utf-8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { sessionsDir, index: {} };
    }
    return { sessionsDir, index: parsed };
  } catch {
    return { sessionsDir, index: {} };
  }
}

function shouldObserveActiveSessions(vaultPath, agentId, pluginConfig) {
  const cursors = loadObserveCursors(vaultPath);
  const { sessionsDir, index } = parseSessionIndex(agentId, pluginConfig);
  const entries = Object.entries(index);
  if (entries.length === 0) {
    return false;
  }

  for (const [sessionKey, value] of entries) {
    if (!value || typeof value !== 'object') continue;
    const sessionId = typeof value.sessionId === 'string' ? value.sessionId.trim() : '';
    if (!/^[a-zA-Z0-9._-]{1,200}$/.test(sessionId)) continue;

    const filePath = path.join(sessionsDir, `${sessionId}.jsonl`);
    let stat;
    try {
      stat = fs.statSync(filePath);
    } catch {
      continue;
    }
    if (!stat.isFile()) continue;

    const fileSize = stat.size;
    const cursorEntry = cursors[sessionId];
    const previousOffset = Number.isFinite(cursorEntry?.lastObservedOffset)
      ? Math.max(0, Number(cursorEntry.lastObservedOffset))
      : 0;
    const startOffset = previousOffset <= fileSize ? previousOffset : 0;
    const newBytes = Math.max(0, fileSize - startOffset);
    const thresholdBytes = getScaledObservationThresholdBytes(fileSize);

    if (newBytes >= thresholdBytes) {
      console.log(`[clawvault] Active observe trigger: ${sessionKey} (+${newBytes}B >= ${thresholdBytes}B)`);
      return true;
    }
  }

  return false;
}

function extractTextFromMessage(message) {
  if (typeof message === 'string') return message;
  if (!message || typeof message !== 'object') return '';

  const content = message.content ?? message.text ?? message.message;
  if (typeof content === 'string') return content;

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (!part || typeof part !== 'object') return '';
        if (typeof part.text === 'string') return part.text;
        if (typeof part.content === 'string') return part.content;
        return '';
      })
      .filter(Boolean)
      .join(' ');
  }

  return '';
}

function isUserMessage(message) {
  if (typeof message === 'string') return true;
  if (!message || typeof message !== 'object') return false;
  const role = typeof message.role === 'string' ? message.role.toLowerCase() : '';
  const type = typeof message.type === 'string' ? message.type.toLowerCase() : '';
  return role === 'user' || role === 'human' || type === 'user';
}

function extractInitialPrompt(event) {
  const fromContext = sanitizePromptForContext(event?.context?.initialPrompt);
  if (fromContext) return fromContext;

  const candidates = [
    event?.context?.messages,
    event?.context?.initialMessages,
    event?.context?.history,
    event?.messages
  ];

  for (const list of candidates) {
    if (!Array.isArray(list)) continue;
    for (const message of list) {
      if (!isUserMessage(message)) continue;
      const text = sanitizePromptForContext(extractTextFromMessage(message));
      if (text) return text;
    }
  }

  return '';
}

function truncateSnippet(snippet) {
  const safe = sanitizeForDisplay(snippet).replace(/\s+/g, ' ').trim();
  if (safe.length <= MAX_CONTEXT_SNIPPET_LENGTH) return safe;
  return `${safe.slice(0, MAX_CONTEXT_SNIPPET_LENGTH - 3).trimEnd()}...`;
}

function truncateRecapSnippet(snippet) {
  const safe = sanitizeForDisplay(snippet).replace(/\s+/g, ' ').trim();
  if (safe.length <= MAX_RECAP_SNIPPET_LENGTH) return safe;
  return `${safe.slice(0, MAX_RECAP_SNIPPET_LENGTH - 3).trimEnd()}...`;
}

function parseContextJson(output) {
  try {
    const parsed = JSON.parse(output);
    if (!parsed || !Array.isArray(parsed.context)) return [];

    return parsed.context
      .slice(0, MAX_CONTEXT_RESULTS)
      .map((entry) => ({
        title: sanitizeForDisplay(entry?.title || 'Untitled'),
        age: sanitizeForDisplay(entry?.age || 'unknown age'),
        snippet: truncateSnippet(entry?.snippet || '')
      }))
      .filter((entry) => entry.snippet);
  } catch {
    return [];
  }
}

function parseSessionRecapJson(output) {
  try {
    const parsed = JSON.parse(output);
    if (!parsed || !Array.isArray(parsed.messages)) return [];

    return parsed.messages
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null;
        const role = typeof entry.role === 'string' ? entry.role.toLowerCase() : '';
        if (role !== 'user' && role !== 'assistant') return null;
        const text = truncateRecapSnippet(typeof entry.text === 'string' ? entry.text : '');
        if (!text) return null;
        return {
          role: role === 'user' ? 'User' : 'Assistant',
          text
        };
      })
      .filter(Boolean)
      .slice(-MAX_RECAP_RESULTS);
  } catch {
    return [];
  }
}

function formatSessionContextInjection(recapEntries, memoryEntries) {
  const lines = ['[ClawVault] Session context restored:', '', 'Recent conversation:'];

  if (recapEntries.length === 0) {
    lines.push('- No recent user/assistant turns found for this session.');
  } else {
    for (const entry of recapEntries) {
      lines.push(`- ${entry.role}: ${entry.text}`);
    }
  }

  lines.push('', 'Relevant memories:');
  if (memoryEntries.length === 0) {
    lines.push('- No relevant vault memories found for the current prompt.');
  } else {
    for (const entry of memoryEntries) {
      lines.push(`- ${entry.title} (${entry.age}): ${entry.snippet}`);
    }
  }

  return lines.join('\n');
}

function injectSystemMessage(event, message) {
  if (!event.messages || !Array.isArray(event.messages)) return false;

  if (event.messages.length === 0) {
    event.messages.push(message);
    return true;
  }

  const first = event.messages[0];
  if (first && typeof first === 'object' && !Array.isArray(first)) {
    if ('role' in first || 'content' in first) {
      event.messages.push({ role: 'system', content: message });
      return true;
    }
    if ('type' in first || 'text' in first) {
      event.messages.push({ type: 'system', text: message });
      return true;
    }
  }

  event.messages.push(message);
  return true;
}

function normalizeEventToken(value) {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(EVENT_NAME_SEPARATOR_RE, ':');
}

function eventMatches(event, type, action) {
  const normalizedExpected = `${normalizeEventToken(type)}:${normalizeEventToken(action)}`;
  const normalizedType = normalizeEventToken(event?.type);
  const normalizedAction = normalizeEventToken(event?.action);

  if (normalizedType && normalizedAction) {
    if (`${normalizedType}:${normalizedAction}` === normalizedExpected) {
      return true;
    }
  }

  const aliases = [
    event?.event,
    event?.name,
    event?.hook,
    event?.trigger,
    event?.eventName
  ];

  for (const alias of aliases) {
    const normalizedAlias = normalizeEventToken(alias);
    if (!normalizedAlias) continue;
    if (normalizedAlias === normalizedExpected) {
      return true;
    }
  }

  return false;
}

function eventIncludesToken(event, token) {
  const normalizedToken = normalizeEventToken(token);
  if (!normalizedToken) return false;

  const values = [
    event?.type,
    event?.action,
    event?.event,
    event?.name,
    event?.hook,
    event?.trigger,
    event?.eventName
  ];

  return values
    .map((value) => normalizeEventToken(value))
    .filter(Boolean)
    .some((value) => value.includes(normalizedToken));
}

// Validate vault path - must be absolute and exist
function validateVaultPath(vaultPath) {
  if (!vaultPath || typeof vaultPath !== 'string') return null;
  
  // Resolve to absolute path
  const resolved = path.resolve(vaultPath);
  
  // Must be absolute
  if (!path.isAbsolute(resolved)) return null;
  
  // Must exist and be a directory
  try {
    const stat = fs.statSync(resolved);
    if (!stat.isDirectory()) return null;
  } catch {
    return null;
  }
  
  // Must contain .clawvault.json
  const configPath = path.join(resolved, '.clawvault.json');
  if (!fs.existsSync(configPath)) return null;
  
  return resolved;
}

// Extract plugin config from event context (set via openclaw config)
function extractPluginConfig(event) {
  const candidates = [
    event?.pluginConfig,
    event?.context?.pluginConfig,
    event?.config?.plugins?.entries?.clawvault?.config,
    event?.context?.config?.plugins?.entries?.clawvault?.config,
    event?.config?.plugins?.clawvault?.config,
    event?.context?.config?.plugins?.clawvault?.config
  ];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      return candidate;
    }
  }

  return {};
}

function isOptInEnabled(pluginConfig, ...keys) {
  for (const key of keys) {
    if (pluginConfig?.[key] === true) return true;
  }
  return false;
}

function allowsEnvAccess(pluginConfig) {
  return isOptInEnabled(pluginConfig, 'allowEnvAccess');
}

function getConfiguredExecutablePath(pluginConfig) {
  const value = pluginConfig?.clawvaultBinaryPath;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function getConfiguredExecutableSha256(pluginConfig) {
  const value = pluginConfig?.clawvaultBinarySha256;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed || null;
}

// Resolve vault path for a specific agent from agentVaults config
function resolveAgentVaultPath(pluginConfig, agentId) {
  if (!agentId || typeof agentId !== 'string') return null;
  
  const agentVaults = pluginConfig?.agentVaults;
  if (!agentVaults || typeof agentVaults !== 'object' || Array.isArray(agentVaults)) {
    return null;
  }
  
  const agentPath = agentVaults[agentId];
  if (!agentPath || typeof agentPath !== 'string') return null;
  
  return validateVaultPath(agentPath);
}

// Find vault by walking up directories
// Supports per-agent vault paths via agentVaults config
function findVaultPath(event, pluginConfig, options = {}) {
  // Determine agent ID for per-agent vault resolution
  const agentId = options.agentId || resolveAgentIdForEvent(event, pluginConfig);
  
  // Check agentVaults first (per-agent vault paths)
  if (agentId) {
    const agentVaultPath = resolveAgentVaultPath(pluginConfig, agentId);
    if (agentVaultPath) {
      console.log(`[clawvault] Using per-agent vault for ${agentId}: ${agentVaultPath}`);
      return agentVaultPath;
    }
  }

  // Check plugin config vaultPath (fallback for all agents)
  if (pluginConfig.vaultPath) {
    const validated = validateVaultPath(pluginConfig.vaultPath);
    if (validated) return validated;
  }

  if (allowsEnvAccess(pluginConfig)) {
    // Check OPENCLAW_PLUGIN_CLAWVAULT_VAULTPATH env (injected by OpenClaw from plugin config)
    if (process.env.OPENCLAW_PLUGIN_CLAWVAULT_VAULTPATH) {
      const validated = validateVaultPath(process.env.OPENCLAW_PLUGIN_CLAWVAULT_VAULTPATH);
      if (validated) return validated;
    }

    // Check CLAWVAULT_PATH env
    if (process.env.CLAWVAULT_PATH) {
      return validateVaultPath(process.env.CLAWVAULT_PATH);
    }
  }

  // Walk up from cwd
  let dir = process.cwd();
  const root = path.parse(dir).root;
  
  while (dir !== root) {
    const validated = validateVaultPath(dir);
    if (validated) return validated;
    
    // Also check memory/ subdirectory (OpenClaw convention)
    const memoryDir = path.join(dir, 'memory');
    const memoryValidated = validateVaultPath(memoryDir);
    if (memoryValidated) return memoryValidated;
    
    dir = path.dirname(dir);
  }
  
  return null;
}

// Run clawvault command safely (no shell)
function runClawvault(args, pluginConfig, options = {}) {
  if (!isOptInEnabled(pluginConfig, 'allowClawvaultExec')) {
    return {
      success: false,
      skipped: true,
      output: 'ClawVault CLI execution is disabled. Set allowClawvaultExec=true to enable.',
      code: 0
    };
  }

  const timeoutMs = Number.isFinite(options.timeoutMs) ? Math.max(1000, Number(options.timeoutMs)) : 15000;
  const executablePath = resolveExecutablePath(CLAWVAULT_EXECUTABLE, {
    explicitPath: getConfiguredExecutablePath(pluginConfig)
  });
  if (!executablePath) {
    return {
      success: false,
      output: 'Unable to resolve clawvault executable path. Set clawvaultBinaryPath to an absolute executable path.',
      code: 1
    };
  }

  const expectedSha256 = getConfiguredExecutableSha256(pluginConfig);
  const integrityResult = verifyExecutableIntegrity(executablePath, expectedSha256);
  if (!integrityResult.ok) {
    return {
      success: false,
      output: `Executable integrity verification failed for ${executablePath}.`,
      code: 1
    };
  }

  let sanitizedArgs;
  try {
    sanitizedArgs = sanitizeExecArgs(args);
  } catch (err) {
    return {
      success: false,
      output: err?.message || 'Invalid command arguments',
      code: 1
    };
  }

  try {
    const output = execFileSync(executablePath, sanitizedArgs, {
      encoding: 'utf-8',
      timeout: timeoutMs,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false
    });
    return { success: true, output: output.trim(), code: 0 };
  } catch (err) {
    return { 
      success: false, 
      output: err.stderr?.toString() || err.message || String(err),
      code: err.status || 1
    };
  }
}

// Parse recovery output safely
function parseRecoveryOutput(output) {
  if (!output || typeof output !== 'string') {
    return { hadDeath: false, workingOn: null };
  }
  
  const hadDeath = output.includes('Context death detected') || 
                   output.includes('died') || 
                   output.includes('⚠️');
  
  let workingOn = null;
  if (hadDeath) {
    const lines = output.split('\n');
    const workingOnLine = lines.find(l => l.toLowerCase().includes('working on'));
    if (workingOnLine) {
      const parts = workingOnLine.split(':');
      if (parts.length > 1) {
        workingOn = sanitizeForDisplay(parts.slice(1).join(':').trim());
      }
    }
  }
  
  return { hadDeath, workingOn };
}

function resolveAgentIdForEvent(event, pluginConfig) {
  const fromSessionKey = extractAgentIdFromSessionKey(extractSessionKey(event));
  if (fromSessionKey) return fromSessionKey;

  if (allowsEnvAccess(pluginConfig)) {
    const fromEnv = sanitizeAgentId(process.env.OPENCLAW_AGENT_ID);
    if (fromEnv) return fromEnv;
  }

  return 'main';
}

function runObserverCron(vaultPath, agentId, pluginConfig, options = {}) {
  const args = ['observe', '--cron', '--agent', agentId, '-v', vaultPath];
  if (Number.isFinite(options.minNewBytes) && Number(options.minNewBytes) > 0) {
    args.push('--min-new', String(Math.floor(Number(options.minNewBytes))));
  }

  const result = runClawvault(args, pluginConfig, { timeoutMs: 120000 });
  if (result.skipped) {
    console.log('[clawvault] Observer cron skipped: allowClawvaultExec is disabled');
    return false;
  }
  if (!result.success) {
    console.warn(`[clawvault] Observer cron failed (${options.reason || 'unknown reason'})`);
    return false;
  }

  if (result.output) {
    console.log(`[clawvault] Observer cron: ${result.output}`);
  } else {
    console.log('[clawvault] Observer cron: complete');
  }
  return true;
}

function ensureClawvaultDir(vaultPath) {
  const dir = path.join(vaultPath, '.clawvault');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getFactsFilePath(vaultPath) {
  return path.join(ensureClawvaultDir(vaultPath), FACTS_FILE);
}

function getEntityGraphFilePath(vaultPath) {
  return path.join(ensureClawvaultDir(vaultPath), ENTITY_GRAPH_FILE);
}

function sanitizeFactText(value, maxLength = MAX_FACT_TEXT_LENGTH) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\x00-\x1f\x7f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function normalizeEntityLabel(value) {
  const cleaned = sanitizeFactText(value, 120).replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
  if (!cleaned) return 'User';
  if (/^(i|me|my|mine|we|us|our|ours)$/i.test(cleaned)) {
    return 'User';
  }
  return cleaned;
}

function normalizeEntityToken(value) {
  const normalized = sanitizeFactText(value, 120)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || 'user';
}

function normalizeFactValue(value) {
  return sanitizeFactText(String(value ?? ''), 260)
    .replace(/^[,:;\s-]+|[,:;\s-]+$/g, '')
    .trim();
}

function normalizeFactRelation(value) {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function clampConfidence(value, fallback = 0.7) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  if (numeric < 0) return 0;
  if (numeric > 1) return 1;
  return numeric;
}

function toIsoTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }
  return date.toISOString();
}

function slugifyForId(value) {
  const base = sanitizeFactText(String(value ?? ''), 180)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!base) return 'unknown';
  if (base.length <= 80) return base;
  const hash = createHash('sha1').update(base).digest('hex').slice(0, 10);
  return `${base.slice(0, 64)}-${hash}`;
}

function isExclusiveFactRelation(relation) {
  return EXCLUSIVE_FACT_RELATIONS.has(relation) || relation.startsWith('favorite_');
}

function createFactRecord({
  entity,
  relation,
  value,
  validFrom,
  confidence,
  category,
  source,
  rawText
}) {
  const relationToken = normalizeFactRelation(relation);
  const valueToken = normalizeFactValue(value);
  if (!relationToken || !valueToken) return null;

  const entityLabel = normalizeEntityLabel(entity || 'User');
  const entityNorm = normalizeEntityToken(entityLabel);
  const factSource = sanitizeFactText(source || 'hook');
  const factRawText = sanitizeFactText(rawText || valueToken);
  const categoryToken = sanitizeFactText(category || 'facts', 40).toLowerCase() || 'facts';

  return {
    id: randomUUID(),
    entity: entityLabel,
    entityNorm,
    relation: relationToken,
    value: valueToken,
    validFrom: toIsoTimestamp(validFrom),
    validUntil: null,
    confidence: clampConfidence(confidence, 0.7),
    category: categoryToken,
    source: factSource,
    rawText: factRawText
  };
}

function appendPatternFacts(target, sentence, pattern, options = {}) {
  pattern.lastIndex = 0;
  let match;

  while ((match = pattern.exec(sentence)) !== null) {
    const relation = options.relation;
    const category = options.category || 'facts';
    const confidence = options.confidence ?? 0.7;
    const value = typeof options.value === 'function' ? options.value(match) : match[2];
    const entity = typeof options.entity === 'function'
      ? options.entity(match)
      : options.entity || match[1] || 'User';

    const record = createFactRecord({
      entity,
      relation,
      value,
      validFrom: options.validFrom,
      confidence,
      category,
      source: options.source,
      rawText: sentence
    });

    if (record) {
      target.push(record);
    }
  }
}

function extractFactsFromSentence(sentence, options) {
  const source = options.source || 'hook:event';
  const validFrom = options.validFrom || new Date().toISOString();
  const facts = [];
  const subjectPattern = '([A-Za-z][a-z]+(?:\\s+[A-Za-z][a-z]+)?|i|we)';

  appendPatternFacts(
    facts,
    sentence,
    new RegExp(`\\b${subjectPattern}\\s+(?:really\\s+)?prefer(?:s|red|ring)?\\s+([^.;!?]+)`, 'gi'),
    { relation: 'favorite_preference', category: 'preferences', confidence: 0.86, source, validFrom }
  );

  appendPatternFacts(
    facts,
    sentence,
    new RegExp(`\\b${subjectPattern}\\s+(?:really\\s+)?like(?:s|d)?\\s+([^.;!?]+)`, 'gi'),
    { relation: 'favorite_preference', category: 'preferences', confidence: 0.8, source, validFrom }
  );

  appendPatternFacts(
    facts,
    sentence,
    new RegExp(`\\b${subjectPattern}\\s+(?:really\\s+)?(?:hate|dislike(?:s|d)?)\\s+([^.;!?]+)`, 'gi'),
    { relation: 'dislikes', category: 'preferences', confidence: 0.84, source, validFrom }
  );

  appendPatternFacts(
    facts,
    sentence,
    new RegExp(`\\b${subjectPattern}\\s+(?:am|is|are)?\\s*allergic\\s+to\\s+([^.;!?]+)`, 'gi'),
    { relation: 'allergic_to', category: 'preferences', confidence: 0.92, source, validFrom }
  );

  appendPatternFacts(
    facts,
    sentence,
    new RegExp(`\\b${subjectPattern}\\s+(?:work|works|working)\\s+at\\s+([^.;!?]+)`, 'gi'),
    { relation: 'works_at', category: 'facts', confidence: 0.92, source, validFrom }
  );

  appendPatternFacts(
    facts,
    sentence,
    new RegExp(`\\b${subjectPattern}\\s+(?:live|lives|living)\\s+in\\s+([^.;!?]+)`, 'gi'),
    { relation: 'lives_in', category: 'facts', confidence: 0.9, source, validFrom }
  );

  appendPatternFacts(
    facts,
    sentence,
    new RegExp(`\\b${subjectPattern}\\s+(?:am|is|are)\\s+(\\d{1,3})\\s*(?:years?\\s*old)?\\b`, 'gi'),
    {
      relation: 'age',
      category: 'facts',
      confidence: 0.92,
      source,
      validFrom,
      value: (match) => match[2]
    }
  );

  appendPatternFacts(
    facts,
    sentence,
    new RegExp(`\\b${subjectPattern}\\s+bought\\s+([^.;!?]+)`, 'gi'),
    { relation: 'bought', category: 'facts', confidence: 0.86, source, validFrom }
  );

  appendPatternFacts(
    facts,
    sentence,
    new RegExp(`\\b${subjectPattern}\\s+spent\\s+\\$?(\\d+(?:\\.\\d{1,2})?)(?:\\s*(?:usd|dollars?))?(?:\\s+on\\s+([^.;!?]+))?`, 'gi'),
    {
      relation: 'spent',
      category: 'facts',
      confidence: 0.9,
      source,
      validFrom,
      value: (match) => {
        const amount = match[2] ? `$${match[2]}` : '';
        const onWhat = normalizeFactValue(match[3] || '');
        return onWhat ? `${amount} on ${onWhat}` : amount;
      }
    }
  );

  appendPatternFacts(
    facts,
    sentence,
    new RegExp(`\\b${subjectPattern}\\s+(?:decided|chose)\\s+(?:to\\s+|on\\s+)?([^.;!?]+)`, 'gi'),
    { relation: 'decided', category: 'decisions', confidence: 0.88, source, validFrom }
  );

  appendPatternFacts(
    facts,
    sentence,
    /\bmy\s+partner\s+is\s+([A-Za-z][a-z]+(?:\s+[A-Za-z][a-z]+)*)\b/gi,
    { relation: 'partner_name', category: 'entities', confidence: 0.9, source, validFrom, entity: 'User', value: (match) => match[1] }
  );

  appendPatternFacts(
    facts,
    sentence,
    /\b([A-Za-z][a-z]+(?:\s+[A-Za-z][a-z]+)*)\s+is\s+my\s+partner\b/gi,
    { relation: 'partner_name', category: 'entities', confidence: 0.9, source, validFrom, entity: 'User', value: (match) => match[1] }
  );

  appendPatternFacts(
    facts,
    sentence,
    /\bmy\s+dog\s+is\s+([A-Za-z][a-z]+(?:\s+[A-Za-z][a-z]+)*)\b/gi,
    { relation: 'dog_name', category: 'entities', confidence: 0.9, source, validFrom, entity: 'User', value: (match) => match[1] }
  );

  appendPatternFacts(
    facts,
    sentence,
    /\bmy\s+(?:mom|mother|dad|father|parent)\s+is\s+([A-Za-z][a-z]+(?:\s+[A-Za-z][a-z]+)*)\b/gi,
    { relation: 'parent_name', category: 'entities', confidence: 0.9, source, validFrom, entity: 'User', value: (match) => match[1] }
  );

  const deduped = [];
  const seen = new Set();
  for (const fact of facts) {
    const dedupeKey = `${fact.entityNorm}|${fact.relation}|${normalizeFactValue(fact.value).toLowerCase()}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    deduped.push(fact);
  }

  return deduped;
}

function splitObservedTextIntoSentences(text) {
  return sanitizeFactText(text, 6000)
    .split(FACT_SENTENCE_SPLIT_RE)
    .map((part) => sanitizeFactText(part))
    .filter((part) => part.length >= 8);
}

function collectTextsFromMessageLike(target, value, depth = 0) {
  if (depth > 3 || value === null || value === undefined) return;

  if (typeof value === 'string') {
    const text = sanitizeFactText(value, 4000);
    if (text) target.push(text);
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      collectTextsFromMessageLike(target, entry, depth + 1);
    }
    return;
  }

  if (typeof value !== 'object') return;

  const direct = extractTextFromMessage(value);
  if (direct) {
    target.push(sanitizeFactText(direct, 4000));
  }

  const directKeys = ['text', 'message', 'content', 'rawText', 'observedText', 'observation', 'prompt'];
  for (const key of directKeys) {
    if (typeof value[key] === 'string') {
      target.push(sanitizeFactText(value[key], 4000));
    }
  }

  const nestedKeys = ['messages', 'history', 'entries', 'items', 'observations', 'events', 'payload', 'context'];
  for (const key of nestedKeys) {
    if (value[key] !== undefined) {
      collectTextsFromMessageLike(target, value[key], depth + 1);
    }
  }
}

function collectObservedTextsForFactExtraction(event) {
  const collected = [];

  const directStringCandidates = [
    event?.text,
    event?.message,
    event?.content,
    event?.rawText,
    event?.context?.text,
    event?.context?.message,
    event?.context?.content,
    event?.context?.rawText,
    event?.context?.initialPrompt
  ];

  for (const candidate of directStringCandidates) {
    if (typeof candidate === 'string') {
      const text = sanitizeFactText(candidate, 4000);
      if (text) collected.push(text);
    }
  }

  const structuredCandidates = [
    event?.messages,
    event?.context?.messages,
    event?.context?.history,
    event?.context?.initialMessages,
    event?.context?.memoryFlush,
    event?.context?.flush,
    event?.observations,
    event?.context?.observations,
    event?.payload?.messages,
    event?.payload?.events
  ];

  for (const candidate of structuredCandidates) {
    collectTextsFromMessageLike(collected, candidate);
  }

  const deduped = [];
  const seen = new Set();
  for (const item of collected) {
    const normalized = sanitizeFactText(item, 4000);
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    deduped.push(normalized);
  }
  return deduped;
}

function extractFactsFromObservedText(observedTexts, options) {
  const facts = [];
  const globalSeen = new Set();
  for (const text of observedTexts) {
    for (const sentence of splitObservedTextIntoSentences(text)) {
      const extracted = extractFactsFromSentence(sentence, options);
      for (const fact of extracted) {
        const dedupeKey = `${fact.entityNorm}|${fact.relation}|${normalizeFactValue(fact.value).toLowerCase()}`;
        if (globalSeen.has(dedupeKey)) continue;
        globalSeen.add(dedupeKey);
        facts.push(fact);
      }
    }
  }
  return facts;
}

function normalizeStoredFact(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const relation = normalizeFactRelation(raw.relation);
  const value = normalizeFactValue(raw.value);
  if (!relation || !value) return null;

  const entity = normalizeEntityLabel(raw.entity || raw.entityNorm || 'User');
  const entityNorm = normalizeEntityToken(raw.entityNorm || entity);
  const validFrom = toIsoTimestamp(raw.validFrom || new Date().toISOString());
  let validUntil = null;
  if (typeof raw.validUntil === 'string' && raw.validUntil.trim()) {
    validUntil = toIsoTimestamp(raw.validUntil);
  }

  const idBase = `${entityNorm}|${relation}|${value}|${validFrom}`;
  const fallbackId = createHash('sha1').update(idBase).digest('hex').slice(0, 16);

  return {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : fallbackId,
    entity,
    entityNorm,
    relation,
    value,
    validFrom,
    validUntil,
    confidence: clampConfidence(raw.confidence, 0.7),
    category: sanitizeFactText(raw.category || 'facts', 40).toLowerCase() || 'facts',
    source: sanitizeFactText(raw.source || 'hook', 120) || 'hook',
    rawText: sanitizeFactText(raw.rawText || value, MAX_FACT_TEXT_LENGTH)
  };
}

function readFactsFromVault(vaultPath) {
  const factsPath = getFactsFilePath(vaultPath);
  if (!fs.existsSync(factsPath)) {
    return [];
  }

  try {
    const lines = fs.readFileSync(factsPath, 'utf-8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const facts = [];
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        const normalized = normalizeStoredFact(parsed);
        if (normalized) facts.push(normalized);
      } catch {
        // Skip malformed lines and keep processing.
      }
    }
    return facts;
  } catch {
    return [];
  }
}

function writeFactsToVault(vaultPath, facts) {
  const factsPath = getFactsFilePath(vaultPath);
  const lines = facts.map((fact) => JSON.stringify(fact));
  const payload = lines.length > 0 ? `${lines.join('\n')}\n` : '';
  fs.writeFileSync(factsPath, payload, 'utf-8');
}

function mergeFactsWithConflictResolution(existingFacts, incomingFacts) {
  const merged = [...existingFacts];
  let added = 0;
  let superseded = 0;
  let changed = false;

  for (const incoming of incomingFacts) {
    const activeSameRelation = merged.filter((fact) =>
      fact.entityNorm === incoming.entityNorm
      && fact.relation === incoming.relation
      && !fact.validUntil
    );

    const incomingValue = normalizeFactValue(incoming.value).toLowerCase();
    const hasExactActiveMatch = activeSameRelation.some((fact) =>
      normalizeFactValue(fact.value).toLowerCase() === incomingValue
    );
    if (hasExactActiveMatch) {
      continue;
    }

    const shouldSupersede = activeSameRelation.some((fact) =>
      normalizeFactValue(fact.value).toLowerCase() !== incomingValue
    );
    if (shouldSupersede || isExclusiveFactRelation(incoming.relation)) {
      for (const fact of activeSameRelation) {
        if (normalizeFactValue(fact.value).toLowerCase() === incomingValue) continue;
        if (!fact.validUntil) {
          fact.validUntil = incoming.validFrom;
          superseded += 1;
          changed = true;
        }
      }
    }

    merged.push(incoming);
    added += 1;
    changed = true;
  }

  return { facts: merged, added, superseded, changed };
}

function isTimestampAfter(candidate, reference) {
  const candidateTime = new Date(candidate).getTime();
  const referenceTime = new Date(reference).getTime();
  if (Number.isNaN(candidateTime)) return false;
  if (Number.isNaN(referenceTime)) return true;
  return candidateTime > referenceTime;
}

function ensureGraphNode(nodesById, descriptor, seenAt) {
  const existing = nodesById.get(descriptor.id);
  if (!existing) {
    nodesById.set(descriptor.id, {
      id: descriptor.id,
      name: descriptor.name,
      displayName: descriptor.displayName,
      type: descriptor.type,
      attributes: descriptor.attributes || {},
      lastSeen: seenAt
    });
    return;
  }

  existing.attributes = { ...existing.attributes, ...(descriptor.attributes || {}) };
  if (isTimestampAfter(seenAt, existing.lastSeen)) {
    existing.lastSeen = seenAt;
  }
}

function inferTargetNodeType(relation) {
  if (relation === 'works_at') return 'organization';
  if (relation === 'lives_in') return 'location';
  if (relation === 'partner_name' || relation === 'parent_name') return 'person';
  if (relation === 'dog_name') return 'pet';
  if (relation === 'age' || relation === 'spent') return 'number';
  if (relation === 'bought') return 'item';
  if (relation === 'decided') return 'decision';
  if (relation === 'allergic_to') return 'substance';
  if (relation === 'favorite_preference' || relation === 'dislikes') return 'preference';
  return 'attribute';
}

function buildTargetNodeDescriptor(fact) {
  const relation = normalizeFactRelation(fact.relation);
  const value = normalizeFactValue(fact.value);
  if (!relation || !value) return null;

  if (ENTITY_TARGET_RELATIONS.has(relation)) {
    const normalizedEntityValue = normalizeEntityToken(value);
    return {
      id: `entity:${slugifyForId(normalizedEntityValue)}`,
      name: normalizedEntityValue,
      displayName: value,
      type: inferTargetNodeType(relation),
      attributes: { relation }
    };
  }

  return {
    id: `value:${relation}:${slugifyForId(value)}`,
    name: value.toLowerCase(),
    displayName: value,
    type: inferTargetNodeType(relation),
    attributes: { relation }
  };
}

function buildEntityGraphFromFacts(facts) {
  const nodesById = new Map();
  const edges = [];

  for (const fact of facts) {
    const normalized = normalizeStoredFact(fact);
    if (!normalized) continue;

    const sourceNodeId = `entity:${slugifyForId(normalized.entityNorm)}`;
    const seenAt = normalized.validFrom || new Date().toISOString();
    ensureGraphNode(nodesById, {
      id: sourceNodeId,
      name: normalized.entityNorm,
      displayName: normalized.entity,
      type: 'person',
      attributes: { entityNorm: normalized.entityNorm }
    }, seenAt);

    const targetNode = buildTargetNodeDescriptor(normalized);
    if (!targetNode) continue;
    ensureGraphNode(nodesById, targetNode, seenAt);

    const edgeHashSource = `${normalized.id}|${sourceNodeId}|${targetNode.id}|${normalized.relation}|${normalized.validFrom}`;
    const edgeId = `edge:${createHash('sha1').update(edgeHashSource).digest('hex').slice(0, 18)}`;

    edges.push({
      id: edgeId,
      source: sourceNodeId,
      target: targetNode.id,
      relation: normalized.relation,
      validFrom: normalized.validFrom,
      validUntil: normalized.validUntil,
      confidence: clampConfidence(normalized.confidence, 0.7)
    });
  }

  const nodes = [...nodesById.values()].sort((a, b) => a.id.localeCompare(b.id));
  const sortedEdges = edges.sort((a, b) => a.id.localeCompare(b.id));
  return {
    version: ENTITY_GRAPH_VERSION,
    nodes,
    edges: sortedEdges
  };
}

function writeEntityGraphToVault(vaultPath, facts) {
  const graphPath = getEntityGraphFilePath(vaultPath);
  const graph = buildEntityGraphFromFacts(facts);
  fs.writeFileSync(graphPath, JSON.stringify(graph, null, 2), 'utf-8');
}

function persistExtractedFacts(vaultPath, incomingFacts) {
  const existingFacts = readFactsFromVault(vaultPath);
  const normalizedIncomingFacts = incomingFacts
    .map((fact) => normalizeStoredFact(fact))
    .filter(Boolean);

  if (normalizedIncomingFacts.length === 0) {
    writeEntityGraphToVault(vaultPath, existingFacts);
    return { facts: existingFacts, added: 0, superseded: 0 };
  }

  const { facts, added, superseded, changed } = mergeFactsWithConflictResolution(
    existingFacts,
    normalizedIncomingFacts
  );

  if (changed || !fs.existsSync(getFactsFilePath(vaultPath))) {
    writeFactsToVault(vaultPath, facts);
  }
  writeEntityGraphToVault(vaultPath, facts);
  return { facts, added, superseded };
}

function runFactExtractionForEvent(vaultPath, event, eventLabel) {
  try {
    const observedTexts = collectObservedTextsForFactExtraction(event);
    if (observedTexts.length === 0) {
      console.log(`[clawvault] Fact extraction skipped (${eventLabel}: no observed text)`);
      return;
    }

    const validFrom = toIsoTimestamp(extractEventTimestamp(event) || new Date());
    const source = `hook:${eventLabel}`;
    const extracted = extractFactsFromObservedText(observedTexts, { source, validFrom });

    if (extracted.length === 0) {
      console.log(`[clawvault] Fact extraction found no matches (${eventLabel})`);
      return;
    }

    const { facts, added, superseded } = persistExtractedFacts(vaultPath, extracted);
    console.log(`[clawvault] Fact extraction complete (${eventLabel}): +${added}, superseded ${superseded}, total ${facts.length}`);
  } catch (err) {
    console.warn(`[clawvault] Fact extraction failed (${eventLabel}): ${err?.message || 'unknown error'}`);
  }
}

function extractEventTimestamp(event) {
  const candidates = [
    event?.timestamp,
    event?.scheduledAt,
    event?.time,
    event?.context?.timestamp,
    event?.context?.scheduledAt
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return null;
}

function isSundayMidnightUtc(date) {
  return date.getUTCDay() === 0 && date.getUTCHours() === 0 && date.getUTCMinutes() === 0;
}

async function handleWeeklyReflect(event) {
  const pluginConfig = extractPluginConfig(event);
  if (!isOptInEnabled(pluginConfig, 'enableWeeklyReflection', 'weeklyReflection')) {
    return;
  }

  const vaultPath = findVaultPath(event, pluginConfig);
  if (!vaultPath) {
    console.log('[clawvault] No vault found, skipping weekly reflection');
    return;
  }

  const timestamp = extractEventTimestamp(event) || new Date();
  if (!isSundayMidnightUtc(timestamp)) {
    console.log('[clawvault] Weekly reflect skipped (not Sunday midnight UTC)');
    return;
  }

  const result = runClawvault(['reflect', '-v', vaultPath], pluginConfig, { timeoutMs: 120000 });
  if (result.skipped) {
    console.log('[clawvault] Weekly reflection skipped: allowClawvaultExec is disabled');
    return;
  }
  if (!result.success) {
    console.warn('[clawvault] Weekly reflection failed');
    return;
  }
  console.log('[clawvault] Weekly reflection complete');
}

// Handle gateway startup - check for context death
async function handleStartup(event) {
  const pluginConfig = extractPluginConfig(event);
  if (!isOptInEnabled(pluginConfig, 'enableStartupRecovery')) {
    return;
  }

  const vaultPath = findVaultPath(event, pluginConfig);
  if (!vaultPath) {
    console.log('[clawvault] No vault found, skipping recovery check');
    return;
  }

  console.log(`[clawvault] Checking for context death`);

  // Pass vault path as separate argument (not interpolated)
  const result = runClawvault(['recover', '--clear', '-v', vaultPath], pluginConfig);
  if (result.skipped) {
    console.log('[clawvault] Recovery check skipped: allowClawvaultExec is disabled');
    return;
  }
  
  if (!result.success) {
    console.warn('[clawvault] Recovery check failed');
    return;
  }

  const { hadDeath, workingOn } = parseRecoveryOutput(result.output);
  
  if (hadDeath) {
    // Build safe alert message with sanitized content
    const alertParts = ['[ClawVault] Context death detected.'];
    if (workingOn) {
      alertParts.push(`Last working on: ${workingOn}`);
    }
    alertParts.push('Run `clawvault wake` for full recovery context.');
    
    const alertMsg = alertParts.join(' ');

    // Inject into event messages if available
    if (injectSystemMessage(event, alertMsg)) {
      console.warn('[clawvault] Context death detected, alert injected');
    }
  } else {
    console.log('[clawvault] Clean startup - no context death');
  }
}

// Handle /new command - auto-checkpoint before reset
async function handleNew(event) {
  const pluginConfig = extractPluginConfig(event);
  const autoCheckpointEnabled = isOptInEnabled(pluginConfig, 'enableAutoCheckpoint', 'autoCheckpoint');
  const observerOnNewEnabled = isOptInEnabled(pluginConfig, 'enableObserveOnNew');
  const factExtractionEnabled = isOptInEnabled(pluginConfig, 'enableFactExtraction');
  if (!autoCheckpointEnabled && !observerOnNewEnabled && !factExtractionEnabled) {
    return;
  }

  const vaultPath = findVaultPath(event, pluginConfig);
  if (!vaultPath) {
    console.log('[clawvault] No vault found, skipping auto-checkpoint');
    return;
  }

  // Sanitize session info for checkpoint
  const sessionKey = typeof event.sessionKey === 'string' 
    ? event.sessionKey.replace(/[^a-zA-Z0-9:_-]/g, '').slice(0, 100)
    : 'unknown';
  const source = typeof event.context?.commandSource === 'string'
    ? event.context.commandSource.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 50)
    : 'cli';

  if (autoCheckpointEnabled) {
    console.log('[clawvault] Auto-checkpoint before /new');
    const result = runClawvault([
      'checkpoint',
      '--working-on', `Session reset via /new from ${source}`,
      '--focus', `Pre-reset checkpoint, session: ${sessionKey}`,
      '-v', vaultPath
    ], pluginConfig);

    if (result.skipped) {
      console.log('[clawvault] Auto-checkpoint skipped: allowClawvaultExec is disabled');
    } else if (result.success) {
      console.log('[clawvault] Auto-checkpoint created');
    } else {
      console.warn('[clawvault] Auto-checkpoint failed');
    }
  }

  const agentId = resolveAgentIdForEvent(event, pluginConfig);
  if (observerOnNewEnabled) {
    runObserverCron(vaultPath, agentId, pluginConfig, {
      minNewBytes: 1,
      reason: 'command:new flush'
    });
  }
  if (factExtractionEnabled) {
    runFactExtractionForEvent(vaultPath, event, 'command:new');
  }
}

// Handle session start - inject dynamic context for first prompt
async function handleSessionStart(event) {
  const pluginConfig = extractPluginConfig(event);
  if (!isOptInEnabled(pluginConfig, 'enableSessionContextInjection')) {
    return;
  }

  const vaultPath = findVaultPath(event, pluginConfig);
  if (!vaultPath) {
    console.log('[clawvault] No vault found, skipping context injection');
    return;
  }

  const sessionKey = extractSessionKey(event);
  const prompt = extractInitialPrompt(event);
  let recapEntries = [];
  let memoryEntries = [];

  if (sessionKey) {
    console.log('[clawvault] Fetching session recap for context restoration');
    const recapArgs = ['session-recap', sessionKey, '--format', 'json'];
    const agentId = extractAgentIdFromSessionKey(sessionKey);
    if (agentId) {
      recapArgs.push('--agent', agentId);
    }

    const recapResult = runClawvault(recapArgs, pluginConfig);
    if (recapResult.skipped) {
      console.log('[clawvault] Session recap skipped: allowClawvaultExec is disabled');
    }
    if (recapResult.success) {
      recapEntries = parseSessionRecapJson(recapResult.output);
    } else if (!recapResult.skipped) {
      console.warn('[clawvault] Session recap lookup failed');
    }
  } else {
    console.log('[clawvault] No session key found, skipping session recap');
  }

  if (prompt) {
    console.log('[clawvault] Fetching vault memories for session start prompt');
    const contextResult = runClawvault([
      'context',
      prompt,
      '--format', 'json',
      '--profile', 'auto',
      '-v', vaultPath
    ], pluginConfig);

    if (contextResult.success) {
      memoryEntries = parseContextJson(contextResult.output);
    } else if (contextResult.skipped) {
      console.log('[clawvault] Context lookup skipped: allowClawvaultExec is disabled');
    } else {
      console.warn('[clawvault] Context lookup failed');
    }
  } else {
    console.log('[clawvault] No initial prompt, skipping vault memory lookup');
  }

  if (recapEntries.length === 0 && memoryEntries.length === 0) {
    console.log('[clawvault] No session context available to inject');
    return;
  }

  if (injectSystemMessage(event, formatSessionContextInjection(recapEntries, memoryEntries))) {
    console.log(`[clawvault] Injected session context (${recapEntries.length} recap, ${memoryEntries.length} memories)`);
  } else {
    console.log('[clawvault] No message array available, skipping injection');
  }
}

// Handle heartbeat events - cheap stat-based trigger for active observation
async function handleHeartbeat(event) {
  const pluginConfig = extractPluginConfig(event);
  if (!isOptInEnabled(pluginConfig, 'enableHeartbeatObservation', 'observeOnHeartbeat')) {
    return;
  }

  const vaultPath = findVaultPath(event, pluginConfig);
  if (!vaultPath) {
    console.log('[clawvault] No vault found, skipping heartbeat observation check');
    return;
  }

  const agentId = resolveAgentIdForEvent(event, pluginConfig);
  if (!shouldObserveActiveSessions(vaultPath, agentId, pluginConfig)) {
    console.log('[clawvault] Heartbeat: no sessions crossed active-observe threshold');
    return;
  }

  runObserverCron(vaultPath, agentId, pluginConfig, { reason: 'heartbeat threshold crossed' });
}

// Handle context compaction - force flush any pending session deltas
async function handleContextCompaction(event) {
  const pluginConfig = extractPluginConfig(event);
  const compactionObserveEnabled = isOptInEnabled(pluginConfig, 'enableCompactionObservation');
  const factExtractionEnabled = isOptInEnabled(pluginConfig, 'enableFactExtraction');
  if (!compactionObserveEnabled && !factExtractionEnabled) {
    return;
  }

  const vaultPath = findVaultPath(event, pluginConfig);
  if (!vaultPath) {
    console.log('[clawvault] No vault found, skipping compaction observation');
    return;
  }

  const agentId = resolveAgentIdForEvent(event, pluginConfig);
  if (compactionObserveEnabled) {
    runObserverCron(vaultPath, agentId, pluginConfig, {
      minNewBytes: 1,
      reason: 'context compaction'
    });
  }
  if (factExtractionEnabled) {
    runFactExtractionForEvent(vaultPath, event, 'compaction:memoryFlush');
  }
}

// Main handler - route events
const handler = async (event) => {
  try {
    if (eventMatches(event, 'gateway', 'startup')) {
      await handleStartup(event);
      return;
    }

    if (
      eventMatches(event, 'cron', 'weekly')
      || eventIncludesToken(event, 'cron:weekly')
    ) {
      await handleWeeklyReflect(event);
      return;
    }

    if (
      eventMatches(event, 'gateway', 'heartbeat')
      || eventMatches(event, 'session', 'heartbeat')
      || eventIncludesToken(event, 'heartbeat')
    ) {
      await handleHeartbeat(event);
      return;
    }

    if (
      eventMatches(event, 'compaction', 'memoryflush')
      || eventMatches(event, 'context', 'compaction')
      || eventMatches(event, 'context', 'compact')
      || eventIncludesToken(event, 'compaction')
      || eventIncludesToken(event, 'memoryflush')
    ) {
      await handleContextCompaction(event);
      return;
    }

    if (eventMatches(event, 'command', 'new')) {
      await handleNew(event);
      return;
    }

    if (eventMatches(event, 'session', 'start')) {
      await handleSessionStart(event);
      return;
    }
  } catch (err) {
    console.error('[clawvault] Hook error:', err.message || 'unknown error');
  }
};

export default handler;
