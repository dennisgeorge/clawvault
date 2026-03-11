import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const { execFileSyncMock, resolveExecutablePathMock, verifyExecutableIntegrityMock, sanitizeExecArgsMock } = vi.hoisted(() => ({
  execFileSyncMock: vi.fn(),
  resolveExecutablePathMock: vi.fn(),
  verifyExecutableIntegrityMock: vi.fn(),
  sanitizeExecArgsMock: vi.fn()
}));

vi.mock('child_process', () => ({
  execFileSync: execFileSyncMock
}));

vi.mock('./integrity.js', () => ({
  resolveExecutablePath: resolveExecutablePathMock,
  verifyExecutableIntegrity: verifyExecutableIntegrityMock,
  sanitizeExecArgs: sanitizeExecArgsMock
}));

function makeVaultFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'clawvault-hook-'));
  fs.writeFileSync(path.join(root, '.clawvault.json'), JSON.stringify({ name: 'test' }), 'utf-8');
  return root;
}

function makeOpenClawSessionFixture(agentId, sessionId, transcriptBytes = 0) {
  const stateRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'clawvault-openclaw-'));
  const sessionsDir = path.join(stateRoot, 'agents', agentId, 'sessions');
  fs.mkdirSync(sessionsDir, { recursive: true });
  fs.writeFileSync(
    path.join(sessionsDir, 'sessions.json'),
    JSON.stringify({
      [`agent:${agentId}:main`]: {
        sessionId,
        updatedAt: Date.now()
      }
    }),
    'utf-8'
  );
  const transcriptPath = path.join(sessionsDir, `${sessionId}.jsonl`);
  const payload = transcriptBytes > 0 ? 'x'.repeat(transcriptBytes) : '';
  fs.writeFileSync(transcriptPath, payload, 'utf-8');
  return { stateRoot, sessionsDir, transcriptPath };
}

async function loadHandler() {
  vi.resetModules();
  const mod = await import('./handler.js');
  return mod.default;
}

afterEach(() => {
  vi.clearAllMocks();
  resolveExecutablePathMock.mockReset();
  verifyExecutableIntegrityMock.mockReset();
  sanitizeExecArgsMock.mockReset();
  delete process.env.CLAWVAULT_PATH;
  delete process.env.OPENCLAW_STATE_DIR;
  delete process.env.OPENCLAW_HOME;
  delete process.env.OPENCLAW_AGENT_ID;
  delete process.env.OPENCLAW_PLUGIN_CLAWVAULT_VAULTPATH;
});

function securePluginConfig(vaultPath, overrides = {}) {
  return {
    vaultPath,
    allowClawvaultExec: true,
    enableStartupRecovery: true,
    enableSessionContextInjection: true,
    enableAutoCheckpoint: true,
    enableObserveOnNew: true,
    enableHeartbeatObservation: true,
    enableCompactionObservation: true,
    enableWeeklyReflection: true,
    enableFactExtraction: true,
    ...overrides
  };
}

function setupIntegrityDefaults() {
  resolveExecutablePathMock.mockReturnValue('/usr/local/bin/clawvault');
  verifyExecutableIntegrityMock.mockReturnValue({ ok: true, actualSha256: 'a'.repeat(64) });
  sanitizeExecArgsMock.mockImplementation((args) => args);
}

describe('clawvault hook handler', () => {
  beforeEach(() => {
    setupIntegrityDefaults();
  });

  it('injects recovery warning on gateway startup when death detected', async () => {
    const vaultPath = makeVaultFixture();

    execFileSyncMock.mockImplementation((_command, args) => {
      if (args[0] === 'recover') {
        return '⚠️ CONTEXT DEATH DETECTED\nWorking on: ship memory graph';
      }
      return '';
    });

    const handler = await loadHandler();
    const event = {
      type: 'gateway',
      action: 'startup',
      pluginConfig: securePluginConfig(vaultPath),
      messages: [{ role: 'user', content: 'hello' }]
    };

    await handler(event);

    expect(execFileSyncMock).toHaveBeenCalledWith(
      '/usr/local/bin/clawvault',
      expect.arrayContaining(['recover', '--clear', '-v', vaultPath]),
      expect.objectContaining({ shell: false })
    );
    const injected = event.messages.find((message) => message.role === 'system');
    expect(injected?.content).toContain('Context death detected');
    expect(injected?.content).toContain('ship memory graph');

    fs.rmSync(vaultPath, { recursive: true, force: true });
  });

  it('does not execute clawvault commands unless allowClawvaultExec is true', async () => {
    const vaultPath = makeVaultFixture();
    const handler = await loadHandler();
    const event = {
      type: 'gateway',
      action: 'startup',
      pluginConfig: securePluginConfig(vaultPath, { allowClawvaultExec: false }),
      messages: []
    };

    await handler(event);
    expect(execFileSyncMock).not.toHaveBeenCalled();
    fs.rmSync(vaultPath, { recursive: true, force: true });
  });

  it('fails closed when configured executable hash does not match', async () => {
    const vaultPath = makeVaultFixture();
    verifyExecutableIntegrityMock.mockReturnValue({ ok: false, actualSha256: 'b'.repeat(64) });
    const handler = await loadHandler();
    await handler({
      type: 'gateway',
      action: 'startup',
      pluginConfig: securePluginConfig(vaultPath, {
        clawvaultBinarySha256: 'a'.repeat(64)
      }),
      messages: []
    });

    expect(execFileSyncMock).not.toHaveBeenCalled();
    fs.rmSync(vaultPath, { recursive: true, force: true });
  });

  it('supports alias event names for command:new', async () => {
    const vaultPath = makeVaultFixture();
    execFileSyncMock.mockReturnValue('');

    const handler = await loadHandler();
    await handler({
      event: 'command:new',
      sessionKey: 'agent:clawdious:main',
      pluginConfig: securePluginConfig(vaultPath),
      context: { commandSource: 'cli' }
    });

    expect(execFileSyncMock).toHaveBeenCalledWith(
      '/usr/local/bin/clawvault',
      expect.arrayContaining(['checkpoint', '--working-on']),
      expect.objectContaining({ shell: false })
    );

    fs.rmSync(vaultPath, { recursive: true, force: true });
  });

  it('injects recap and memory context on session start alias event', async () => {
    const vaultPath = makeVaultFixture();

    execFileSyncMock.mockImplementation((_command, args) => {
      if (args[0] === 'session-recap') {
        return JSON.stringify({
          messages: [
            { role: 'user', text: 'Need a migration plan.' },
            { role: 'assistant', text: 'Suggested phased rollout.' }
          ]
        });
      }
      if (args[0] === 'context') {
        return JSON.stringify({
          context: [
            {
              title: 'Use Postgres',
              age: '1 day ago',
              snippet: 'Selected Postgres for durability.'
            }
          ]
        });
      }
      return '';
    });

    const handler = await loadHandler();
    const event = {
      eventName: 'session:start',
      sessionKey: 'agent:clawdious:main',
      pluginConfig: securePluginConfig(vaultPath),
      context: { initialPrompt: 'Need migration plan' },
      messages: [{ role: 'user', content: 'Need migration plan' }]
    };

    await handler(event);

    const contextCall = execFileSyncMock.mock.calls.find((call) => call[1]?.[0] === 'context');
    expect(contextCall?.[1]).toEqual(expect.arrayContaining(['--profile', 'auto']));

    const injected = event.messages.find((message) => message.role === 'system');
    expect(injected?.content).toContain('Session context restored');
    expect(injected?.content).toContain('Recent conversation');
    expect(injected?.content).toContain('Relevant memories');
    expect(injected?.content).toContain('Use Postgres');

    fs.rmSync(vaultPath, { recursive: true, force: true });
  });

  it('delegates profile selection to context auto mode for urgent prompts', async () => {
    const vaultPath = makeVaultFixture();

    execFileSyncMock.mockImplementation((_command, args) => {
      if (args[0] === 'session-recap') {
        return JSON.stringify({ messages: [] });
      }
      if (args[0] === 'context') {
        return JSON.stringify({ context: [] });
      }
      return '';
    });

    const handler = await loadHandler();
    await handler({
      eventName: 'session:start',
      sessionKey: 'agent:clawdious:main',
      pluginConfig: securePluginConfig(vaultPath),
      context: { initialPrompt: 'URGENT outage: rollback failed in production' },
      messages: [{ role: 'user', content: 'URGENT outage: rollback failed in production' }]
    });

    const contextCall = execFileSyncMock.mock.calls.find((call) => call[1]?.[0] === 'context');
    expect(contextCall?.[1]).toEqual(expect.arrayContaining(['--profile', 'auto']));

    fs.rmSync(vaultPath, { recursive: true, force: true });
  });

  it('triggers active observation on heartbeat when threshold is crossed', async () => {
    const vaultPath = makeVaultFixture();
    const sessionId = 'heartbeat-session-1';
    const openClawFixture = makeOpenClawSessionFixture('main', sessionId, 70 * 1024);
    process.env.OPENCLAW_STATE_DIR = openClawFixture.stateRoot;

    fs.mkdirSync(path.join(vaultPath, '.clawvault'), { recursive: true });
    fs.writeFileSync(
      path.join(vaultPath, '.clawvault', 'observe-cursors.json'),
      JSON.stringify({
        [sessionId]: {
          lastObservedOffset: 0,
          lastObservedAt: '2026-02-14T00:00:00.000Z',
          sessionKey: 'agent:main:main',
          lastFileSize: 0
        }
      }),
      'utf-8'
    );

    execFileSyncMock.mockReturnValue('');

    const handler = await loadHandler();
    await handler({
      type: 'gateway',
      action: 'heartbeat',
      pluginConfig: securePluginConfig(vaultPath, { allowEnvAccess: true })
    });

    expect(execFileSyncMock).toHaveBeenCalledWith(
      '/usr/local/bin/clawvault',
      expect.arrayContaining(['observe', '--cron', '--agent', 'main']),
      expect.objectContaining({ shell: false })
    );

    fs.rmSync(vaultPath, { recursive: true, force: true });
    fs.rmSync(openClawFixture.stateRoot, { recursive: true, force: true });
  });

  it('forces active observation flush on compaction events', async () => {
    const vaultPath = makeVaultFixture();
    execFileSyncMock.mockReturnValue('');

    const handler = await loadHandler();
    await handler({
      eventName: 'compaction:memoryFlush',
      sessionKey: 'agent:clawdious:main',
      pluginConfig: securePluginConfig(vaultPath)
    });

    expect(execFileSyncMock).toHaveBeenCalledWith(
      '/usr/local/bin/clawvault',
      expect.arrayContaining(['observe', '--cron', '--min-new', '1']),
      expect.objectContaining({ shell: false })
    );

    fs.rmSync(vaultPath, { recursive: true, force: true });
  });

  it('runs weekly reflection on cron.weekly at Sunday midnight', async () => {
    const vaultPath = makeVaultFixture();
    execFileSyncMock.mockReturnValue('');

    const handler = await loadHandler();
    await handler({
      eventName: 'cron.weekly',
      timestamp: '2026-02-15T00:00:00.000Z',
      pluginConfig: securePluginConfig(vaultPath)
    });

    expect(execFileSyncMock).toHaveBeenCalledWith(
      '/usr/local/bin/clawvault',
      expect.arrayContaining(['reflect', '-v', vaultPath]),
      expect.objectContaining({ shell: false })
    );

    fs.rmSync(vaultPath, { recursive: true, force: true });
  });

  it('uses vaultPath from plugin config when provided in event', async () => {
    const vaultPath = makeVaultFixture();

    execFileSyncMock.mockImplementation((_command, args) => {
      if (args[0] === 'recover') {
        return 'Clean startup';
      }
      return '';
    });

    const handler = await loadHandler();
    const event = {
      type: 'gateway',
      action: 'startup',
      pluginConfig: securePluginConfig(vaultPath),
      messages: []
    };

    await handler(event);

    expect(execFileSyncMock).toHaveBeenCalledWith(
      '/usr/local/bin/clawvault',
      expect.arrayContaining(['recover', '--clear', '-v', vaultPath]),
      expect.objectContaining({ shell: false })
    );

    fs.rmSync(vaultPath, { recursive: true, force: true });
  });

  it('uses vaultPath from context.pluginConfig when provided', async () => {
    const vaultPath = makeVaultFixture();

    execFileSyncMock.mockImplementation((_command, args) => {
      if (args[0] === 'recover') {
        return 'Clean startup';
      }
      return '';
    });

    const handler = await loadHandler();
    const event = {
      type: 'gateway',
      action: 'startup',
      context: {
        pluginConfig: securePluginConfig(vaultPath)
      },
      messages: []
    };

    await handler(event);

    expect(execFileSyncMock).toHaveBeenCalledWith(
      '/usr/local/bin/clawvault',
      expect.arrayContaining(['recover', '--clear', '-v', vaultPath]),
      expect.objectContaining({ shell: false })
    );

    fs.rmSync(vaultPath, { recursive: true, force: true });
  });

  it('uses vaultPath from OPENCLAW_PLUGIN_CLAWVAULT_VAULTPATH env var', async () => {
    const vaultPath = makeVaultFixture();
    process.env.OPENCLAW_PLUGIN_CLAWVAULT_VAULTPATH = vaultPath;

    execFileSyncMock.mockImplementation((_command, args) => {
      if (args[0] === 'recover') {
        return 'Clean startup';
      }
      return '';
    });

    const handler = await loadHandler();
    const event = {
      type: 'gateway',
      action: 'startup',
      pluginConfig: securePluginConfig(vaultPath, { allowEnvAccess: true }),
      messages: []
    };

    await handler(event);

    expect(execFileSyncMock).toHaveBeenCalledWith(
      '/usr/local/bin/clawvault',
      expect.arrayContaining(['recover', '--clear', '-v', vaultPath]),
      expect.objectContaining({ shell: false })
    );

    delete process.env.OPENCLAW_PLUGIN_CLAWVAULT_VAULTPATH;
    fs.rmSync(vaultPath, { recursive: true, force: true });
  });

  it('uses per-agent vault path from agentVaults config', async () => {
    const agent1Vault = makeVaultFixture();
    const agent2Vault = makeVaultFixture();
    const fallbackVault = makeVaultFixture();

    execFileSyncMock.mockImplementation((_command, args) => {
      if (args[0] === 'recover') {
        return 'Clean startup';
      }
      return '';
    });

    const handler = await loadHandler();
    const event = {
      type: 'gateway',
      action: 'startup',
      sessionKey: 'agent:agent1:main',
      pluginConfig: securePluginConfig(fallbackVault, {
        agentVaults: {
          agent1: agent1Vault,
          agent2: agent2Vault
        }
      }),
      messages: []
    };

    await handler(event);

    expect(execFileSyncMock).toHaveBeenCalledWith(
      '/usr/local/bin/clawvault',
      expect.arrayContaining(['recover', '--clear', '-v', agent1Vault]),
      expect.objectContaining({ shell: false })
    );

    fs.rmSync(agent1Vault, { recursive: true, force: true });
    fs.rmSync(agent2Vault, { recursive: true, force: true });
    fs.rmSync(fallbackVault, { recursive: true, force: true });
  });

  it('falls back to vaultPath when agent not in agentVaults', async () => {
    const agent1Vault = makeVaultFixture();
    const fallbackVault = makeVaultFixture();

    execFileSyncMock.mockImplementation((_command, args) => {
      if (args[0] === 'recover') {
        return 'Clean startup';
      }
      return '';
    });

    const handler = await loadHandler();
    const event = {
      type: 'gateway',
      action: 'startup',
      sessionKey: 'agent:unknown-agent:main',
      pluginConfig: securePluginConfig(fallbackVault, {
        agentVaults: {
          agent1: agent1Vault
        }
      }),
      messages: []
    };

    await handler(event);

    expect(execFileSyncMock).toHaveBeenCalledWith(
      '/usr/local/bin/clawvault',
      expect.arrayContaining(['recover', '--clear', '-v', fallbackVault]),
      expect.objectContaining({ shell: false })
    );

    fs.rmSync(agent1Vault, { recursive: true, force: true });
    fs.rmSync(fallbackVault, { recursive: true, force: true });
  });

  it('uses agentVaults from context.pluginConfig', async () => {
    const agent1Vault = makeVaultFixture();
    const fallbackVault = makeVaultFixture();

    execFileSyncMock.mockImplementation((_command, args) => {
      if (args[0] === 'recover') {
        return 'Clean startup';
      }
      return '';
    });

    const handler = await loadHandler();
    const event = {
      type: 'gateway',
      action: 'startup',
      sessionKey: 'agent:agent1:main',
      context: {
        pluginConfig: securePluginConfig(fallbackVault, {
          agentVaults: {
            agent1: agent1Vault
          }
        })
      },
      messages: []
    };

    await handler(event);

    expect(execFileSyncMock).toHaveBeenCalledWith(
      '/usr/local/bin/clawvault',
      expect.arrayContaining(['recover', '--clear', '-v', agent1Vault]),
      expect.objectContaining({ shell: false })
    );

    fs.rmSync(agent1Vault, { recursive: true, force: true });
    fs.rmSync(fallbackVault, { recursive: true, force: true });
  });

  it('uses OPENCLAW_AGENT_ID env var for agent resolution when session key not available', async () => {
    const agent1Vault = makeVaultFixture();
    const fallbackVault = makeVaultFixture();
    process.env.OPENCLAW_AGENT_ID = 'agent1';

    execFileSyncMock.mockImplementation((_command, args) => {
      if (args[0] === 'recover') {
        return 'Clean startup';
      }
      return '';
    });

    const handler = await loadHandler();
    const event = {
      type: 'gateway',
      action: 'startup',
      pluginConfig: securePluginConfig(fallbackVault, {
        vaultPath: fallbackVault,
        agentVaults: {
          agent1: agent1Vault
        },
        allowEnvAccess: true
      }),
      messages: []
    };

    await handler(event);

    expect(execFileSyncMock).toHaveBeenCalledWith(
      '/usr/local/bin/clawvault',
      expect.arrayContaining(['recover', '--clear', '-v', agent1Vault]),
      expect.objectContaining({ shell: false })
    );

    fs.rmSync(agent1Vault, { recursive: true, force: true });
    fs.rmSync(fallbackVault, { recursive: true, force: true });
  });
});
