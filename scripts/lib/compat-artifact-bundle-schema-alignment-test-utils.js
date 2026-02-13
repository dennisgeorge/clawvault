import { expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

export function readSchema(fileName) {
  const schemaPath = path.resolve(process.cwd(), 'schemas', fileName);
  return JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
}

export function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function expectManifestDefinitionEntry(entry, definition) {
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

export function expectResolvedSchemaContractEntry(entry, definition, { includeArtifactFile }) {
  expect(entry?.properties?.artifactName?.const).toBe(definition.artifactName);
  if (includeArtifactFile) {
    expect(entry?.properties?.artifactFile?.const).toBe(definition.artifactFile);
  }
  expect(entry?.properties?.schemaPath?.pattern).toBe(`${escapeRegex(definition.schemaPath)}$`);
  expect(entry?.properties?.schemaId?.const).toBe(definition.schemaId);
  expect(entry?.properties?.versionField?.const).toBe(definition.versionField);
  expect(entry?.required).toEqual(
    includeArtifactFile
      ? ['artifactName', 'artifactFile', 'schemaPath', 'schemaId', 'versionField']
      : ['artifactName', 'schemaPath', 'schemaId', 'versionField']
  );
}

export function expectConstPrefixItems(prefixItems, expectedValues) {
  expect(prefixItems.map((entry) => entry?.const)).toEqual(expectedValues);
}
