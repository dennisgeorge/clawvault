import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  COMPAT_SUMMARY_VALIDATOR_OUTPUT_SCHEMA_VERSION
} from './compat-summary-validator-output.mjs';
import {
  COMPAT_VALIDATOR_RESULT_VERIFIER_OUTPUT_SCHEMA_VERSION
} from './compat-validator-result-verifier-output.mjs';
import {
  JSON_SCHEMA_VALIDATOR_OUTPUT_SCHEMA_VERSION
} from './json-schema-validator-output.mjs';
import {
  COMPAT_FIXTURE_SCHEMA_VERSION,
  COMPAT_SUMMARY_SCHEMA_VERSION
} from './compat-fixture-runner.mjs';
import {
  COMPAT_REPORT_SCHEMA_VALIDATOR_OUTPUT_SCHEMA_VERSION
} from './compat-report-schema-validator-output.mjs';
import {
  COMPAT_ARTIFACT_BUNDLE_VALIDATOR_OUTPUT_SCHEMA_VERSION
} from './compat-artifact-bundle-validator-output.mjs';
import {
  COMPAT_ARTIFACT_BUNDLE_MANIFEST_SCHEMA_VERSION
} from './compat-artifact-bundle-manifest.mjs';
import {
  COMPAT_ARTIFACT_BUNDLE_MANIFEST_VALIDATOR_OUTPUT_SCHEMA_VERSION
} from './compat-artifact-bundle-manifest-validator-output.mjs';
import {
  REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_FILES,
  REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES,
  REQUIRED_COMPAT_ARTIFACT_BUNDLE_SCHEMA_IDS,
  REQUIRED_COMPAT_ARTIFACT_BUNDLE_SCHEMA_PATHS,
  REQUIRED_COMPAT_ARTIFACT_BUNDLE_VERSION_FIELDS
} from './compat-artifact-bundle-contracts.mjs';

function readSchema(schemaFileName) {
  const schemaPath = path.resolve(process.cwd(), 'schemas', schemaFileName);
  const raw = fs.readFileSync(schemaPath, 'utf-8');
  return JSON.parse(raw);
}

describe('compat payload json schema contracts', () => {
  it('keeps summary validator schema in sync with runtime contract versions', () => {
    const schema = readSchema('compat-summary-validator-output.schema.json');
    expect(schema.properties.outputSchemaVersion.const).toBe(COMPAT_SUMMARY_VALIDATOR_OUTPUT_SCHEMA_VERSION);
    expect(schema.properties.status.enum).toEqual(['ok', 'error']);
    expect(schema.additionalProperties).toBe(false);
  });

  it('keeps validator-result verifier schema in sync with runtime contract versions', () => {
    const schema = readSchema('compat-validator-result-verifier-output.schema.json');
    expect(schema.properties.outputSchemaVersion.const).toBe(COMPAT_VALIDATOR_RESULT_VERIFIER_OUTPUT_SCHEMA_VERSION);
    expect(schema.properties.status.enum).toEqual(['ok', 'error']);
    expect(schema.additionalProperties).toBe(false);
  });

  it('keeps generic json-schema validator output schema in sync with runtime contract version', () => {
    const schema = readSchema('json-schema-validator-output.schema.json');
    expect(schema.properties.outputSchemaVersion.const).toBe(JSON_SCHEMA_VALIDATOR_OUTPUT_SCHEMA_VERSION);
    expect(schema.properties.status.enum).toEqual(['ok', 'error']);
    expect(schema.additionalProperties).toBe(false);
  });

  it('keeps compat summary artifact schema in sync with runtime summary constants', () => {
    const schema = readSchema('compat-summary.schema.json');
    expect(schema.properties.summarySchemaVersion.const).toBe(COMPAT_SUMMARY_SCHEMA_VERSION);
    expect(schema.properties.schemaVersion.const).toBe(COMPAT_FIXTURE_SCHEMA_VERSION);
    expect(schema.properties.mode.enum).toEqual(['contract', 'fixtures']);
    expect(schema.additionalProperties).toBe(false);
  });

  it('keeps compat case-report artifact schema aligned with runtime status contract', () => {
    const schema = readSchema('compat-case-report.schema.json');
    expect(schema.properties.checks.items.properties.status.enum).toEqual(['ok', 'warn', 'error']);
    expect(schema.additionalProperties).toBe(false);
  });

  it('keeps compat report-schema validator output schema in sync with runtime contract versions', () => {
    const schema = readSchema('compat-report-schema-validator-output.schema.json');
    expect(schema.properties.outputSchemaVersion.const).toBe(COMPAT_REPORT_SCHEMA_VALIDATOR_OUTPUT_SCHEMA_VERSION);
    expect(schema.properties.status.enum).toEqual(['ok', 'error']);
    expect(schema.additionalProperties).toBe(false);
  });

  it('keeps compat artifact-bundle validator output schema in sync with runtime contract versions', () => {
    const schema = readSchema('compat-artifact-bundle-validator-output.schema.json');
    expect(schema.properties.outputSchemaVersion.const).toBe(COMPAT_ARTIFACT_BUNDLE_VALIDATOR_OUTPUT_SCHEMA_VERSION);
    expect(schema.properties.status.enum).toEqual(['ok', 'error']);
    expect(schema.properties.verifiedArtifacts.minItems).toBe(REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES.length);
    expect(schema.properties.verifiedArtifacts.maxItems).toBe(REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES.length);
    expect(schema.properties.verifiedArtifacts.items.enum).toEqual(REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES);
    expect(
      schema.properties.verifiedArtifacts.allOf?.[0]?.prefixItems?.map((entry) => entry?.const)
    ).toEqual(REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES);
    expect(schema.properties.artifactContracts.minItems).toBe(REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES.length);
    expect(schema.properties.artifactContracts.maxItems).toBe(REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES.length);
    expect(schema.properties.artifactContracts.items.properties.artifactName.enum).toEqual(REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES);
    expect(
      schema.properties.artifactContracts.allOf?.[0]?.prefixItems?.map((entry) => (
        entry?.properties?.artifactName?.const
      ))
    ).toEqual(REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES);
    const okBranch = schema.allOf.find(
      (entry) => entry?.if?.properties?.status?.const === 'ok'
    )?.then;
    for (const artifactName of REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES) {
      const expectedVersionField = REQUIRED_COMPAT_ARTIFACT_BUNDLE_VERSION_FIELDS[artifactName];
      const expectedSchemaPath = REQUIRED_COMPAT_ARTIFACT_BUNDLE_SCHEMA_PATHS[artifactName];
      const expectedSchemaId = REQUIRED_COMPAT_ARTIFACT_BUNDLE_SCHEMA_IDS[artifactName];
      expect(
        schema.properties.artifactContracts.allOf?.[0]?.prefixItems?.find(
          (entry) => entry?.properties?.artifactName?.const === artifactName
        )?.properties?.versionField?.const
      ).toBe(expectedVersionField);
      expect(
        schema.properties.artifactContracts.allOf?.[0]?.prefixItems?.find(
          (entry) => entry?.properties?.artifactName?.const === artifactName
        )?.properties?.schemaId?.const
      ).toBe(expectedSchemaId);
      expect(
        schema.properties.artifactContracts.allOf?.[0]?.prefixItems?.find(
          (entry) => entry?.properties?.artifactName?.const === artifactName
        )?.properties?.schemaPath?.pattern
      ).toContain(expectedSchemaPath.replaceAll('.', '\\.'));
      expect(
        okBranch?.allOf?.some((entry) => entry?.properties?.verifiedArtifacts?.contains?.const === artifactName)
      ).toBe(true);
      expect(
        okBranch?.allOf?.some((entry) => (
          entry?.properties?.artifactContracts?.contains?.properties?.artifactName?.const === artifactName
          && entry?.properties?.artifactContracts?.contains?.properties?.schemaId?.const === expectedSchemaId
          && entry?.properties?.artifactContracts?.contains?.properties?.versionField?.const === expectedVersionField
        ))
      ).toBe(true);
    }
    expect(schema.additionalProperties).toBe(false);
  });

  it('keeps compat artifact-bundle manifest schema in sync with runtime contract versions', () => {
    const schema = readSchema('compat-artifact-bundle.manifest.schema.json');
    expect(schema.properties.schemaVersion.const).toBe(COMPAT_ARTIFACT_BUNDLE_MANIFEST_SCHEMA_VERSION);
    expect(schema.properties.artifacts.minItems).toBe(REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES.length);
    expect(schema.properties.artifacts.maxItems).toBe(REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES.length);
    expect(schema.properties.artifacts.items.properties.artifactName.enum).toEqual(REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES);
    expect(
      schema.properties.artifacts.allOf?.find((entry) => Array.isArray(entry?.prefixItems))
        ?.prefixItems?.map((entry) => entry?.properties?.artifactName?.const)
    ).toEqual(REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES);
    for (const artifactName of REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES) {
      const expectedVersionField = REQUIRED_COMPAT_ARTIFACT_BUNDLE_VERSION_FIELDS[artifactName];
      const expectedArtifactFile = REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_FILES[artifactName];
      const expectedSchemaPath = REQUIRED_COMPAT_ARTIFACT_BUNDLE_SCHEMA_PATHS[artifactName];
      const expectedSchemaId = REQUIRED_COMPAT_ARTIFACT_BUNDLE_SCHEMA_IDS[artifactName];
      expect(
        schema.properties.artifacts.allOf?.some(
          (entry) => (
            entry?.contains?.properties?.artifactName?.const === artifactName
            && entry?.contains?.properties?.artifactFile?.const === expectedArtifactFile
            && entry?.contains?.properties?.schemaPath?.const === expectedSchemaPath
            && entry?.contains?.properties?.schemaId?.const === expectedSchemaId
            && entry?.contains?.properties?.versionField?.const === expectedVersionField
          )
        )
      ).toBe(true);
    }
    expect(schema.additionalProperties).toBe(false);
  });

  it('keeps compat artifact-bundle manifest validator output schema in sync with runtime contract versions', () => {
    const schema = readSchema('compat-artifact-bundle-manifest-validator-output.schema.json');
    expect(schema.properties.outputSchemaVersion.const).toBe(COMPAT_ARTIFACT_BUNDLE_MANIFEST_VALIDATOR_OUTPUT_SCHEMA_VERSION);
    expect(schema.properties.status.enum).toEqual(['ok', 'error']);
    expect(schema.properties.artifactCount.const).toBe(REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES.length);
    expect(schema.properties.artifacts.minItems).toBe(REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES.length);
    expect(schema.properties.artifacts.maxItems).toBe(REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES.length);
    expect(schema.properties.artifacts.items.enum).toEqual(REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES);
    expect(
      schema.properties.artifacts.allOf?.[0]?.prefixItems?.map((entry) => entry?.const)
    ).toEqual(REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES);
    expect(schema.properties.schemaContracts.minItems).toBe(REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES.length);
    expect(schema.properties.schemaContracts.maxItems).toBe(REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES.length);
    expect(schema.properties.schemaContracts.items.properties.artifactName.enum).toEqual(REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES);
    expect(
      schema.properties.schemaContracts.allOf?.[0]?.prefixItems?.map((entry) => (
        entry?.properties?.artifactName?.const
      ))
    ).toEqual(REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES);
    const okBranch = schema.allOf.find(
      (entry) => entry?.if?.properties?.status?.const === 'ok'
    )?.then;
    for (const artifactName of REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES) {
      const expectedVersionField = REQUIRED_COMPAT_ARTIFACT_BUNDLE_VERSION_FIELDS[artifactName];
      const expectedArtifactFile = REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_FILES[artifactName];
      const expectedSchemaPath = REQUIRED_COMPAT_ARTIFACT_BUNDLE_SCHEMA_PATHS[artifactName];
      const expectedSchemaId = REQUIRED_COMPAT_ARTIFACT_BUNDLE_SCHEMA_IDS[artifactName];
      const orderedSchemaContractEntry = schema.properties.schemaContracts.allOf?.[0]?.prefixItems?.find(
        (entry) => entry?.properties?.artifactName?.const === artifactName
      );
      expect(orderedSchemaContractEntry?.properties?.artifactFile?.const).toBe(expectedArtifactFile);
      expect(orderedSchemaContractEntry?.properties?.schemaId?.const).toBe(expectedSchemaId);
      expect(orderedSchemaContractEntry?.properties?.schemaPath?.pattern).toContain(expectedSchemaPath.replaceAll('.', '\\.'));
      expect(orderedSchemaContractEntry?.properties?.versionField?.const).toBe(expectedVersionField);
      expect(
        okBranch?.allOf?.some((entry) => entry?.properties?.artifacts?.contains?.const === artifactName)
      ).toBe(true);
      expect(
        okBranch?.allOf?.some((entry) => (
          entry?.properties?.schemaContracts?.contains?.properties?.artifactName?.const === artifactName
          && entry?.properties?.schemaContracts?.contains?.properties?.artifactFile?.const === expectedArtifactFile
          && entry?.properties?.schemaContracts?.contains?.properties?.schemaId?.const === expectedSchemaId
          && entry?.properties?.schemaContracts?.contains?.properties?.versionField?.const === expectedVersionField
        ))
      ).toBe(true);
    }
    expect(schema.additionalProperties).toBe(false);
  });
});
