import { describe, expect, it } from 'vitest';
import {
  REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_COUNT,
  REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_DEFINITIONS,
  REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES
} from './compat-artifact-bundle-contracts.mjs';
import {
  expectConstPrefixItems,
  expectResolvedSchemaContractEntry,
  readSchema
} from './compat-artifact-bundle-schema-alignment-test-utils.js';

describe('compat artifact bundle output schema alignment', () => {
  it('keeps bundle-validator output schema aligned with canonical artifact definitions', () => {
    const schema = readSchema('compat-artifact-bundle-validator-output.schema.json');
    const artifactContracts = schema?.properties?.artifactContracts;
    const verifiedArtifacts = schema?.properties?.verifiedArtifacts;

    expect(artifactContracts?.minItems).toBe(REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_COUNT);
    expect(artifactContracts?.maxItems).toBe(REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_COUNT);
    expect(artifactContracts?.items?.properties?.artifactName?.enum).toEqual(REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES);
    expect(verifiedArtifacts?.items?.enum).toEqual(REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES);

    const prefixItems = artifactContracts?.allOf?.[0]?.prefixItems;
    expect(Array.isArray(prefixItems)).toBe(true);
    expect(prefixItems.length).toBe(REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_COUNT);
    for (const [index, definition] of REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_DEFINITIONS.entries()) {
      expectResolvedSchemaContractEntry(prefixItems[index], definition, { includeArtifactFile: false });
    }
    expect(artifactContracts?.allOf?.[0]?.items).toBe(false);

    const verifiedPrefixItems = verifiedArtifacts?.allOf?.[0]?.prefixItems ?? [];
    expectConstPrefixItems(verifiedPrefixItems, REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES);
    expect(verifiedArtifacts?.allOf?.[0]?.items).toBe(false);

    const okBranch = schema?.allOf?.find((entry) => entry?.if?.properties?.status?.const === 'ok')?.then;
    for (const definition of REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_DEFINITIONS) {
      expect(
        okBranch?.allOf?.some((entry) => entry?.properties?.verifiedArtifacts?.contains?.const === definition.artifactName)
      ).toBe(true);
      expect(
        okBranch?.allOf?.some((entry) => (
          entry?.properties?.artifactContracts?.contains?.properties?.artifactName?.const === definition.artifactName
          && entry?.properties?.artifactContracts?.contains?.properties?.schemaId?.const === definition.schemaId
          && entry?.properties?.artifactContracts?.contains?.properties?.versionField?.const === definition.versionField
        ))
      ).toBe(true);
    }
  });

  it('keeps manifest-validator output schema aligned with canonical artifact definitions', () => {
    const schema = readSchema('compat-artifact-bundle-manifest-validator-output.schema.json');
    const artifacts = schema?.properties?.artifacts;
    const schemaContracts = schema?.properties?.schemaContracts;

    expect(schema?.properties?.artifactCount?.const).toBe(REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_COUNT);
    expect(artifacts?.minItems).toBe(REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_COUNT);
    expect(artifacts?.maxItems).toBe(REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_COUNT);
    expect(artifacts?.items?.enum).toEqual(REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES);
    expect(schemaContracts?.items?.properties?.artifactName?.enum).toEqual(REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES);

    const artifactPrefixItems = artifacts?.allOf?.[0]?.prefixItems ?? [];
    expectConstPrefixItems(artifactPrefixItems, REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES);
    expect(artifacts?.allOf?.[0]?.items).toBe(false);

    const schemaContractPrefixItems = schemaContracts?.allOf?.[0]?.prefixItems;
    expect(Array.isArray(schemaContractPrefixItems)).toBe(true);
    expect(schemaContractPrefixItems.length).toBe(REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_COUNT);
    for (const [index, definition] of REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_DEFINITIONS.entries()) {
      expectResolvedSchemaContractEntry(schemaContractPrefixItems[index], definition, { includeArtifactFile: true });
    }
    expect(schemaContracts?.allOf?.[0]?.items).toBe(false);

    const okBranch = schema?.allOf?.find((entry) => entry?.if?.properties?.status?.const === 'ok')?.then;
    for (const definition of REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_DEFINITIONS) {
      expect(
        okBranch?.allOf?.some((entry) => entry?.properties?.artifacts?.contains?.const === definition.artifactName)
      ).toBe(true);
      expect(
        okBranch?.allOf?.some((entry) => (
          entry?.properties?.schemaContracts?.contains?.properties?.artifactName?.const === definition.artifactName
          && entry?.properties?.schemaContracts?.contains?.properties?.artifactFile?.const === definition.artifactFile
          && entry?.properties?.schemaContracts?.contains?.properties?.schemaId?.const === definition.schemaId
          && entry?.properties?.schemaContracts?.contains?.properties?.versionField?.const === definition.versionField
        ))
      ).toBe(true);
    }
  });
});
