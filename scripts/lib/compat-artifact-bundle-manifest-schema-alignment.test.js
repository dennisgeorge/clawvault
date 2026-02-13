import { describe, expect, it } from 'vitest';
import {
  REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_DEFINITIONS,
  REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES
} from './compat-artifact-bundle-contracts.mjs';
import {
  expectManifestDefinitionEntry,
  readSchema
} from './compat-artifact-bundle-schema-alignment-test-utils.js';

describe('compat artifact bundle manifest schema alignment', () => {
  it('keeps manifest schema artifact constraints aligned with canonical definitions', () => {
    const schema = readSchema('compat-artifact-bundle.manifest.schema.json');
    const artifactsSchema = schema?.properties?.artifacts;

    expect(artifactsSchema?.minItems).toBe(REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_DEFINITIONS.length);
    expect(artifactsSchema?.maxItems).toBe(REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_DEFINITIONS.length);
    expect(artifactsSchema?.items?.properties?.artifactName?.enum).toEqual(REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES);

    const allOfEntries = Array.isArray(artifactsSchema?.allOf) ? artifactsSchema.allOf : [];
    const containsEntries = allOfEntries
      .map((entry) => entry?.contains)
      .filter((entry) => entry && typeof entry === 'object');
    expect(containsEntries.length).toBe(REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_DEFINITIONS.length);

    for (const definition of REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_DEFINITIONS) {
      const matchingContains = containsEntries.find(
        (entry) => entry?.properties?.artifactName?.const === definition.artifactName
      );
      expect(matchingContains).toBeDefined();
      expectManifestDefinitionEntry(matchingContains, definition);
    }

    const prefixEntry = allOfEntries.find((entry) => Array.isArray(entry?.prefixItems));
    expect(prefixEntry).toBeDefined();
    expect(prefixEntry?.items).toBe(false);
    expect(prefixEntry?.prefixItems?.length).toBe(REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_DEFINITIONS.length);
    for (const [index, definition] of REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_DEFINITIONS.entries()) {
      expectManifestDefinitionEntry(prefixEntry.prefixItems[index], definition);
    }
  });
});
