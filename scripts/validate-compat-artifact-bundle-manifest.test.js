import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import {
  COMPAT_ARTIFACT_BUNDLE_MANIFEST_VALIDATOR_OUTPUT_SCHEMA_VERSION
} from './lib/compat-artifact-bundle-manifest-validator-output.mjs';

const manifestValidatorScript = path.resolve(process.cwd(), 'scripts', 'validate-compat-artifact-bundle-manifest.mjs');

function runManifestValidator(args = []) {
  return spawnSync(
    process.execPath,
    [manifestValidatorScript, ...args],
    {
      cwd: process.cwd(),
      encoding: 'utf-8'
    }
  );
}

function parseJsonLine(stdout) {
  return JSON.parse(stdout.trim());
}

describe('validate-compat-artifact-bundle-manifest script', () => {
  it('validates default manifest successfully', () => {
    const result = runManifestValidator([]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Compatibility artifact bundle manifest validation passed');
  });

  it('supports --json and --out output modes', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'compat-artifact-manifest-validator-'));
    try {
      const outPath = path.join(root, 'manifest-validator-result.json');
      const result = runManifestValidator(['--json', '--out', outPath]);
      expect(result.status).toBe(0);
      const payload = parseJsonLine(result.stdout);
      expect(payload.outputSchemaVersion).toBe(COMPAT_ARTIFACT_BUNDLE_MANIFEST_VALIDATOR_OUTPUT_SCHEMA_VERSION);
      expect(payload.status).toBe('ok');
      expect(payload.artifactCount).toBeGreaterThan(0);
      expect(payload.schemaContracts.length).toBe(payload.artifactCount);
      expect(JSON.parse(fs.readFileSync(outPath, 'utf-8'))).toEqual(payload);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails on manifest schemaId mismatch with structured error output', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'compat-artifact-manifest-validator-'));
    try {
      const manifestPath = path.join(root, 'manifest.json');
      const manifest = JSON.parse(
        fs.readFileSync(path.resolve(process.cwd(), 'schemas', 'compat-artifact-bundle.manifest.json'), 'utf-8')
      );
      manifest.artifacts = manifest.artifacts.map((entry) => (
        entry.artifactName === 'summary.json'
          ? { ...entry, schemaId: 'https://example.dev/not-matching.json' }
          : entry
      ));
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

      const outPath = path.join(root, 'manifest-validator-error.json');
      const result = runManifestValidator(['--manifest', manifestPath, '--json', '--out', outPath]);
      expect(result.status).toBe(1);
      const payload = parseJsonLine(result.stdout);
      expect(payload).toEqual({
        outputSchemaVersion: COMPAT_ARTIFACT_BUNDLE_MANIFEST_VALIDATOR_OUTPUT_SCHEMA_VERSION,
        status: 'error',
        error: 'compat artifact bundle manifest schemaId mismatch for summary.json (manifest=https://example.dev/not-matching.json, actual=https://clawvault.dev/schemas/compat-summary.schema.json)'
      });
      expect(JSON.parse(fs.readFileSync(outPath, 'utf-8'))).toEqual(payload);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('prints usage help and handles parse-option failures', () => {
    const helpResult = runManifestValidator(['--help']);
    expect(helpResult.status).toBe(0);
    expect(helpResult.stdout).toContain('Usage: node scripts/validate-compat-artifact-bundle-manifest.mjs');
    expect(helpResult.stdout).toContain('--manifest <manifest.json>');

    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'compat-artifact-manifest-validator-'));
    try {
      const outPath = path.join(root, 'manifest-validator-parse-error.json');
      const parseErrorResult = runManifestValidator(['--json', '--manifest', '--out', outPath]);
      expect(parseErrorResult.status).toBe(1);
      expect(parseJsonLine(parseErrorResult.stdout)).toEqual({
        outputSchemaVersion: COMPAT_ARTIFACT_BUNDLE_MANIFEST_VALIDATOR_OUTPUT_SCHEMA_VERSION,
        status: 'error',
        error: 'Missing value for --manifest'
      });
      expect(JSON.parse(fs.readFileSync(outPath, 'utf-8'))).toEqual({
        outputSchemaVersion: COMPAT_ARTIFACT_BUNDLE_MANIFEST_VALIDATOR_OUTPUT_SCHEMA_VERSION,
        status: 'error',
        error: 'Missing value for --manifest'
      });
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
