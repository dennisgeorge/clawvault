import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_DEFINITIONS,
  REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES
} from './compat-artifact-bundle-contracts.mjs';

function loadManifestSchema() {
  const schemaPath = path.resolve(process.cwd(), 'schemas', 'compat-artifact-bundle.manifest.schema.json');
  return JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
}

function expectSchemaEntryToMatchDefinition(entry, definition) {
  expect(entry?.properties?.artifactName?.const).toBe(definition.artifactName);
  expect(entry?.properties?.artifactFile?.const).toBe(definition.artifactFile);
  expect(entry?.properties?.schemaPath?.const).toBe(definition.schemaPath);
  expect(entry?.properties?.schemaId?.const).toBe(definition.schemaId);
  expect(entry?.properties?.versionField?.const).toBe(definition.versionField);
  expect(entry?.required).toEqual([
    'artifactName',
    'artifactFile',
    'schemaPath',
    'schemaId',
    'versionField'
  ]);
}

describe('compat artifact bundle manifest schema alignment', () => {
  it('keeps manifest schema artifact constraints aligned with canonical definitions', () => {
    const schema = loadManifestSchema();
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
      expectSchemaEntryToMatchDefinition(matchingContains, definition);
    }

    const prefixEntry = allOfEntries.find((entry) => Array.isArray(entry?.prefixItems));
    expect(prefixEntry).toBeDefined();
    expect(prefixEntry?.items).toBe(false);
    expect(prefixEntry?.prefixItems?.length).toBe(REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_DEFINITIONS.length);
    for (const [index, definition] of REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_DEFINITIONS.entries()) {
      expectSchemaEntryToMatchDefinition(prefixEntry.prefixItems[index], definition);
    }
  });
});
