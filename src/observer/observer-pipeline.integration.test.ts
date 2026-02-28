import { describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parseSessionFile } from './session-parser.js';
import { Observer, type ObserverCompressor } from './observer.js';
import { Reflector } from './reflector.js';
import { getObservationPath } from '../lib/ledger.js';

function makeVault(config: Record<string, unknown> = {}): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'clawvault-observer-integration-'));
  fs.writeFileSync(
    path.join(root, '.clawvault.json'),
    JSON.stringify({
      name: 'test',
      observer: {
        factExtractionMode: 'off'
      },
      ...config
    }),
    'utf-8'
  );
  return root;
}

describe('observer integration pipeline', () => {
  it('runs transcript parse → compress → route → store end-to-end', async () => {
    const vaultPath = makeVault();
    const transcriptPath = path.join(vaultPath, 'session.md');
    fs.writeFileSync(
      transcriptPath,
      [
        'user: Need a durable storage choice for the migration.',
        '',
        'assistant: We decided to use PostgreSQL for durable storage.',
        '',
        'user: TODO: add smoke tests before deploy.',
        '',
        'assistant: talked to Pedro about rollout timeline.'
      ].join('\n'),
      'utf-8'
    );

    const parsedMessages = parseSessionFile(transcriptPath);
    expect(parsedMessages).toEqual([
      'user: Need a durable storage choice for the migration.',
      'assistant: We decided to use PostgreSQL for durable storage.',
      'user: TODO: add smoke tests before deploy.',
      'assistant: talked to Pedro about rollout timeline.'
    ]);

    const compressSpy = vi.fn(async (_messages: string[], _existing: string) => ([
      '## 2026-02-12',
      '',
      '- [decision|c=0.93|i=0.92] 10:00 [main] decided to use PostgreSQL for durable storage',
      '- [todo|c=0.85|i=0.66] 10:02 [main] TODO: add smoke tests before deploy',
      '- [relationship|c=0.82|i=0.70] 10:03 [main] talked to Pedro about rollout timeline'
    ].join('\n')));
    const compressor: ObserverCompressor = {
      compress: (messages, existing) => compressSpy(messages, existing)
    };

    try {
      const observer = new Observer(vaultPath, {
        tokenThreshold: 1,
        reflectThreshold: 99999,
        now: () => new Date('2026-02-12T10:03:00.000Z'),
        compressor,
        reflector: { reflect: (value: string) => value }
      });

      await observer.processMessages(parsedMessages, {
        source: 'openclaw',
        sessionKey: 'agent:clawdious:main',
        transcriptId: 'session-e2e-001',
        timestamp: new Date('2026-02-12T10:03:00.000Z')
      });
      const flushResult = await observer.flush();

      expect(compressSpy).toHaveBeenCalledTimes(1);
      expect(flushResult.routingSummary).toContain('decisions: 1');
      expect(flushResult.routingSummary).toContain('backlog: 1');
      expect(flushResult.routingSummary).toContain('people: 1');

      const observationPath = getObservationPath(vaultPath, '2026-02-12');
      expect(fs.existsSync(observationPath)).toBe(true);
      expect(fs.readFileSync(observationPath, 'utf-8')).toContain(
        '[decision|c=0.93|i=0.92] 10:00 [main] decided to use PostgreSQL for durable storage'
      );

      const decisionsPath = path.join(vaultPath, 'decisions', '2026-02-12.md');
      expect(fs.existsSync(decisionsPath)).toBe(true);
      expect(fs.readFileSync(decisionsPath, 'utf-8')).toContain('decided to use PostgreSQL for durable storage');

      const peoplePath = path.join(vaultPath, 'people', 'pedro', '2026-02-12.md');
      expect(fs.existsSync(peoplePath)).toBe(true);
      expect(fs.readFileSync(peoplePath, 'utf-8')).toContain('talked to [[Pedro]]');

      const backlogDir = path.join(vaultPath, 'backlog');
      const backlogFiles = fs.readdirSync(backlogDir).filter((name) => name.endsWith('.md'));
      expect(backlogFiles.length).toBe(1);
      const backlogContent = fs.readFileSync(path.join(backlogDir, backlogFiles[0]), 'utf-8');
      expect(backlogContent).toContain('source: observer');
      expect(backlogContent).toContain('Transcript: session-e2e-001');
    } finally {
      fs.rmSync(vaultPath, { recursive: true, force: true });
    }
  });

  it('enforces priority rules (🔴/🟡/🟢) with edge cases during reflection', () => {
    const reflector = new Reflector({
      now: () => new Date('2026-02-20T00:00:00.000Z')
    });

    const reflected = reflector.reflect([
      '## 2026-02-20',
      '',
      '🟡 Keep rollback checklist updated',
      '🟢 Fresh low-signal note',
      '',
      '## 2026-02-10',
      '',
      '🟢 Fresh low-signal note',
      '🟡 Keep rollback checklist updated',
      '🔴 Critical blocker: deploy rollback still broken',
      '🔴 Critical blocker: deploy rollback still broken'
    ].join('\n'));

    expect((reflected.match(/Keep rollback checklist updated/g) ?? [])).toHaveLength(1);
    expect(reflected).toContain('🟢 Fresh low-signal note');
    expect((reflected.match(/Critical blocker: deploy rollback still broken/g) ?? [])).toHaveLength(2);
  });

  it('routes categories to custom people paths, known project folders, and defaults', async () => {
    const vaultPath = makeVault({
      routes: [
        {
          pattern: 'Pedro',
          target: 'people/high-touch/pedro',
          priority: 100
        }
      ]
    });
    fs.mkdirSync(path.join(vaultPath, 'projects'), { recursive: true });
    fs.writeFileSync(
      path.join(vaultPath, 'projects', 'apollo.md'),
      [
        '---',
        'type: project',
        'status: active',
        'created: 2026-02-01T00:00:00.000Z',
        'updated: 2026-02-01T00:00:00.000Z',
        '---',
        '',
        '# Apollo',
        ''
      ].join('\n'),
      'utf-8'
    );

    const compressor: ObserverCompressor = {
      compress: async () => ([
        '## 2026-02-13',
        '',
        '- [relationship|c=0.82|i=0.70] 11:00 talked to Pedro about enterprise renewal',
        '- [project|c=0.90|i=0.84] 11:10 shipped [[apollo]] release candidate',
        '- [lesson|c=0.78|i=0.64] 11:20 learned to document rollback steps'
      ].join('\n'))
    };

    try {
      const observer = new Observer(vaultPath, {
        tokenThreshold: 1,
        reflectThreshold: 99999,
        now: () => new Date('2026-02-13T11:20:00.000Z'),
        compressor,
        reflector: { reflect: (value: string) => value }
      });

      await observer.processMessages(['trigger compression']);
      const flushResult = await observer.flush();

      expect(flushResult.routingSummary).toContain('people: 1');
      expect(flushResult.routingSummary).toContain('projects: 1');
      expect(flushResult.routingSummary).toContain('lessons: 1');

      const customPeoplePath = path.join(vaultPath, 'people', 'high-touch', 'pedro', '2026-02-13.md');
      expect(fs.existsSync(customPeoplePath)).toBe(true);

      const projectPath = path.join(vaultPath, 'projects', 'apollo', '2026-02-13.md');
      expect(fs.existsSync(projectPath)).toBe(true);
      expect(fs.existsSync(path.join(vaultPath, 'projects', '2026-02-13.md'))).toBe(false);

      const lessonsPath = path.join(vaultPath, 'lessons', '2026-02-13.md');
      expect(fs.existsSync(lessonsPath)).toBe(true);
    } finally {
      fs.rmSync(vaultPath, { recursive: true, force: true });
    }
  });
});
