import * as fs from 'fs';
import {
  REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_FILES,
  REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_COUNT,
  REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES,
  REQUIRED_COMPAT_ARTIFACT_BUNDLE_SCHEMA_IDS,
  REQUIRED_COMPAT_ARTIFACT_BUNDLE_SCHEMA_PATHS,
  REQUIRED_COMPAT_ARTIFACT_BUNDLE_VERSION_FIELDS
} from './compat-artifact-bundle-contracts.mjs';

const REQUIRED_ARTIFACT_NAME_SET = new Set(REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES);

export const COMPAT_ARTIFACT_BUNDLE_MANIFEST_VALIDATOR_OUTPUT_SCHEMA_VERSION = 1;

function assertNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`compat artifact bundle manifest validator payload field "${fieldName}" must be a non-empty string`);
  }
}

function assertNonNegativeInteger(value, fieldName) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`compat artifact bundle manifest validator payload field "${fieldName}" must be a non-negative integer`);
  }
}

function assertUniqueNonEmptyStringArray(values, fieldName) {
  if (!Array.isArray(values) || values.some((value) => typeof value !== 'string' || value.length === 0)) {
    throw new Error(`compat artifact bundle manifest validator payload field "${fieldName}" must be an array of non-empty strings`);
  }
  const duplicates = values
    .filter((value, index, allValues) => allValues.indexOf(value) !== index)
    .filter((value, index, allValues) => allValues.indexOf(value) === index);
  if (duplicates.length > 0) {
    throw new Error(`compat artifact bundle manifest validator payload field "${fieldName}" contains duplicates: ${duplicates.join(', ')}`);
  }
}

function ensureSchemaContractEntryShape(entry, index) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    throw new Error(`compat artifact bundle manifest validator payload schemaContracts[${index}] must be an object`);
  }
  assertNonEmptyString(entry.artifactName, `schemaContracts[${index}].artifactName`);
  assertNonEmptyString(entry.artifactFile, `schemaContracts[${index}].artifactFile`);
  assertNonEmptyString(entry.schemaPath, `schemaContracts[${index}].schemaPath`);
  assertNonEmptyString(entry.schemaId, `schemaContracts[${index}].schemaId`);
  if (entry.versionField !== 'summarySchemaVersion' && entry.versionField !== 'outputSchemaVersion') {
    throw new Error(`compat artifact bundle manifest validator payload schemaContracts[${index}].versionField has invalid value`);
  }
  assertNonNegativeInteger(entry.expectedSchemaVersion, `schemaContracts[${index}].expectedSchemaVersion`);
}

export function ensureCompatArtifactBundleManifestValidatorPayloadShape(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('compat artifact bundle manifest validator payload must be an object');
  }
  if (payload.outputSchemaVersion !== COMPAT_ARTIFACT_BUNDLE_MANIFEST_VALIDATOR_OUTPUT_SCHEMA_VERSION) {
    throw new Error(
      `compat artifact bundle manifest validator payload outputSchemaVersion must be ${COMPAT_ARTIFACT_BUNDLE_MANIFEST_VALIDATOR_OUTPUT_SCHEMA_VERSION}`
    );
  }
  if (payload.status !== 'ok' && payload.status !== 'error') {
    throw new Error('compat artifact bundle manifest validator payload status must be "ok" or "error"');
  }

  if (payload.status === 'ok') {
    assertNonEmptyString(payload.manifestPath, 'manifestPath');
    assertNonNegativeInteger(payload.artifactCount, 'artifactCount');
    if (payload.artifactCount !== REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_COUNT) {
      throw new Error(
        `compat artifact bundle manifest validator payload artifactCount must be ${REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_COUNT}`
      );
    }
    assertUniqueNonEmptyStringArray(payload.artifacts, 'artifacts');
    if (payload.artifacts.length !== payload.artifactCount) {
      throw new Error('compat artifact bundle manifest validator payload artifacts.length must match artifactCount');
    }
    const payloadArtifactSet = new Set(payload.artifacts);
    const unsupportedArtifacts = payload.artifacts.filter((name) => !REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES.includes(name));
    if (unsupportedArtifacts.length > 0) {
      throw new Error(
        `compat artifact bundle manifest validator payload artifacts contains unsupported artifactName values: ${unsupportedArtifacts.join(', ')}`
      );
    }
    for (const [index, requiredArtifactName] of REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES.entries()) {
      if (payload.artifacts[index] !== requiredArtifactName) {
        throw new Error(
          'compat artifact bundle manifest validator payload artifacts must follow required canonical artifactName order'
        );
      }
    }
    if (!Array.isArray(payload.schemaContracts)) {
      throw new Error('compat artifact bundle manifest validator payload field "schemaContracts" must be an array');
    }
    const schemaContractArtifactNames = [];
    const schemaContractArtifactFiles = [];
    for (const [index, entry] of payload.schemaContracts.entries()) {
      ensureSchemaContractEntryShape(entry, index);
      schemaContractArtifactNames.push(entry.artifactName);
      schemaContractArtifactFiles.push(entry.artifactFile);
    }
    if (payload.schemaContracts.length !== payload.artifactCount) {
      throw new Error('compat artifact bundle manifest validator payload schemaContracts.length must match artifactCount');
    }
    const duplicateContractArtifactNames = schemaContractArtifactNames
      .filter((value, index, allValues) => allValues.indexOf(value) !== index)
      .filter((value, index, allValues) => allValues.indexOf(value) === index);
    if (duplicateContractArtifactNames.length > 0) {
      throw new Error(
        `compat artifact bundle manifest validator payload schemaContracts contains duplicate artifactName values: ${duplicateContractArtifactNames.join(', ')}`
      );
    }
    const duplicateContractArtifactFiles = schemaContractArtifactFiles
      .filter((value, index, allValues) => allValues.indexOf(value) !== index)
      .filter((value, index, allValues) => allValues.indexOf(value) === index);
    if (duplicateContractArtifactFiles.length > 0) {
      throw new Error(
        `compat artifact bundle manifest validator payload schemaContracts contains duplicate artifactFile values: ${duplicateContractArtifactFiles.join(', ')}`
      );
    }
    const unsupportedSchemaContractArtifacts = schemaContractArtifactNames.filter((name) => !REQUIRED_ARTIFACT_NAME_SET.has(name));
    if (unsupportedSchemaContractArtifacts.length > 0) {
      throw new Error(
        `compat artifact bundle manifest validator payload schemaContracts contains unsupported artifactName values: ${unsupportedSchemaContractArtifacts.join(', ')}`
      );
    }
    if (schemaContractArtifactNames.some((value, index) => value !== payload.artifacts[index])) {
      throw new Error(
        'compat artifact bundle manifest validator payload schemaContracts artifactName order must match artifacts'
      );
    }
    const schemaContractsByArtifactName = new Map(
      payload.schemaContracts.map((entry) => [entry.artifactName, entry])
    );
    for (const requiredArtifactName of REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES) {
      if (!payloadArtifactSet.has(requiredArtifactName)) {
        throw new Error(
          `compat artifact bundle manifest validator payload artifacts is missing required artifactName: ${requiredArtifactName}`
        );
      }
      if (!schemaContractArtifactNames.includes(requiredArtifactName)) {
        throw new Error(
          `compat artifact bundle manifest validator payload schemaContracts is missing required artifactName: ${requiredArtifactName}`
        );
      }
      const expectedArtifactFile = REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_FILES[requiredArtifactName];
      if (schemaContractsByArtifactName.get(requiredArtifactName)?.artifactFile !== expectedArtifactFile) {
        throw new Error(
          `compat artifact bundle manifest validator payload schemaContracts entry for ${requiredArtifactName} `
          + `must use artifactFile=${expectedArtifactFile}`
        );
      }
      const expectedSchemaPath = REQUIRED_COMPAT_ARTIFACT_BUNDLE_SCHEMA_PATHS[requiredArtifactName];
      if (!schemaContractsByArtifactName.get(requiredArtifactName)?.schemaPath?.endsWith(expectedSchemaPath)) {
        throw new Error(
          `compat artifact bundle manifest validator payload schemaContracts entry for ${requiredArtifactName} `
          + `must reference schemaPath ending with ${expectedSchemaPath}`
        );
      }
      const expectedSchemaId = REQUIRED_COMPAT_ARTIFACT_BUNDLE_SCHEMA_IDS[requiredArtifactName];
      if (schemaContractsByArtifactName.get(requiredArtifactName)?.schemaId !== expectedSchemaId) {
        throw new Error(
          `compat artifact bundle manifest validator payload schemaContracts entry for ${requiredArtifactName} `
          + `must use schemaId=${expectedSchemaId}`
        );
      }
      const expectedVersionField = REQUIRED_COMPAT_ARTIFACT_BUNDLE_VERSION_FIELDS[requiredArtifactName];
      if (schemaContractsByArtifactName.get(requiredArtifactName)?.versionField !== expectedVersionField) {
        throw new Error(
          `compat artifact bundle manifest validator payload schemaContracts entry for ${requiredArtifactName} `
          + `must use versionField=${expectedVersionField}`
        );
      }
    }
    return;
  }

  assertNonEmptyString(payload.error, 'error');
}

export function buildCompatArtifactBundleManifestValidatorSuccessPayload({
  manifestPath,
  artifactCount,
  artifacts,
  schemaContracts
}) {
  const payload = {
    outputSchemaVersion: COMPAT_ARTIFACT_BUNDLE_MANIFEST_VALIDATOR_OUTPUT_SCHEMA_VERSION,
    status: 'ok',
    manifestPath,
    artifactCount,
    artifacts,
    schemaContracts
  };
  ensureCompatArtifactBundleManifestValidatorPayloadShape(payload);
  return payload;
}

export function buildCompatArtifactBundleManifestValidatorErrorPayload(error) {
  const payload = {
    outputSchemaVersion: COMPAT_ARTIFACT_BUNDLE_MANIFEST_VALIDATOR_OUTPUT_SCHEMA_VERSION,
    status: 'error',
    error: String(error ?? '')
  };
  ensureCompatArtifactBundleManifestValidatorPayloadShape(payload);
  return payload;
}

export function loadCompatArtifactBundleManifestValidatorPayload(payloadPath) {
  try {
    const raw = fs.readFileSync(payloadPath, 'utf-8');
    const parsed = JSON.parse(raw);
    ensureCompatArtifactBundleManifestValidatorPayloadShape(parsed);
    return parsed;
  } catch (err) {
    throw new Error(`Unable to read compat artifact bundle manifest validator payload at ${payloadPath}: ${err?.message || String(err)}`);
  }
}
