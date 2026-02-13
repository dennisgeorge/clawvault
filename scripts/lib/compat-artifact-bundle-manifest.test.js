import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  COMPAT_ARTIFACT_BUNDLE_MANIFEST_SCHEMA_VERSION,
  ensureCompatArtifactBundleManifestShape,
  loadCompatArtifactBundleManifest
} from './compat-artifact-bundle-manifest.mjs';
import {
  REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES
} from './compat-artifact-bundle-contracts.mjs';

function buildRequiredManifestArtifacts() {
  return REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES.map((artifactName) => ({
    artifactName,
    artifactFile: artifactName,
    schemaPath: `schemas/${artifactName}.schema.json`,
    schemaId: `https://clawvault.dev/schemas/${artifactName}.schema.json`,
    versionField: artifactName === 'summary.json' ? 'summarySchemaVersion' : 'outputSchemaVersion'
  }));
}

describe('compat artifact bundle manifest contracts', () => {
  it('loads and validates manifest payloads from disk', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'compat-artifact-manifest-'));
    const manifestPath = path.join(root, 'manifest.json');
    try {
      const manifest = {
        schemaVersion: COMPAT_ARTIFACT_BUNDLE_MANIFEST_SCHEMA_VERSION,
        artifacts: buildRequiredManifestArtifacts()
      };
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
      expect(loadCompatArtifactBundleManifest(manifestPath)).toEqual(manifest);
      expect(() => ensureCompatArtifactBundleManifestShape(manifest)).not.toThrow();

      fs.writeFileSync(manifestPath, '{"schemaVersion":1', 'utf-8');
      expect(() => loadCompatArtifactBundleManifest(manifestPath)).toThrow(
        'Unable to read compat artifact bundle manifest'
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects malformed manifests', () => {
    expect(() => ensureCompatArtifactBundleManifestShape({
      schemaVersion: COMPAT_ARTIFACT_BUNDLE_MANIFEST_SCHEMA_VERSION,
      artifacts: []
    })).toThrow('artifacts');

    expect(() => ensureCompatArtifactBundleManifestShape({
      schemaVersion: COMPAT_ARTIFACT_BUNDLE_MANIFEST_SCHEMA_VERSION,
      artifacts: [
        ...buildRequiredManifestArtifacts(),
        {
          artifactName: 'summary.json',
          artifactFile: 'another-summary.json',
          schemaPath: 'schemas/compat-summary.schema.json',
          schemaId: 'https://clawvault.dev/schemas/compat-summary.schema.json',
          versionField: 'summarySchemaVersion'
        }
      ]
    })).toThrow('duplicate artifactName');

    expect(() => ensureCompatArtifactBundleManifestShape({
      schemaVersion: COMPAT_ARTIFACT_BUNDLE_MANIFEST_SCHEMA_VERSION,
      artifacts: buildRequiredManifestArtifacts().slice(1)
    })).toThrow('missing required artifactName: summary.json');
  });
});
