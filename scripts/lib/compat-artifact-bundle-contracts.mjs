export const REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_DEFINITIONS = Object.freeze([
  Object.freeze({
    artifactName: 'summary.json',
    artifactFile: 'summary.json',
    schemaPath: 'schemas/compat-summary.schema.json',
    schemaId: 'https://clawvault.dev/schemas/compat-summary.schema.json',
    versionField: 'summarySchemaVersion'
  }),
  Object.freeze({
    artifactName: 'report-schema-validator-result.json',
    artifactFile: 'report-schema-validator-result.json',
    schemaPath: 'schemas/compat-report-schema-validator-output.schema.json',
    schemaId: 'https://clawvault.dev/schemas/compat-report-schema-validator-output.schema.json',
    versionField: 'outputSchemaVersion'
  }),
  Object.freeze({
    artifactName: 'validator-result.json',
    artifactFile: 'validator-result.json',
    schemaPath: 'schemas/compat-summary-validator-output.schema.json',
    schemaId: 'https://clawvault.dev/schemas/compat-summary-validator-output.schema.json',
    versionField: 'outputSchemaVersion'
  }),
  Object.freeze({
    artifactName: 'schema-validator-result.json',
    artifactFile: 'schema-validator-result.json',
    schemaPath: 'schemas/json-schema-validator-output.schema.json',
    schemaId: 'https://clawvault.dev/schemas/json-schema-validator-output.schema.json',
    versionField: 'outputSchemaVersion'
  }),
  Object.freeze({
    artifactName: 'validator-result-verifier-result.json',
    artifactFile: 'validator-result-verifier-result.json',
    schemaPath: 'schemas/compat-validator-result-verifier-output.schema.json',
    schemaId: 'https://clawvault.dev/schemas/compat-validator-result-verifier-output.schema.json',
    versionField: 'outputSchemaVersion'
  }),
  Object.freeze({
    artifactName: 'artifact-bundle-manifest-validator-result.json',
    artifactFile: 'artifact-bundle-manifest-validator-result.json',
    schemaPath: 'schemas/compat-artifact-bundle-manifest-validator-output.schema.json',
    schemaId: 'https://clawvault.dev/schemas/compat-artifact-bundle-manifest-validator-output.schema.json',
    versionField: 'outputSchemaVersion'
  })
]);

export const REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES = Object.freeze(
  REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_DEFINITIONS.map((definition) => definition.artifactName)
);

export const REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_COUNT = REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_NAMES.length;

export const REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_FILES = Object.freeze(
  Object.fromEntries(
    REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_DEFINITIONS.map((definition) => [definition.artifactName, definition.artifactFile])
  )
);

export const REQUIRED_COMPAT_ARTIFACT_BUNDLE_SCHEMA_PATHS = Object.freeze(
  Object.fromEntries(
    REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_DEFINITIONS.map((definition) => [definition.artifactName, definition.schemaPath])
  )
);

export const REQUIRED_COMPAT_ARTIFACT_BUNDLE_SCHEMA_IDS = Object.freeze(
  Object.fromEntries(
    REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_DEFINITIONS.map((definition) => [definition.artifactName, definition.schemaId])
  )
);

export const REQUIRED_COMPAT_ARTIFACT_BUNDLE_VERSION_FIELDS = Object.freeze(
  Object.fromEntries(
    REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_DEFINITIONS.map((definition) => [definition.artifactName, definition.versionField])
  )
);

export const REQUIRED_COMPAT_ARTIFACT_BUNDLE_PATH_FIELDS = Object.freeze([
  Object.freeze({ fieldName: 'summaryPath', artifactName: 'summary.json' }),
  Object.freeze({ fieldName: 'validatorResultPath', artifactName: 'validator-result.json' }),
  Object.freeze({ fieldName: 'reportSchemaValidatorResultPath', artifactName: 'report-schema-validator-result.json' }),
  Object.freeze({ fieldName: 'schemaValidatorResultPath', artifactName: 'schema-validator-result.json' }),
  Object.freeze({ fieldName: 'validatorResultVerifierResultPath', artifactName: 'validator-result-verifier-result.json' }),
  Object.freeze({ fieldName: 'artifactBundleManifestValidatorResultPath', artifactName: 'artifact-bundle-manifest-validator-result.json' })
]);
