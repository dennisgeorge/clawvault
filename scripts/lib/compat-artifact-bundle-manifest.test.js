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
  REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_DEFINITIONS,
  REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES
} from './compat-artifact-bundle-contracts.mjs';

function buildRequiredManifestArtifacts() {
  return REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_DEFINITIONS.map((definition) => ({
    artifactName: definition.artifactName,
    artifactFile: definition.artifactFile,
    schemaPath: definition.schemaPath,
    schemaId: definition.schemaId,
    versionField: definition.versionField
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

    const reorderedArtifacts = buildRequiredManifestArtifacts();
    [reorderedArtifacts[0], reorderedArtifacts[1]] = [reorderedArtifacts[1], reorderedArtifacts[0]];
    expect(() => ensureCompatArtifactBundleManifestShape({
      schemaVersion: COMPAT_ARTIFACT_BUNDLE_MANIFEST_SCHEMA_VERSION,
      artifacts: reorderedArtifacts
    })).toThrow('must follow required canonical artifactName order');

    const versionFieldDriftArtifacts = buildRequiredManifestArtifacts().map((entry) => (
      entry.artifactName === 'summary.json'
        ? { ...entry, versionField: 'outputSchemaVersion' }
        : entry
    ));
    expect(() => ensureCompatArtifactBundleManifestShape({
      schemaVersion: COMPAT_ARTIFACT_BUNDLE_MANIFEST_SCHEMA_VERSION,
      artifacts: versionFieldDriftArtifacts
    })).toThrow('required artifact summary.json must use versionField=summarySchemaVersion');

    const artifactFileDriftArtifacts = buildRequiredManifestArtifacts().map((entry) => (
      entry.artifactName === 'summary.json'
        ? { ...entry, artifactFile: 'summary-v2.json' }
        : entry
    ));
    expect(() => ensureCompatArtifactBundleManifestShape({
      schemaVersion: COMPAT_ARTIFACT_BUNDLE_MANIFEST_SCHEMA_VERSION,
      artifacts: artifactFileDriftArtifacts
    })).toThrow('required artifact summary.json must use artifactFile=summary.json');

    const schemaPathDriftArtifacts = buildRequiredManifestArtifacts().map((entry) => (
      entry.artifactName === 'summary.json'
        ? { ...entry, schemaPath: 'schemas/drifted-summary.schema.json' }
        : entry
    ));
    expect(() => ensureCompatArtifactBundleManifestShape({
      schemaVersion: COMPAT_ARTIFACT_BUNDLE_MANIFEST_SCHEMA_VERSION,
      artifacts: schemaPathDriftArtifacts
    })).toThrow('required artifact summary.json must use schemaPath=schemas/compat-summary.schema.json');

    const schemaIdDriftArtifacts = buildRequiredManifestArtifacts().map((entry) => (
      entry.artifactName === 'summary.json'
        ? { ...entry, schemaId: 'https://example.dev/drifted-summary.schema.json' }
        : entry
    ));
    expect(() => ensureCompatArtifactBundleManifestShape({
      schemaVersion: COMPAT_ARTIFACT_BUNDLE_MANIFEST_SCHEMA_VERSION,
      artifacts: schemaIdDriftArtifacts
    })).toThrow('required artifact summary.json must use schemaId=https://clawvault.dev/schemas/compat-summary.schema.json');

    expect(() => ensureCompatArtifactBundleManifestShape({
      schemaVersion: COMPAT_ARTIFACT_BUNDLE_MANIFEST_SCHEMA_VERSION,
      artifacts: [
        ...buildRequiredManifestArtifacts(),
        {
          artifactName: 'extra-artifact.json',
          artifactFile: 'extra-artifact.json',
          schemaPath: 'schemas/extra.schema.json',
          schemaId: 'https://clawvault.dev/schemas/extra.schema.json',
          versionField: 'outputSchemaVersion'
        }
      ]
    })).toThrow('unsupported artifactName: extra-artifact.json');
  });
});
