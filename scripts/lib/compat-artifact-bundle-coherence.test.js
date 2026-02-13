import { describe, expect, it } from 'vitest';
import * as path from 'path';
import {
  ensureArtifactContractVersionParity,
  ensureArtifactPathCoherence,
  ensureCrossPayloadCoherence,
  ensureManifestValidatorPayloadCoherence,
  ensureRequireOkStatuses
} from './compat-artifact-bundle-coherence.mjs';

function buildBaseFixtureState() {
  const reportDir = '/tmp/compat-report-dir';
  const manifestPath = '/workspace/schemas/compat-artifact-bundle.manifest.json';
  const artifactContracts = [
    {
      artifactName: 'summary.json',
      artifactFile: 'summary.json',
      schemaPathResolved: path.resolve(process.cwd(), 'schemas', 'compat-summary.schema.json'),
      schemaId: 'https://clawvault.dev/schemas/compat-summary.schema.json',
      versionField: 'summarySchemaVersion'
    },
    {
      artifactName: 'report-schema-validator-result.json',
      artifactFile: 'report-schema-validator-result.json',
      schemaPathResolved: path.resolve(process.cwd(), 'schemas', 'compat-report-schema-validator-output.schema.json'),
      schemaId: 'https://clawvault.dev/schemas/compat-report-schema-validator-output.schema.json',
      versionField: 'outputSchemaVersion'
    },
    {
      artifactName: 'validator-result.json',
      artifactFile: 'validator-result.json',
      schemaPathResolved: path.resolve(process.cwd(), 'schemas', 'compat-summary-validator-output.schema.json'),
      schemaId: 'https://clawvault.dev/schemas/compat-summary-validator-output.schema.json',
      versionField: 'outputSchemaVersion'
    },
    {
      artifactName: 'schema-validator-result.json',
      artifactFile: 'schema-validator-result.json',
      schemaPathResolved: path.resolve(process.cwd(), 'schemas', 'json-schema-validator-output.schema.json'),
      schemaId: 'https://clawvault.dev/schemas/json-schema-validator-output.schema.json',
      versionField: 'outputSchemaVersion'
    },
    {
      artifactName: 'validator-result-verifier-result.json',
      artifactFile: 'validator-result-verifier-result.json',
      schemaPathResolved: path.resolve(process.cwd(), 'schemas', 'compat-validator-result-verifier-output.schema.json'),
      schemaId: 'https://clawvault.dev/schemas/compat-validator-result-verifier-output.schema.json',
      versionField: 'outputSchemaVersion'
    },
    {
      artifactName: 'artifact-bundle-manifest-validator-result.json',
      artifactFile: 'artifact-bundle-manifest-validator-result.json',
      schemaPathResolved: path.resolve(process.cwd(), 'schemas', 'compat-artifact-bundle-manifest-validator-output.schema.json'),
      schemaId: 'https://clawvault.dev/schemas/compat-artifact-bundle-manifest-validator-output.schema.json',
      versionField: 'outputSchemaVersion'
    }
  ];
  const artifactPathByName = new Map(
    artifactContracts.map((entry) => [entry.artifactName, path.join(reportDir, entry.artifactFile)])
  );

  return {
    reportDir,
    manifestPath,
    artifactContracts,
    artifactPathByName,
    summary: {
      mode: 'fixtures',
      summarySchemaVersion: 1,
      schemaVersion: 2,
      selectedTotal: 1,
      results: [{ name: 'healthy' }]
    },
    summaryValidatorPayload: {
      status: 'ok',
      mode: 'fixtures',
      summarySchemaVersion: 1,
      fixtureSchemaVersion: 2,
      selectedTotal: 1,
      resultCount: 1,
      summaryPath: path.join(reportDir, 'summary.json'),
      reportDir,
      caseReportMode: 'validated-case-reports',
      outputSchemaVersion: 1
    },
    reportSchemaValidatorPayload: {
      status: 'ok',
      mode: 'fixtures',
      summaryPath: path.join(reportDir, 'summary.json'),
      reportDir,
      summarySchemaPath: path.resolve(process.cwd(), 'schemas', 'compat-summary.schema.json'),
      caseSchemaPath: path.resolve(process.cwd(), 'schemas', 'compat-case-report.schema.json'),
      caseReportMode: 'validated-case-reports',
      validatedCaseReports: 1
    },
    schemaValidatorPayload: {
      status: 'ok',
      dataPath: path.join(reportDir, 'validator-result.json'),
      schemaPath: path.resolve(process.cwd(), 'schemas', 'compat-summary-validator-output.schema.json')
    },
    validatorResultVerifierPayload: {
      status: 'ok',
      payloadPath: path.join(reportDir, 'validator-result.json'),
      payloadStatus: 'ok',
      validatorPayloadOutputSchemaVersion: 1
    },
    artifactBundleManifestValidatorPayload: {
      status: 'ok',
      manifestPath,
      artifactCount: artifactContracts.length,
      artifacts: artifactContracts.map((entry) => entry.artifactName),
      schemaContracts: artifactContracts.map((entry) => ({
        artifactName: entry.artifactName,
        artifactFile: entry.artifactFile,
        schemaPath: entry.schemaPathResolved,
        schemaId: entry.schemaId,
        versionField: entry.versionField,
        expectedSchemaVersion: 1
      }))
    },
    artifactContractEntries: artifactContracts.map((entry) => ({
      artifactName: entry.artifactName,
      expectedSchemaVersion: 1
    }))
  };
}

describe('compat artifact bundle coherence helpers', () => {
  it('validates path coherence and detects drift', () => {
    const fixture = buildBaseFixtureState();
    expect(() => ensureArtifactPathCoherence({
      summaryValidatorPayload: fixture.summaryValidatorPayload,
      reportSchemaValidatorPayload: fixture.reportSchemaValidatorPayload,
      schemaValidatorPayload: fixture.schemaValidatorPayload,
      validatorResultVerifierPayload: fixture.validatorResultVerifierPayload,
      artifactBundleManifestValidatorPayload: fixture.artifactBundleManifestValidatorPayload,
      artifactPathByName: fixture.artifactPathByName,
      reportDir: fixture.reportDir,
      manifestPath: fixture.manifestPath
    })).not.toThrow();

    fixture.summaryValidatorPayload.reportDir = '/tmp/drifted-report-dir';
    expect(() => ensureArtifactPathCoherence({
      summaryValidatorPayload: fixture.summaryValidatorPayload,
      reportSchemaValidatorPayload: fixture.reportSchemaValidatorPayload,
      schemaValidatorPayload: fixture.schemaValidatorPayload,
      validatorResultVerifierPayload: fixture.validatorResultVerifierPayload,
      artifactBundleManifestValidatorPayload: fixture.artifactBundleManifestValidatorPayload,
      artifactPathByName: fixture.artifactPathByName,
      reportDir: fixture.reportDir,
      manifestPath: fixture.manifestPath
    })).toThrow('validator-result reportDir mismatch');
  });

  it('validates cross payload coherence and detects selected total drift', () => {
    const fixture = buildBaseFixtureState();
    expect(() => ensureCrossPayloadCoherence({
      summary: fixture.summary,
      summaryValidatorPayload: fixture.summaryValidatorPayload,
      reportSchemaValidatorPayload: fixture.reportSchemaValidatorPayload,
      validatorResultVerifierPayload: fixture.validatorResultVerifierPayload,
      schemaValidatorPayload: fixture.schemaValidatorPayload,
      artifactContracts: fixture.artifactContracts,
      expectedCaseSchemaPath: path.resolve(process.cwd(), 'schemas', 'compat-case-report.schema.json')
    })).not.toThrow();

    fixture.summaryValidatorPayload.selectedTotal = 99;
    expect(() => ensureCrossPayloadCoherence({
      summary: fixture.summary,
      summaryValidatorPayload: fixture.summaryValidatorPayload,
      reportSchemaValidatorPayload: fixture.reportSchemaValidatorPayload,
      validatorResultVerifierPayload: fixture.validatorResultVerifierPayload,
      schemaValidatorPayload: fixture.schemaValidatorPayload,
      artifactContracts: fixture.artifactContracts,
      expectedCaseSchemaPath: path.resolve(process.cwd(), 'schemas', 'compat-case-report.schema.json')
    })).toThrow('selected total mismatch between summary and validator-result payload');
  });

  it('detects report-schema summary-schema path drift from summary contract', () => {
    const fixture = buildBaseFixtureState();
    fixture.reportSchemaValidatorPayload.summarySchemaPath = '/tmp/drifted-summary.schema.json';
    expect(() => ensureCrossPayloadCoherence({
      summary: fixture.summary,
      summaryValidatorPayload: fixture.summaryValidatorPayload,
      reportSchemaValidatorPayload: fixture.reportSchemaValidatorPayload,
      validatorResultVerifierPayload: fixture.validatorResultVerifierPayload,
      schemaValidatorPayload: fixture.schemaValidatorPayload,
      artifactContracts: fixture.artifactContracts,
      expectedCaseSchemaPath: path.resolve(process.cwd(), 'schemas', 'compat-case-report.schema.json')
    })).toThrow('report-schema-validator summarySchemaPath mismatch for summary artifact contract');
  });

  it('detects report-schema case-schema path drift from active case contract', () => {
    const fixture = buildBaseFixtureState();
    fixture.reportSchemaValidatorPayload.caseSchemaPath = '/tmp/drifted-case.schema.json';
    expect(() => ensureCrossPayloadCoherence({
      summary: fixture.summary,
      summaryValidatorPayload: fixture.summaryValidatorPayload,
      reportSchemaValidatorPayload: fixture.reportSchemaValidatorPayload,
      validatorResultVerifierPayload: fixture.validatorResultVerifierPayload,
      schemaValidatorPayload: fixture.schemaValidatorPayload,
      artifactContracts: fixture.artifactContracts,
      expectedCaseSchemaPath: path.resolve(process.cwd(), 'schemas', 'compat-case-report.schema.json')
    })).toThrow('report-schema-validator caseSchemaPath mismatch for active case-report contract');
  });

  it('enforces require-ok status gate', () => {
    const fixture = buildBaseFixtureState();
    expect(() => ensureRequireOkStatuses({
      requireOk: true,
      reportSchemaValidatorPayload: fixture.reportSchemaValidatorPayload,
      summaryValidatorPayload: fixture.summaryValidatorPayload,
      schemaValidatorPayload: fixture.schemaValidatorPayload,
      validatorResultVerifierPayload: fixture.validatorResultVerifierPayload,
      artifactBundleManifestValidatorPayload: fixture.artifactBundleManifestValidatorPayload
    })).not.toThrow();

    fixture.validatorResultVerifierPayload.status = 'error';
    expect(() => ensureRequireOkStatuses({
      requireOk: true,
      reportSchemaValidatorPayload: fixture.reportSchemaValidatorPayload,
      summaryValidatorPayload: fixture.summaryValidatorPayload,
      schemaValidatorPayload: fixture.schemaValidatorPayload,
      validatorResultVerifierPayload: fixture.validatorResultVerifierPayload,
      artifactBundleManifestValidatorPayload: fixture.artifactBundleManifestValidatorPayload
    })).toThrow('validator-result-verifier-result status is "error"');
  });

  it('validates manifest validator coherence and detects artifact list drift', () => {
    const fixture = buildBaseFixtureState();
    expect(() => ensureManifestValidatorPayloadCoherence({
      artifactBundleManifestValidatorPayload: fixture.artifactBundleManifestValidatorPayload,
      artifactContracts: fixture.artifactContracts,
      artifactContractEntries: fixture.artifactContractEntries
    })).not.toThrow();

    fixture.artifactBundleManifestValidatorPayload.artifacts = [
      ...fixture.artifactBundleManifestValidatorPayload.artifacts.slice(0, -1),
      'drifted-artifact.json'
    ];
    expect(() => ensureManifestValidatorPayloadCoherence({
      artifactBundleManifestValidatorPayload: fixture.artifactBundleManifestValidatorPayload,
      artifactContracts: fixture.artifactContracts,
      artifactContractEntries: fixture.artifactContractEntries
    })).toThrow('artifacts list does not match active manifest order');
  });

  it('validates artifact contract version parity and detects schema/version drift', () => {
    const fixture = buildBaseFixtureState();
    const artifactContractEntries = fixture.artifactContracts.map((entry) => ({
      artifactName: entry.artifactName,
      schemaId: entry.schemaId,
      versionField: entry.versionField,
      expectedSchemaVersion: 1,
      actualSchemaVersion: 1
    }));

    expect(() => ensureArtifactContractVersionParity(artifactContractEntries, fixture.artifactContracts)).not.toThrow();

    const schemaDriftEntries = artifactContractEntries.map((entry) => ({ ...entry }));
    schemaDriftEntries[0].schemaId = 'https://clawvault.dev/schemas/drifted.schema.json';
    expect(() => ensureArtifactContractVersionParity(schemaDriftEntries, fixture.artifactContracts))
      .toThrow('artifact contract schemaId mismatch');

    const versionDriftEntries = artifactContractEntries.map((entry) => ({ ...entry }));
    versionDriftEntries[1].actualSchemaVersion = 2;
    expect(() => ensureArtifactContractVersionParity(versionDriftEntries, fixture.artifactContracts))
      .toThrow('artifact contract version mismatch');
  });

  it('detects manifest validator expected-schema-version drift', () => {
    const fixture = buildBaseFixtureState();
    fixture.artifactBundleManifestValidatorPayload.schemaContracts = fixture.artifactBundleManifestValidatorPayload.schemaContracts.map(
      (entry, index) => (index === 0 ? { ...entry, expectedSchemaVersion: 2 } : entry)
    );
    expect(() => ensureManifestValidatorPayloadCoherence({
      artifactBundleManifestValidatorPayload: fixture.artifactBundleManifestValidatorPayload,
      artifactContracts: fixture.artifactContracts,
      artifactContractEntries: fixture.artifactContractEntries
    })).toThrow('expectedSchemaVersion mismatch');
  });
});
