import { describe, expect, it } from 'vitest';
import { Reflector } from './reflector.js';

describe('Reflector', () => {
  it('returns trimmed input when no dated sections are present', () => {
    const reflector = new Reflector();
    const result = reflector.reflect('  plain notes without headings  \n');
    expect(result).toBe('plain notes without headings');
  });

  it('removes stale green lines while keeping stale yellow and red priorities', () => {
    const reflector = new Reflector({
      now: () => new Date('2026-02-20T00:00:00.000Z')
    });

    const input = [
      '## 2026-02-10',
      '',
      '🟢 Legacy low-signal note',
      '🟡 Legacy operational context',
      '🔴 Legacy unresolved outage',
      '',
      '## 2026-02-19',
      '',
      '🟢 Fresh low-signal note'
    ].join('\n');

    const output = reflector.reflect(input);
    expect(output).not.toContain('Legacy low-signal note');
    expect(output).toContain('🟡 Legacy operational context');
    expect(output).toContain('🔴 Legacy unresolved outage');
    expect(output).toContain('🟢 Fresh low-signal note');
  });

  it('deduplicates similar non-red lines and keeps the newest instance', () => {
    const reflector = new Reflector({
      now: () => new Date('2026-02-20T00:00:00.000Z')
    });

    const input = [
      '## 2026-02-20',
      '',
      '🟡 Team aligned on PostgreSQL migration strategy',
      '',
      '## 2026-02-19',
      '',
      '🟡 Team aligned on PostgreSQL migration strategy!!!',
      '🟢 Keep smoke test checklist updated'
    ].join('\n');

    const output = reflector.reflect(input);
    expect((output.match(/Team aligned on PostgreSQL migration strategy/g) ?? [])).toHaveLength(1);
    expect(output).toContain('🟢 Keep smoke test checklist updated');
  });

  it('keeps duplicate red observations across sections', () => {
    const reflector = new Reflector({
      now: () => new Date('2026-02-20T00:00:00.000Z')
    });

    const input = [
      '## 2026-02-20',
      '',
      '🔴 Critical blocker: migration rollback still broken',
      '',
      '## 2026-02-19',
      '',
      '🔴 Critical blocker: migration rollback still broken'
    ].join('\n');

    const output = reflector.reflect(input);
    expect((output.match(/Critical blocker: migration rollback still broken/g) ?? [])).toHaveLength(2);
  });

  it('treats invalid date headings as non-expiring for green lines', () => {
    const reflector = new Reflector({
      now: () => new Date('2026-02-20T00:00:00.000Z')
    });

    const input = [
      '## 2026-99-99',
      '',
      '🟢 Keep ambiguous-date reminder',
      '',
      '## 2026-02-10',
      '',
      '🟢 Drop old green line'
    ].join('\n');

    const output = reflector.reflect(input);
    expect(output).toContain('🟢 Keep ambiguous-date reminder');
    expect(output).not.toContain('🟢 Drop old green line');
  });
});
