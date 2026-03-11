import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const tempDirs = [];

const { execFileSyncMock, resolveExecutablePathMock, verifyExecutableIntegrityMock, sanitizeExecArgsMock } = vi.hoisted(() => ({
  execFileSyncMock: vi.fn(),
  resolveExecutablePathMock: vi.fn(),
  verifyExecutableIntegrityMock: vi.fn(),
  sanitizeExecArgsMock: vi.fn()
}));

vi.mock('child_process', () => ({
  execFileSync: execFileSyncMock
}));

vi.mock('../hooks/clawvault/integrity.js', () => ({
  resolveExecutablePath: resolveExecutablePathMock,
  verifyExecutableIntegrity: verifyExecutableIntegrityMock,
  sanitizeExecArgs: sanitizeExecArgsMock
}));

async function loadHandler() {
  vi.resetModules();
  const module = await import('../hooks/clawvault/handler.js');
  return module.default;
}

function makeVault() {
  const vaultPath = fs.mkdtempSync(path.join(os.tmpdir(), 'clawvault-hook-facts-'));
  fs.writeFileSync(path.join(vaultPath, '.clawvault.json'), JSON.stringify({ name: 'test' }), 'utf-8');
  tempDirs.push(vaultPath);
  return vaultPath;
}

function readFacts(vaultPath) {
  const factsPath = path.join(vaultPath, '.clawvault', 'facts.jsonl');
  const raw = fs.readFileSync(factsPath, 'utf-8');
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

beforeEach(() => {
  execFileSyncMock.mockReset();
  execFileSyncMock.mockReturnValue('ok');
  resolveExecutablePathMock.mockReset();
  resolveExecutablePathMock.mockReturnValue('/usr/local/bin/clawvault');
  verifyExecutableIntegrityMock.mockReset();
  verifyExecutableIntegrityMock.mockReturnValue({ ok: true, actualSha256: 'a'.repeat(64) });
  sanitizeExecArgsMock.mockReset();
  sanitizeExecArgsMock.mockImplementation((args) => args);
});

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  vi.clearAllMocks();
});

describe('clawvault hook fact extraction', () => {
  it('extracts structured facts and writes entity graph on command:new', async () => {
    const handler = await loadHandler();
    const vaultPath = makeVault();

    await handler({
      type: 'command',
      action: 'new',
      sessionKey: 'agent:main:session-1',
      pluginConfig: {
        vaultPath,
        allowClawvaultExec: true,
        enableFactExtraction: true,
        enableAutoCheckpoint: true,
        enableObserveOnNew: true
      },
      context: {
        commandSource: 'cli',
        messages: [
          {
            role: 'user',
            content: 'I prefer dark mode. I am allergic to peanuts. I work at Acme Corp. I live in Lisbon. I am 33 years old. I bought a MacBook Pro. I spent $1200 on a monitor. I decided to use PostgreSQL. My partner is Alice. My dog is Bruno. My mother is Carol.'
          }
        ]
      }
    });

    const factsPath = path.join(vaultPath, '.clawvault', 'facts.jsonl');
    const graphPath = path.join(vaultPath, '.clawvault', 'entity-graph.json');

    expect(fs.existsSync(factsPath)).toBe(true);
    expect(fs.existsSync(graphPath)).toBe(true);

    const facts = readFacts(vaultPath);
    expect(facts.length).toBeGreaterThanOrEqual(11);

    const relations = new Set(facts.map((fact) => fact.relation));
    const expectedRelations = [
      'favorite_preference',
      'allergic_to',
      'works_at',
      'lives_in',
      'age',
      'bought',
      'spent',
      'decided',
      'partner_name',
      'dog_name',
      'parent_name'
    ];
    for (const relation of expectedRelations) {
      expect(relations.has(relation)).toBe(true);
    }

    for (const fact of facts) {
      expect(typeof fact.id).toBe('string');
      expect(typeof fact.entity).toBe('string');
      expect(typeof fact.entityNorm).toBe('string');
      expect(typeof fact.relation).toBe('string');
      expect(typeof fact.value).toBe('string');
      expect(typeof fact.validFrom).toBe('string');
      expect('validUntil' in fact).toBe(true);
      expect(typeof fact.confidence).toBe('number');
      expect(typeof fact.category).toBe('string');
      expect(typeof fact.source).toBe('string');
      expect(typeof fact.rawText).toBe('string');
    }

    const graph = JSON.parse(fs.readFileSync(graphPath, 'utf-8'));
    expect(graph.version).toBe(1);
    expect(Array.isArray(graph.nodes)).toBe(true);
    expect(Array.isArray(graph.edges)).toBe(true);
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.edges.length).toBeGreaterThan(0);
  });

  it('supersedes old values for exclusive relations and closes prior facts', async () => {
    const handler = await loadHandler();
    const vaultPath = makeVault();

    await handler({
      type: 'compaction',
      action: 'memoryFlush',
      pluginConfig: {
        vaultPath,
        allowClawvaultExec: true,
        enableFactExtraction: true,
        enableCompactionObservation: true
      },
      context: {
        messages: [{ role: 'user', content: 'I live in Lisbon. I prefer tea.' }]
      }
    });

    await handler({
      type: 'command',
      action: 'new',
      sessionKey: 'agent:main:session-2',
      pluginConfig: {
        vaultPath,
        allowClawvaultExec: true,
        enableFactExtraction: true,
        enableAutoCheckpoint: true,
        enableObserveOnNew: true
      },
      context: {
        commandSource: 'cli',
        messages: [{ role: 'user', content: 'I live in Porto. I prefer coffee.' }]
      }
    });

    const facts = readFacts(vaultPath);
    const livesIn = facts.filter((fact) => fact.entityNorm === 'user' && fact.relation === 'lives_in');
    expect(livesIn.length).toBe(2);

    const lisbon = livesIn.find((fact) => fact.value.toLowerCase() === 'lisbon');
    const porto = livesIn.find((fact) => fact.value.toLowerCase() === 'porto');
    expect(lisbon?.validUntil).toBeTruthy();
    expect(porto?.validUntil).toBeNull();

    const favorites = facts.filter((fact) => fact.entityNorm === 'user' && fact.relation === 'favorite_preference');
    expect(favorites.length).toBe(2);
    const tea = favorites.find((fact) => fact.value.toLowerCase() === 'tea');
    const coffee = favorites.find((fact) => fact.value.toLowerCase() === 'coffee');
    expect(tea?.validUntil).toBeTruthy();
    expect(coffee?.validUntil).toBeNull();

    const graphPath = path.join(vaultPath, '.clawvault', 'entity-graph.json');
    const graph = JSON.parse(fs.readFileSync(graphPath, 'utf-8'));
    const closedLivesInEdge = graph.edges.find((edge) => edge.relation === 'lives_in' && edge.validUntil);
    const activeLivesInEdge = graph.edges.find((edge) => edge.relation === 'lives_in' && edge.validUntil === null);
    expect(closedLivesInEdge).toBeTruthy();
    expect(activeLivesInEdge).toBeTruthy();
  });
});
