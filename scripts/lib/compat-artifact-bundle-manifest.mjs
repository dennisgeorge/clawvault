import * as fs from 'fs';
import {
  REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_FILES,
  REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES,
  REQUIRED_COMPAT_ARTIFACT_BUNDLE_SCHEMA_IDS,
  REQUIRED_COMPAT_ARTIFACT_BUNDLE_SCHEMA_PATHS,
  REQUIRED_COMPAT_ARTIFACT_BUNDLE_VERSION_FIELDS
} from './compat-artifact-bundle-contracts.mjs';

export const COMPAT_ARTIFACT_BUNDLE_MANIFEST_SCHEMA_VERSION = 1;

const VALID_VERSION_FIELDS = new Set(['summarySchemaVersion', 'outputSchemaVersion']);
const REQUIRED_ARTIFACT_NAME_SET = new Set(REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES);

function assertNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`compat artifact bundle manifest field "${fieldName}" must be a non-empty string`);
  }
}

export function ensureCompatArtifactBundleManifestShape(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('compat artifact bundle manifest must be an object');
  }
  if (manifest.schemaVersion !== COMPAT_ARTIFACT_BUNDLE_MANIFEST_SCHEMA_VERSION) {
    throw new Error(
      `compat artifact bundle manifest schemaVersion must be ${COMPAT_ARTIFACT_BUNDLE_MANIFEST_SCHEMA_VERSION}`
    );
  }
  if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length === 0) {
    throw new Error('compat artifact bundle manifest artifacts must be a non-empty array');
  }

  const artifactNames = new Set();
  const artifactFiles = new Set();
  for (const [index, entry] of manifest.artifacts.entries()) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`compat artifact bundle manifest artifacts[${index}] must be an object`);
    }
    assertNonEmptyString(entry.artifactName, `artifacts[${index}].artifactName`);
    assertNonEmptyString(entry.artifactFile, `artifacts[${index}].artifactFile`);
    assertNonEmptyString(entry.schemaPath, `artifacts[${index}].schemaPath`);
    assertNonEmptyString(entry.schemaId, `artifacts[${index}].schemaId`);
    if (!VALID_VERSION_FIELDS.has(entry.versionField)) {
      throw new Error(`compat artifact bundle manifest artifacts[${index}].versionField has invalid value`);
    }
    if (!REQUIRED_ARTIFACT_NAME_SET.has(entry.artifactName)) {
      throw new Error(`compat artifact bundle manifest has unsupported artifactName: ${entry.artifactName}`);
    }

    if (artifactNames.has(entry.artifactName)) {
      throw new Error(`compat artifact bundle manifest has duplicate artifactName: ${entry.artifactName}`);
    }
    artifactNames.add(entry.artifactName);

    if (artifactFiles.has(entry.artifactFile)) {
      throw new Error(`compat artifact bundle manifest has duplicate artifactFile: ${entry.artifactFile}`);
    }
    artifactFiles.add(entry.artifactFile);
  }
  for (const requiredArtifactName of REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES) {
    if (!artifactNames.has(requiredArtifactName)) {
      throw new Error(`compat artifact bundle manifest is missing required artifactName: ${requiredArtifactName}`);
    }
    const entry = manifest.artifacts.find((artifact) => artifact.artifactName === requiredArtifactName);
    const expectedArtifactFile = REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_FILES[requiredArtifactName];
    if (entry.artifactFile !== expectedArtifactFile) {
      throw new Error(
        `compat artifact bundle manifest required artifact ${requiredArtifactName} must use artifactFile=${expectedArtifactFile}`
      );
    }
    const expectedSchemaPath = REQUIRED_COMPAT_ARTIFACT_BUNDLE_SCHEMA_PATHS[requiredArtifactName];
    if (entry.schemaPath !== expectedSchemaPath) {
      throw new Error(
        `compat artifact bundle manifest required artifact ${requiredArtifactName} must use schemaPath=${expectedSchemaPath}`
      );
    }
    const expectedSchemaId = REQUIRED_COMPAT_ARTIFACT_BUNDLE_SCHEMA_IDS[requiredArtifactName];
    if (entry.schemaId !== expectedSchemaId) {
      throw new Error(
        `compat artifact bundle manifest required artifact ${requiredArtifactName} must use schemaId=${expectedSchemaId}`
      );
    }
    const expectedVersionField = REQUIRED_COMPAT_ARTIFACT_BUNDLE_VERSION_FIELDS[requiredArtifactName];
    if (entry.versionField !== expectedVersionField) {
      throw new Error(
        `compat artifact bundle manifest required artifact ${requiredArtifactName} must use versionField=${expectedVersionField}`
      );
    }
  }
  if (manifest.artifacts.length !== REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES.length) {
    throw new Error(
      `compat artifact bundle manifest artifacts length must be ${REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES.length}`
    );
  }
  for (const [index, requiredArtifactName] of REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES.entries()) {
    if (manifest.artifacts[index]?.artifactName !== requiredArtifactName) {
      throw new Error('compat artifact bundle manifest artifacts must follow required canonical artifactName order');
    }
  }
}

export function loadCompatArtifactBundleManifest(manifestPath) {
  try {
    const raw = fs.readFileSync(manifestPath, 'utf-8');
    const parsed = JSON.parse(raw);
    ensureCompatArtifactBundleManifestShape(parsed);
    return parsed;
  } catch (err) {
    throw new Error(`Unable to read compat artifact bundle manifest at ${manifestPath}: ${err?.message || String(err)}`);
  }
}
