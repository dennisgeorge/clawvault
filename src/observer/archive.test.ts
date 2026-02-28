import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { archiveObservations } from './archive.js';
import { getArchiveObservationPath, getLegacyObservationPath, getObservationPath } from '../lib/ledger.js';

function makeVault(): string {
  const vaultPath = fs.mkdtempSync(path.join(os.tmpdir(), 'clawvault-archive-'));
  fs.writeFileSync(path.join(vaultPath, '.clawvault.json'), JSON.stringify({ name: 'test' }), 'utf-8');
  return vaultPath;
}

describe('archiveObservations', () => {
  it('moves observations older than retention window to archive', () => {
    const vaultPath = makeVault();
    try {
      const oldPath = getObservationPath(vaultPath, '2026-01-10');
      const recentPath = getObservationPath(vaultPath, '2026-02-19');
      fs.mkdirSync(path.dirname(oldPath), { recursive: true });
      fs.mkdirSync(path.dirname(recentPath), { recursive: true });
      fs.writeFileSync(oldPath, '## 2026-01-10\n\n- [fact|c=0.70|i=0.20] old\n', 'utf-8');
      fs.writeFileSync(recentPath, '## 2026-02-19\n\n- [fact|c=0.70|i=0.20] recent\n', 'utf-8');

      const result = archiveObservations(vaultPath, {
        olderThanDays: 14,
        now: () => new Date('2026-02-20T00:00:00.000Z')
      });

      expect(result.archived).toBe(1);
      expect(fs.existsSync(oldPath)).toBe(false);
      expect(fs.existsSync(getArchiveObservationPath(vaultPath, '2026-01-10'))).toBe(true);
      expect(fs.existsSync(recentPath)).toBe(true);
    } finally {
      fs.rmSync(vaultPath, { recursive: true, force: true });
    }
  });

  it('supports dry run', () => {
    const vaultPath = makeVault();
    try {
      const oldPath = getObservationPath(vaultPath, '2026-01-10');
      fs.mkdirSync(path.dirname(oldPath), { recursive: true });
      fs.writeFileSync(oldPath, '## 2026-01-10\n\n- [fact|c=0.70|i=0.20] old\n', 'utf-8');

      const result = archiveObservations(vaultPath, {
        olderThanDays: 14,
        dryRun: true,
        now: () => new Date('2026-02-20T00:00:00.000Z')
      });

      expect(result.archived).toBe(1);
      expect(fs.existsSync(oldPath)).toBe(true);
    } finally {
      fs.rmSync(vaultPath, { recursive: true, force: true });
    }
  });

  it('clamps retention to at least one day', () => {
    const vaultPath = makeVault();
    try {
      const olderPath = getObservationPath(vaultPath, '2026-02-18');
      const boundaryPath = getObservationPath(vaultPath, '2026-02-19');
      fs.mkdirSync(path.dirname(olderPath), { recursive: true });
      fs.writeFileSync(olderPath, '## 2026-02-18\n\n- [fact|c=0.70|i=0.20] older\n', 'utf-8');
      fs.writeFileSync(boundaryPath, '## 2026-02-19\n\n- [fact|c=0.70|i=0.20] boundary\n', 'utf-8');

      const result = archiveObservations(vaultPath, {
        olderThanDays: 0,
        now: () => new Date('2026-02-20T00:00:00.000Z')
      });

      expect(result.archived).toBe(1);
      expect(result.archivedDates).toEqual(['2026-02-18']);
      expect(fs.existsSync(olderPath)).toBe(false);
      expect(fs.existsSync(getArchiveObservationPath(vaultPath, '2026-02-18'))).toBe(true);
      expect(fs.existsSync(boundaryPath)).toBe(true);
    } finally {
      fs.rmSync(vaultPath, { recursive: true, force: true });
    }
  });

  it('archives legacy observation files when ledger files are absent', () => {
    const vaultPath = makeVault();
    try {
      const legacyPath = getLegacyObservationPath(vaultPath, '2026-01-01');
      fs.mkdirSync(path.dirname(legacyPath), { recursive: true });
      fs.writeFileSync(legacyPath, '## 2026-01-01\n\n- [fact|c=0.70|i=0.20] legacy\n', 'utf-8');

      const result = archiveObservations(vaultPath, {
        olderThanDays: 14,
        now: () => new Date('2026-02-20T00:00:00.000Z')
      });

      expect(result.archived).toBe(1);
      expect(result.archivedDates).toEqual(['2026-01-01']);
      expect(fs.existsSync(legacyPath)).toBe(false);
      expect(fs.existsSync(getArchiveObservationPath(vaultPath, '2026-01-01'))).toBe(true);
    } finally {
      fs.rmSync(vaultPath, { recursive: true, force: true });
    }
  });

  it('keeps files whose date is exactly at the cutoff', () => {
    const vaultPath = makeVault();
    try {
      const cutoffPath = getObservationPath(vaultPath, '2026-02-06');
      const olderPath = getObservationPath(vaultPath, '2026-02-05');
      fs.mkdirSync(path.dirname(cutoffPath), { recursive: true });
      fs.writeFileSync(cutoffPath, '## 2026-02-06\n\n- [fact|c=0.70|i=0.20] cutoff\n', 'utf-8');
      fs.writeFileSync(olderPath, '## 2026-02-05\n\n- [fact|c=0.70|i=0.20] older\n', 'utf-8');

      const result = archiveObservations(vaultPath, {
        olderThanDays: 14,
        now: () => new Date('2026-02-20T00:00:00.000Z')
      });

      expect(result.archived).toBe(1);
      expect(result.archivedDates).toEqual(['2026-02-05']);
      expect(fs.existsSync(cutoffPath)).toBe(true);
      expect(fs.existsSync(olderPath)).toBe(false);
    } finally {
      fs.rmSync(vaultPath, { recursive: true, force: true });
    }
  });
});
