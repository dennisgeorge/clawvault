export function ensureArtifactPathCoherence({
  summaryValidatorPayload,
  reportSchemaValidatorPayload,
  schemaValidatorPayload,
  validatorResultVerifierPayload,
  artifactBundleManifestValidatorPayload,
  artifactPathByName,
  reportDir,
  manifestPath
}) {
  const pathChecks = [];
  if (summaryValidatorPayload.status === 'ok') {
    pathChecks.push(
      ['validator-result summaryPath', summaryValidatorPayload.summaryPath, artifactPathByName.get('summary.json')],
      ['validator-result reportDir', summaryValidatorPayload.reportDir, reportDir]
    );
  }
  if (reportSchemaValidatorPayload.status === 'ok') {
    pathChecks.push(
      ['report-schema-validator summaryPath', reportSchemaValidatorPayload.summaryPath, artifactPathByName.get('summary.json')],
      ['report-schema-validator reportDir', reportSchemaValidatorPayload.reportDir, reportDir]
    );
  }
  if (schemaValidatorPayload.status === 'ok') {
    pathChecks.push(['schema-validator dataPath', schemaValidatorPayload.dataPath, artifactPathByName.get('validator-result.json')]);
  }
  if (validatorResultVerifierPayload.status === 'ok') {
    pathChecks.push(['validator-result verifier payloadPath', validatorResultVerifierPayload.payloadPath, artifactPathByName.get('validator-result.json')]);
  }
  if (artifactBundleManifestValidatorPayload.status === 'ok') {
    pathChecks.push(['artifact-bundle manifest validator manifestPath', artifactBundleManifestValidatorPayload.manifestPath, manifestPath]);
  }
  for (const [label, actualValue, expectedValue] of pathChecks) {
    if (actualValue !== expectedValue) {
      throw new Error(`${label} mismatch (expected ${expectedValue}, received ${String(actualValue)})`);
    }
  }
}

export function ensureCrossPayloadCoherence({
  summary,
  summaryValidatorPayload,
  reportSchemaValidatorPayload,
  validatorResultVerifierPayload,
  schemaValidatorPayload,
  artifactContracts,
  expectedCaseSchemaPath
}) {
  if (summaryValidatorPayload.status === 'ok' && summaryValidatorPayload.mode !== summary.mode) {
    throw new Error(`summary mode mismatch between summary and validator-result payload (${summary.mode} vs ${summaryValidatorPayload.mode})`);
  }
  if (reportSchemaValidatorPayload.status === 'ok' && reportSchemaValidatorPayload.mode !== summary.mode) {
    throw new Error(`summary mode mismatch between summary and report-schema-validator payload (${summary.mode} vs ${reportSchemaValidatorPayload.mode})`);
  }
  if (summaryValidatorPayload.status === 'ok') {
    const summaryResultCount = Array.isArray(summary.results) ? summary.results.length : 0;
    if (summaryValidatorPayload.summarySchemaVersion !== summary.summarySchemaVersion) {
      throw new Error(
        `summary schema version mismatch between summary and validator-result payload `
        + `(${summary.summarySchemaVersion} vs ${summaryValidatorPayload.summarySchemaVersion})`
      );
    }
    if (summaryValidatorPayload.fixtureSchemaVersion !== summary.schemaVersion) {
      throw new Error(
        `fixture schema version mismatch between summary and validator-result payload `
        + `(${summary.schemaVersion} vs ${summaryValidatorPayload.fixtureSchemaVersion})`
      );
    }
    if (summaryValidatorPayload.selectedTotal !== summary.selectedTotal) {
      throw new Error(
        `selected total mismatch between summary and validator-result payload `
        + `(${summary.selectedTotal} vs ${summaryValidatorPayload.selectedTotal})`
      );
    }
    if (summaryValidatorPayload.resultCount !== summaryResultCount) {
      throw new Error(
        `result count mismatch between summary and validator-result payload `
        + `(${summaryResultCount} vs ${summaryValidatorPayload.resultCount})`
      );
    }
  }
  if (reportSchemaValidatorPayload.status === 'ok') {
    const expectedValidatedCaseReports = reportSchemaValidatorPayload.caseReportMode === 'validated-case-reports'
      ? (Array.isArray(summary.results) ? summary.results.length : 0)
      : 0;
    if (reportSchemaValidatorPayload.validatedCaseReports !== expectedValidatedCaseReports) {
      throw new Error(
        `validated case-report count mismatch for report-schema-validator payload `
        + `(expected ${expectedValidatedCaseReports}, received ${reportSchemaValidatorPayload.validatedCaseReports})`
      );
    }
    const summarySchemaContractPath = artifactContracts.find((entry) => entry.artifactName === 'summary.json')?.schemaPathResolved;
    if (reportSchemaValidatorPayload.summarySchemaPath !== summarySchemaContractPath) {
      throw new Error(
        `report-schema-validator summarySchemaPath mismatch for summary artifact contract `
        + `(expected ${summarySchemaContractPath}, received ${reportSchemaValidatorPayload.summarySchemaPath})`
      );
    }
    if (expectedCaseSchemaPath && reportSchemaValidatorPayload.caseSchemaPath !== expectedCaseSchemaPath) {
      throw new Error(
        `report-schema-validator caseSchemaPath mismatch for active case-report contract `
        + `(expected ${expectedCaseSchemaPath}, received ${reportSchemaValidatorPayload.caseSchemaPath})`
      );
    }
  }
  if (summaryValidatorPayload.status === 'ok' && reportSchemaValidatorPayload.status === 'ok') {
    if (summaryValidatorPayload.caseReportMode !== reportSchemaValidatorPayload.caseReportMode) {
      throw new Error(
        `case-report mode mismatch between validator-result and report-schema-validator payloads `
        + `(${summaryValidatorPayload.caseReportMode} vs ${reportSchemaValidatorPayload.caseReportMode})`
      );
    }
  }
  if (validatorResultVerifierPayload.status === 'ok') {
    if (validatorResultVerifierPayload.payloadStatus !== summaryValidatorPayload.status) {
      throw new Error(
        `validator-result verifier payloadStatus mismatch `
        + `(expected ${summaryValidatorPayload.status}, received ${validatorResultVerifierPayload.payloadStatus})`
      );
    }
    if (validatorResultVerifierPayload.validatorPayloadOutputSchemaVersion !== summaryValidatorPayload.outputSchemaVersion) {
      throw new Error(
        `validator-result verifier schema-version mismatch `
        + `(expected ${summaryValidatorPayload.outputSchemaVersion}, received ${validatorResultVerifierPayload.validatorPayloadOutputSchemaVersion})`
      );
    }
  }
  if (schemaValidatorPayload.status === 'ok') {
    const validatorResultSchemaPath = artifactContracts.find((entry) => entry.artifactName === 'validator-result.json')?.schemaPathResolved;
    if (schemaValidatorPayload.schemaPath !== validatorResultSchemaPath) {
      throw new Error(
        `schema-validator schemaPath mismatch for validator-result contract `
        + `(expected ${validatorResultSchemaPath}, received ${schemaValidatorPayload.schemaPath})`
      );
    }
  }
}

export function ensureRequireOkStatuses({
  requireOk,
  reportSchemaValidatorPayload,
  summaryValidatorPayload,
  schemaValidatorPayload,
  validatorResultVerifierPayload,
  artifactBundleManifestValidatorPayload
}) {
  if (!requireOk) {
    return;
  }
  const statusChecks = [
    ['report-schema-validator-result', reportSchemaValidatorPayload.status],
    ['validator-result', summaryValidatorPayload.status],
    ['schema-validator-result', schemaValidatorPayload.status],
    ['validator-result-verifier-result', validatorResultVerifierPayload.status],
    ['artifact-bundle-manifest-validator-result', artifactBundleManifestValidatorPayload.status]
  ];
  for (const [label, status] of statusChecks) {
    if (status !== 'ok') {
      throw new Error(`${label} status is "${String(status)}" but require-ok mode is enabled`);
    }
  }
}

export function ensureArtifactContractVersionParity(artifactContractEntries, artifactContracts) {
  for (const contract of artifactContractEntries) {
    const manifestSchemaId = artifactContracts.find((entry) => entry.artifactName === contract.artifactName)?.schemaId;
    if (manifestSchemaId !== contract.schemaId) {
      throw new Error(`artifact contract schemaId mismatch for ${contract.artifactName} (manifest=${manifestSchemaId}, actual=${contract.schemaId})`);
    }
    if (contract.actualSchemaVersion !== contract.expectedSchemaVersion) {
      throw new Error(
        `artifact contract version mismatch for ${contract.artifactName} (${contract.versionField} expected ${contract.expectedSchemaVersion}, received ${contract.actualSchemaVersion})`
      );
    }
  }
}

export function ensureManifestValidatorPayloadCoherence({
  artifactBundleManifestValidatorPayload,
  artifactContracts,
  artifactContractEntries
}) {
  if (artifactBundleManifestValidatorPayload.status !== 'ok') {
    return;
  }
  const expectedArtifactNames = artifactContracts.map((entry) => entry.artifactName);
  if (artifactBundleManifestValidatorPayload.artifactCount !== expectedArtifactNames.length) {
    throw new Error(
      `artifact-bundle manifest validator artifactCount mismatch (expected ${expectedArtifactNames.length}, received ${artifactBundleManifestValidatorPayload.artifactCount})`
    );
  }
  if (
    artifactBundleManifestValidatorPayload.artifacts.length !== expectedArtifactNames.length
    || artifactBundleManifestValidatorPayload.artifacts.some((name, index) => name !== expectedArtifactNames[index])
  ) {
    throw new Error('artifact-bundle manifest validator artifacts list does not match active manifest order');
  }

  const manifestValidatorContractsByArtifactName = new Map(
    artifactBundleManifestValidatorPayload.schemaContracts.map((entry) => [entry.artifactName, entry])
  );
  if (manifestValidatorContractsByArtifactName.size !== artifactContracts.length) {
    throw new Error('artifact-bundle manifest validator schemaContracts must include exactly one entry per artifact');
  }
  for (const manifestEntry of artifactContracts) {
    const manifestValidatorEntry = manifestValidatorContractsByArtifactName.get(manifestEntry.artifactName);
    if (!manifestValidatorEntry) {
      throw new Error(`artifact-bundle manifest validator schemaContracts missing entry for ${manifestEntry.artifactName}`);
    }
    if (manifestValidatorEntry.artifactFile !== manifestEntry.artifactFile) {
      throw new Error(
        `artifact-bundle manifest validator artifactFile mismatch for ${manifestEntry.artifactName} `
        + `(expected ${manifestEntry.artifactFile}, received ${manifestValidatorEntry.artifactFile})`
      );
    }
    if (manifestValidatorEntry.schemaPath !== manifestEntry.schemaPathResolved) {
      throw new Error(
        `artifact-bundle manifest validator schemaPath mismatch for ${manifestEntry.artifactName} `
        + `(expected ${manifestEntry.schemaPathResolved}, received ${manifestValidatorEntry.schemaPath})`
      );
    }
    if (manifestValidatorEntry.schemaId !== manifestEntry.schemaId) {
      throw new Error(
        `artifact-bundle manifest validator schemaId mismatch for ${manifestEntry.artifactName} `
        + `(expected ${manifestEntry.schemaId}, received ${manifestValidatorEntry.schemaId})`
      );
    }
    if (manifestValidatorEntry.versionField !== manifestEntry.versionField) {
      throw new Error(
        `artifact-bundle manifest validator versionField mismatch for ${manifestEntry.artifactName} `
        + `(expected ${manifestEntry.versionField}, received ${manifestValidatorEntry.versionField})`
      );
    }
    const activeContractEntry = artifactContractEntries.find((entry) => entry.artifactName === manifestEntry.artifactName);
    if (!activeContractEntry) {
      throw new Error(`artifact contract entry missing for ${manifestEntry.artifactName}`);
    }
    if (manifestValidatorEntry.expectedSchemaVersion !== activeContractEntry.expectedSchemaVersion) {
      throw new Error(
        `artifact-bundle manifest validator expectedSchemaVersion mismatch for ${manifestEntry.artifactName} `
        + `(expected ${activeContractEntry.expectedSchemaVersion}, received ${manifestValidatorEntry.expectedSchemaVersion})`
      );
    }
  }
}
