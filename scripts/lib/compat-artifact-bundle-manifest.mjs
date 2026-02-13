import * as fs from 'fs';
import {
  REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES
} from './compat-artifact-bundle-contracts.mjs';

export const COMPAT_ARTIFACT_BUNDLE_MANIFEST_SCHEMA_VERSION = 1;

const VALID_VERSION_FIELDS = new Set(['summarySchemaVersion', 'outputSchemaVersion']);

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
