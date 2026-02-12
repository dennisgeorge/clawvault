import { afterEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Observer, type ObserverCompressor } from './observer.js';

function makeTempVault(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'clawvault-observer-'));
  fs.writeFileSync(path.join(root, '.clawvault.json'), JSON.stringify({ name: 'test' }));
  return root;
}

function withFixedNow(isoTimestamp: string): () => Date {
  return () => new Date(isoTimestamp);
}

const originalAnthropic = process.env.ANTHROPIC_API_KEY;
const originalOpenAI = process.env.OPENAI_API_KEY;

afterEach(() => {
  process.env.ANTHROPIC_API_KEY = originalAnthropic;
  process.env.OPENAI_API_KEY = originalOpenAI;
  vi.restoreAllMocks();
});

describe('Observer', () => {
  it('accumulates messages until threshold is reached', async () => {
    const vaultPath = makeTempVault();
    const now = withFixedNow('2026-02-11T14:30:00.000Z');
    const compressSpy = vi.fn(async (_messages: string[], _existingObservations: string) => (
      '## 2026-02-11\n\n🟢 14:30 buffered'
    ));
    const compressor: ObserverCompressor = {
      compress: (messages, existingObservations) => compressSpy(messages, existingObservations)
    };

    try {
      const observer = new Observer(vaultPath, {
        tokenThreshold: 6,
        reflectThreshold: 99999,
        now,
        compressor,
        reflector: { reflect: (value: string) => value }
      });

      await observer.processMessages(['short']);
      expect(compressSpy).not.toHaveBeenCalled();
      expect(observer.getObservations()).toBe('');

      await observer.processMessages(['this message pushes the token estimator over threshold']);
      expect(compressSpy).toHaveBeenCalledTimes(1);
      expect(compressSpy).toHaveBeenCalledWith(
        ['short', 'this message pushes the token estimator over threshold'],
        ''
      );
    } finally {
      fs.rmSync(vaultPath, { recursive: true, force: true });
    }
  });

  it('writes compressed observations to daily markdown file', async () => {
    const vaultPath = makeTempVault();
    const now = withFixedNow('2026-02-11T09:05:00.000Z');

    try {
      const observer = new Observer(vaultPath, {
        tokenThreshold: 1,
        reflectThreshold: 99999,
        now,
        compressor: {
          compress: async () => '## 2026-02-11\n\n🔴 09:05 User chose PostgreSQL for reliability'
        },
        reflector: { reflect: (value: string) => value }
      });

      await observer.processMessages(['decision recorded']);
      const output = observer.getObservations();
      expect(output).toContain('## 2026-02-11');
      expect(output).toContain('🔴 09:05 User chose PostgreSQL for reliability');

      const expectedPath = path.join(vaultPath, 'observations', '2026-02-11.md');
      expect(fs.existsSync(expectedPath)).toBe(true);
      const fileContent = fs.readFileSync(expectedPath, 'utf-8');
      expect(fileContent).toContain('🔴 09:05 User chose PostgreSQL for reliability');
    } finally {
      fs.rmSync(vaultPath, { recursive: true, force: true });
    }
  });

  it('produces emoji-priority observation format with fallback compression', async () => {
    const vaultPath = makeTempVault();
    process.env.ANTHROPIC_API_KEY = '';
    process.env.OPENAI_API_KEY = '';
    const now = withFixedNow('2026-02-11T14:10:00.000Z');

    try {
      const observer = new Observer(vaultPath, {
        tokenThreshold: 1,
        reflectThreshold: 99999,
        now
      });

      await observer.processMessages([
        '2026-02-11 14:10 User decided to use PostgreSQL for scaling reasons',
        '2026-02-11 14:12 Encountered error while running migration'
      ]);

      const observations = observer.getObservations();
      expect(observations).toContain('## 2026-02-11');
      expect(observations).toMatch(/🔴.*(?:decided|chose|PostgreSQL)/i);
      expect(observations).toMatch(/🔴.*(?:error|fail|crash|bug)/i);
    } finally {
      fs.rmSync(vaultPath, { recursive: true, force: true });
    }
  });
});
