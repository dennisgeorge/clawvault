import { describe, expect, it } from 'vitest';
import {
  REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_COUNT,
  REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_DEFINITIONS,
  REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_FILES,
  REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES,
  REQUIRED_COMPAT_ARTIFACT_BUNDLE_PATH_FIELDS,
  REQUIRED_COMPAT_ARTIFACT_BUNDLE_SCHEMA_IDS,
  REQUIRED_COMPAT_ARTIFACT_BUNDLE_SCHEMA_PATHS,
  REQUIRED_COMPAT_ARTIFACT_BUNDLE_VERSION_FIELDS
} from './compat-artifact-bundle-contracts.mjs';
import {
  expectArrayOfRecordsWithRequiredStringFields,
  expectNonEmptyUniqueStringArray,
  expectObjectKeyDomainParity,
  expectUniqueStringFieldAcrossRecords
} from './compat-contract-assertion-test-utils.js';

describe('compat artifact bundle contracts constants', () => {
  it('keeps canonical artifact definitions unique and ordered', () => {
    expectArrayOfRecordsWithRequiredStringFields(
      REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_DEFINITIONS,
      ['artifactName', 'artifactFile', 'schemaPath', 'schemaId', 'versionField'],
      'REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_DEFINITIONS'
    );
    expect(REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_DEFINITIONS.length).toBe(REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_COUNT);
    expectUniqueStringFieldAcrossRecords(
      REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_DEFINITIONS,
      'artifactName',
      'REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_DEFINITIONS artifactName'
    );
    const artifactNames = REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_DEFINITIONS.map((entry) => entry.artifactName);
    expect(artifactNames).toEqual(REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES);
  });

  it('keeps required artifact names unique and non-empty', () => {
    expectNonEmptyUniqueStringArray(
      REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES,
      'REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES'
    );
    expect(REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_COUNT).toBe(REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES.length);
  });

  it('keeps required path bindings aligned with required artifact set', () => {
    expectArrayOfRecordsWithRequiredStringFields(
      REQUIRED_COMPAT_ARTIFACT_BUNDLE_PATH_FIELDS,
      ['fieldName', 'artifactName'],
      'REQUIRED_COMPAT_ARTIFACT_BUNDLE_PATH_FIELDS'
    );
    expectUniqueStringFieldAcrossRecords(
      REQUIRED_COMPAT_ARTIFACT_BUNDLE_PATH_FIELDS,
      'artifactName',
      'REQUIRED_COMPAT_ARTIFACT_BUNDLE_PATH_FIELDS artifactName'
    );
    expectUniqueStringFieldAcrossRecords(
      REQUIRED_COMPAT_ARTIFACT_BUNDLE_PATH_FIELDS,
      'fieldName',
      'REQUIRED_COMPAT_ARTIFACT_BUNDLE_PATH_FIELDS fieldName'
    );
    const boundArtifactNames = REQUIRED_COMPAT_ARTIFACT_BUNDLE_PATH_FIELDS.map((entry) => entry.artifactName);
    expect(boundArtifactNames).toEqual(expect.arrayContaining(REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES));
  });

  it('keeps required version-field bindings aligned with required artifact set', () => {
    expectObjectKeyDomainParity(
      REQUIRED_COMPAT_ARTIFACT_BUNDLE_VERSION_FIELDS,
      REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES,
      'REQUIRED_COMPAT_ARTIFACT_BUNDLE_VERSION_FIELDS'
    );
    expect(REQUIRED_COMPAT_ARTIFACT_BUNDLE_VERSION_FIELDS['summary.json']).toBe('summarySchemaVersion');
    for (const artifactName of REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES.filter((name) => name !== 'summary.json')) {
      expect(REQUIRED_COMPAT_ARTIFACT_BUNDLE_VERSION_FIELDS[artifactName]).toBe('outputSchemaVersion');
    }
  });

  it('keeps required artifact-file bindings aligned with required artifact set', () => {
    expectObjectKeyDomainParity(
      REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_FILES,
      REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES,
      'REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_FILES'
    );
    for (const artifactName of REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES) {
      expect(REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_FILES[artifactName]).toBe(artifactName);
    }
  });

  it('keeps required schema path/id bindings aligned with required artifact set', () => {
    expectObjectKeyDomainParity(
      REQUIRED_COMPAT_ARTIFACT_BUNDLE_SCHEMA_PATHS,
      REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES,
      'REQUIRED_COMPAT_ARTIFACT_BUNDLE_SCHEMA_PATHS'
    );
    expectObjectKeyDomainParity(
      REQUIRED_COMPAT_ARTIFACT_BUNDLE_SCHEMA_IDS,
      REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES,
      'REQUIRED_COMPAT_ARTIFACT_BUNDLE_SCHEMA_IDS'
    );
    for (const artifactName of REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES) {
      const schemaPath = REQUIRED_COMPAT_ARTIFACT_BUNDLE_SCHEMA_PATHS[artifactName];
      const schemaId = REQUIRED_COMPAT_ARTIFACT_BUNDLE_SCHEMA_IDS[artifactName];
      expect(schemaPath.startsWith('schemas/')).toBe(true);
      expect(schemaId).toBe(`https://clawvault.dev/${schemaPath}`);
    }
  });
});
