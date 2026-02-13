import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_DEFINITIONS,
  REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES
} from './compat-artifact-bundle-contracts.mjs';

function loadManifest() {
  const manifestPath = path.resolve(process.cwd(), 'schemas', 'compat-artifact-bundle.manifest.json');
  return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
}

describe('compat artifact bundle manifest file alignment', () => {
  it('keeps manifest artifacts fully aligned with canonical artifact definitions', () => {
    const manifest = loadManifest();
    expect(manifest.schemaVersion).toBe(1);
    expect(Array.isArray(manifest.artifacts)).toBe(true);
    expect(manifest.artifacts.length).toBe(REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_DEFINITIONS.length);

    expect(manifest.artifacts.map((entry) => entry.artifactName)).toEqual(REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES);
    for (const [index, definition] of REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_DEFINITIONS.entries()) {
      expect(manifest.artifacts[index]).toEqual({
        artifactName: definition.artifactName,
        artifactFile: definition.artifactFile,
        schemaPath: definition.schemaPath,
        schemaId: definition.schemaId,
        versionField: definition.versionField
      });
    }
  });
});
