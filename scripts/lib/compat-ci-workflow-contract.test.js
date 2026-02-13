import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  REQUIRED_COMPAT_CI_JOB_NAME,
  REQUIRED_COMPAT_CI_JOB_NAMES,
  REQUIRED_COMPAT_CI_JOB_FIELD_NAME_SEQUENCES,
  REQUIRED_COMPAT_CI_JOB_TOP_LEVEL_SCALAR_VALUE_CONTRACTS,
  REQUIRED_COMPAT_CI_JOB_STEP_NAME_SEQUENCES,
  REQUIRED_COMPAT_CI_JOB_RUNS_ON,
  REQUIRED_COMPAT_CI_JOB_TIMEOUT_MINUTES,
  REQUIRED_COMPAT_CI_JOB_FIELD_NAMES,
  REQUIRED_COMPAT_CI_JOB_UNIQUE_FIELD_NAME_SEQUENCES,
  REQUIRED_COMPAT_CI_CHECKOUT_STEP_NAME,
  REQUIRED_COMPAT_CI_CHECKOUT_USES,
  REQUIRED_COMPAT_CI_FAILURE_UPLOAD_ARTIFACT_NAME,
  REQUIRED_COMPAT_CI_FAILURE_UPLOAD_CONDITION,
  REQUIRED_COMPAT_CI_FAILURE_UPLOAD_IF_NO_FILES_FOUND,
  REQUIRED_COMPAT_CI_FAILURE_UPLOAD_PATH,
  REQUIRED_COMPAT_CI_FAILURE_UPLOAD_STEP_NAME,
  REQUIRED_COMPAT_CI_FAILURE_UPLOAD_USES,
  REQUIRED_COMPAT_CI_WORKFLOW_NAME,
  REQUIRED_COMPAT_CI_WORKFLOW_FIELD_NAMES,
  REQUIRED_COMPAT_CI_WORKFLOW_UNIQUE_FIELD_NAMES,
  REQUIRED_COMPAT_CI_TRIGGER_PUSH_BRANCHES,
  REQUIRED_COMPAT_CI_TRIGGER_NAMES,
  REQUIRED_COMPAT_CI_TRIGGER_SECTION_FIELD_NAME_SEQUENCES,
  REQUIRED_COMPAT_CI_INSTALL_COMMAND,
  REQUIRED_COMPAT_CI_INSTALL_STEP_NAME,
  REQUIRED_COMPAT_CI_PRIMARY_RUN_COMMAND,
  REQUIRED_COMPAT_CI_REPORT_DIR_ENV_KEY,
  REQUIRED_COMPAT_CI_REPORT_DIR_ENV_VALUE,
  REQUIRED_COMPAT_CI_PRIMARY_RUN_STEP_NAME,
  REQUIRED_COMPAT_CI_SETUP_NODE_CACHE,
  REQUIRED_COMPAT_CI_SETUP_NODE_STEP_NAME,
  REQUIRED_COMPAT_CI_SETUP_NODE_USES,
  REQUIRED_COMPAT_CI_SETUP_NODE_VERSION,
  REQUIRED_COMPAT_CI_STEP_ENV_SCALAR_VALUE_CONTRACTS,
  REQUIRED_COMPAT_CI_STEP_TOP_LEVEL_SCALAR_VALUE_CONTRACTS,
  REQUIRED_COMPAT_CI_STEP_WITH_SCALAR_VALUE_CONTRACTS,
  REQUIRED_COMPAT_CI_STEP_ENV_FIELD_NAME_SEQUENCES,
  REQUIRED_COMPAT_CI_STEP_WITH_FIELD_NAME_SEQUENCES,
  REQUIRED_COMPAT_CI_STEP_FIELD_NAME_SEQUENCES,
  REQUIRED_COMPAT_CI_STEP_NAMES,
  REQUIRED_COMPAT_CI_UPLOAD_ARTIFACT_NAME,
  REQUIRED_COMPAT_CI_UPLOAD_CONDITION,
  REQUIRED_COMPAT_CI_UPLOAD_ARTIFACT_FILES,
  REQUIRED_COMPAT_CI_UPLOAD_IF_NO_FILES_FOUND,
  REQUIRED_COMPAT_CI_UPLOAD_ARTIFACT_PATH_PREFIX,
  REQUIRED_COMPAT_CI_UPLOAD_STEP_NAME,
  REQUIRED_COMPAT_CI_UPLOAD_USES
} from './compat-npm-script-contracts.mjs';
import {
  buildWorkflowDomainConsistencySnapshot,
  buildWorkflowJobsContractSnapshot,
  buildWorkflowContractSnapshot,
  countTopLevelFieldOccurrences,
  countJobNameOccurrences,
  extractJobNameCounts,
  countScalarFieldOccurrences,
  extractScalarFieldNameCounts,
  countStepNameOccurrences,
  extractStepNameCounts,
  extractEnvField,
  extractJobBlock,
  extractJobTopLevelFieldNames,
  extractRunCommand,
  extractScalarField,
  extractStepFieldNames,
  extractStepBlock,
  extractStepMetadata,
  extractPushBranches,
  extractTopLevelJobNames,
  extractTopLevelFieldNames,
  extractTopLevelFieldNameCounts,
  extractOnTriggerNames,
  extractOnTriggerSectionFieldNames,
  extractNestedSectionFieldNames,
  extractNestedSectionListOrMultilineFieldValues,
  extractNestedSectionScalarFieldMap,
  extractStepNames,
  extractUploadArtifactPaths,
  extractUsesField,
  extractWorkflowName,
  hasPullRequestTrigger
} from './compat-ci-workflow-test-utils.js';
import {
  expectEachDomainValueOccursExactlyOnce,
  expectUniqueDomainCountMapByKeyParity,
  expectUniqueDomainCountMapParity
} from './compat-contract-assertion-test-utils.js';

function loadCiWorkflowYaml() {
  const workflowPath = path.resolve(process.cwd(), '.github', 'workflows', 'ci.yml');
  return fs.readFileSync(workflowPath, 'utf-8');
}

function compactDefinedSectionMap(sectionMapByName) {
  return Object.fromEntries(
    Object.entries(sectionMapByName)
      .filter(([, fieldNames]) => Array.isArray(fieldNames))
  );
}

function compactDefinedSectionMapByJob(stepSectionFieldMapByJob) {
  return Object.fromEntries(
    Object.entries(stepSectionFieldMapByJob)
      .map(([jobName, sectionMap]) => [jobName, compactDefinedSectionMap(sectionMap)])
  );
}

describe('compat ci workflow contract', () => {
  it('keeps workflow identity and top-level fields aligned with contracts', () => {
    const workflowYaml = loadCiWorkflowYaml();
    expect(extractWorkflowName(workflowYaml)).toBe(REQUIRED_COMPAT_CI_WORKFLOW_NAME);
    expect(extractTopLevelFieldNames(workflowYaml)).toEqual(REQUIRED_COMPAT_CI_WORKFLOW_FIELD_NAMES);
    expectEachDomainValueOccursExactlyOnce(
      REQUIRED_COMPAT_CI_WORKFLOW_UNIQUE_FIELD_NAMES,
      (fieldName) => countTopLevelFieldOccurrences(workflowYaml, fieldName),
      'workflow unique top-level fields'
    );
  });

  it('keeps workflow top-level field count map aligned with uniqueness contracts', () => {
    const workflowYaml = loadCiWorkflowYaml();
    expectUniqueDomainCountMapParity(
      REQUIRED_COMPAT_CI_WORKFLOW_UNIQUE_FIELD_NAMES,
      extractTopLevelFieldNameCounts(workflowYaml),
      'workflow top-level fields'
    );
  });

  it('keeps workflow domain consistency snapshot aligned with canonical uniqueness contracts', () => {
    const workflowYaml = loadCiWorkflowYaml();
    const consistencySnapshot = buildWorkflowDomainConsistencySnapshot({
      workflowYaml,
      jobNames: REQUIRED_COMPAT_CI_JOB_NAMES
    });
    expectUniqueDomainCountMapParity(
      REQUIRED_COMPAT_CI_WORKFLOW_UNIQUE_FIELD_NAMES,
      consistencySnapshot.topLevelFieldNameCounts,
      'workflow consistency snapshot top-level fields'
    );
    expectUniqueDomainCountMapParity(
      REQUIRED_COMPAT_CI_JOB_NAMES,
      consistencySnapshot.jobNameCounts,
      'workflow consistency snapshot job names'
    );
    expectUniqueDomainCountMapByKeyParity(
      REQUIRED_COMPAT_CI_JOB_STEP_NAME_SEQUENCES,
      consistencySnapshot.stepNameCountsByJobName,
      'workflow consistency snapshot step-name counts by job'
    );
  });

  it('keeps workflow trigger domain aligned with push + pull-request contracts', () => {
    const workflowYaml = loadCiWorkflowYaml();
    expect(extractOnTriggerNames(workflowYaml)).toEqual(REQUIRED_COMPAT_CI_TRIGGER_NAMES);
    for (const [triggerName, expectedFieldNames] of Object.entries(REQUIRED_COMPAT_CI_TRIGGER_SECTION_FIELD_NAME_SEQUENCES)) {
      expect(extractOnTriggerSectionFieldNames(workflowYaml, triggerName)).toEqual(expectedFieldNames);
    }
    expect(extractPushBranches(workflowYaml)).toEqual(REQUIRED_COMPAT_CI_TRIGGER_PUSH_BRANCHES);
    expect(hasPullRequestTrigger(workflowYaml)).toBe(true);
  });

  it('matches canonical CI workflow contract snapshot across workflow/job/step surfaces', () => {
    const workflowYaml = loadCiWorkflowYaml();
    const snapshot = buildWorkflowContractSnapshot({
      workflowYaml,
      jobName: REQUIRED_COMPAT_CI_JOB_NAME,
      stepNames: REQUIRED_COMPAT_CI_STEP_NAMES
    });

    expect({
      workflowName: snapshot.workflowName,
      topLevelFieldNames: snapshot.topLevelFieldNames,
      triggerNames: snapshot.triggerNames,
      triggerSectionFieldNamesByTrigger: snapshot.triggerSectionFieldNamesByTrigger,
      pushBranches: snapshot.pushBranches,
      pullRequestTrigger: snapshot.pullRequestTrigger,
      jobNames: snapshot.jobNames,
      jobName: snapshot.jobName,
      jobTopLevelFieldNames: snapshot.jobTopLevelFieldNames,
      jobRunsOn: snapshot.jobRunsOn,
      jobTimeoutMinutes: snapshot.jobTimeoutMinutes,
      stepNames: snapshot.stepNames,
      stepTopLevelFieldNamesByName: snapshot.stepTopLevelFieldNamesByName,
      stepWithFieldNamesByName: compactDefinedSectionMap(snapshot.stepWithFieldNamesByName),
      stepEnvFieldNamesByName: compactDefinedSectionMap(snapshot.stepEnvFieldNamesByName)
    }).toEqual({
      workflowName: REQUIRED_COMPAT_CI_WORKFLOW_NAME,
      topLevelFieldNames: REQUIRED_COMPAT_CI_WORKFLOW_FIELD_NAMES,
      triggerNames: REQUIRED_COMPAT_CI_TRIGGER_NAMES,
      triggerSectionFieldNamesByTrigger: REQUIRED_COMPAT_CI_TRIGGER_SECTION_FIELD_NAME_SEQUENCES,
      pushBranches: REQUIRED_COMPAT_CI_TRIGGER_PUSH_BRANCHES,
      pullRequestTrigger: true,
      jobNames: REQUIRED_COMPAT_CI_JOB_NAMES,
      jobName: REQUIRED_COMPAT_CI_JOB_NAME,
      jobTopLevelFieldNames: REQUIRED_COMPAT_CI_JOB_FIELD_NAMES,
      jobRunsOn: REQUIRED_COMPAT_CI_JOB_RUNS_ON,
      jobTimeoutMinutes: REQUIRED_COMPAT_CI_JOB_TIMEOUT_MINUTES,
      stepNames: REQUIRED_COMPAT_CI_STEP_NAMES,
      stepTopLevelFieldNamesByName: REQUIRED_COMPAT_CI_STEP_FIELD_NAME_SEQUENCES,
      stepWithFieldNamesByName: REQUIRED_COMPAT_CI_STEP_WITH_FIELD_NAME_SEQUENCES,
      stepEnvFieldNamesByName: REQUIRED_COMPAT_CI_STEP_ENV_FIELD_NAME_SEQUENCES
    });
  });

  it('matches canonical CI job-domain snapshot map for required jobs', () => {
    const workflowYaml = loadCiWorkflowYaml();
    const jobSnapshotsByName = buildWorkflowJobsContractSnapshot({
      workflowYaml,
      stepNamesByJobName: REQUIRED_COMPAT_CI_JOB_STEP_NAME_SEQUENCES
    });

    expect({
      jobNames: Object.keys(jobSnapshotsByName),
      jobTopLevelFieldNamesByName: Object.fromEntries(
        Object.entries(jobSnapshotsByName).map(([jobName, snapshot]) => [jobName, snapshot.jobTopLevelFieldNames])
      ),
      jobTopLevelScalarValuesByName: Object.fromEntries(
        Object.entries(jobSnapshotsByName).map(([jobName, snapshot]) => [
          jobName,
          {
            'runs-on': snapshot.jobRunsOn,
            'timeout-minutes': snapshot.jobTimeoutMinutes
          }
        ])
      ),
      stepNamesByJobName: Object.fromEntries(
        Object.entries(jobSnapshotsByName).map(([jobName, snapshot]) => [jobName, snapshot.stepNames])
      ),
      stepTopLevelFieldNamesByJobName: Object.fromEntries(
        Object.entries(jobSnapshotsByName).map(([jobName, snapshot]) => [jobName, snapshot.stepTopLevelFieldNamesByName])
      ),
      stepWithFieldNamesByJobName: compactDefinedSectionMapByJob(
        Object.fromEntries(
          Object.entries(jobSnapshotsByName).map(([jobName, snapshot]) => [jobName, snapshot.stepWithFieldNamesByName])
        )
      ),
      stepEnvFieldNamesByJobName: compactDefinedSectionMapByJob(
        Object.fromEntries(
          Object.entries(jobSnapshotsByName).map(([jobName, snapshot]) => [jobName, snapshot.stepEnvFieldNamesByName])
        )
      )
    }).toEqual({
      jobNames: REQUIRED_COMPAT_CI_JOB_NAMES,
      jobTopLevelFieldNamesByName: REQUIRED_COMPAT_CI_JOB_FIELD_NAME_SEQUENCES,
      jobTopLevelScalarValuesByName: REQUIRED_COMPAT_CI_JOB_TOP_LEVEL_SCALAR_VALUE_CONTRACTS,
      stepNamesByJobName: REQUIRED_COMPAT_CI_JOB_STEP_NAME_SEQUENCES,
      stepTopLevelFieldNamesByJobName: {
        [REQUIRED_COMPAT_CI_JOB_NAME]: REQUIRED_COMPAT_CI_STEP_FIELD_NAME_SEQUENCES
      },
      stepWithFieldNamesByJobName: {
        [REQUIRED_COMPAT_CI_JOB_NAME]: REQUIRED_COMPAT_CI_STEP_WITH_FIELD_NAME_SEQUENCES
      },
      stepEnvFieldNamesByJobName: {
        [REQUIRED_COMPAT_CI_JOB_NAME]: REQUIRED_COMPAT_CI_STEP_ENV_FIELD_NAME_SEQUENCES
      }
    });
  });

  it('matches canonical CI step-domain snapshot map via discovered step extraction', () => {
    const workflowYaml = loadCiWorkflowYaml();
    const jobSnapshotsByName = buildWorkflowJobsContractSnapshot({
      workflowYaml,
      jobNames: REQUIRED_COMPAT_CI_JOB_NAMES
    });

    expect({
      stepNamesByJobName: Object.fromEntries(
        Object.entries(jobSnapshotsByName).map(([jobName, snapshot]) => [jobName, snapshot.stepNames])
      ),
      stepTopLevelFieldNamesByJobName: Object.fromEntries(
        Object.entries(jobSnapshotsByName).map(([jobName, snapshot]) => [jobName, snapshot.stepTopLevelFieldNamesByName])
      ),
      stepWithFieldNamesByJobName: compactDefinedSectionMapByJob(
        Object.fromEntries(
          Object.entries(jobSnapshotsByName).map(([jobName, snapshot]) => [jobName, snapshot.stepWithFieldNamesByName])
        )
      ),
      stepEnvFieldNamesByJobName: compactDefinedSectionMapByJob(
        Object.fromEntries(
          Object.entries(jobSnapshotsByName).map(([jobName, snapshot]) => [jobName, snapshot.stepEnvFieldNamesByName])
        )
      )
    }).toEqual({
      stepNamesByJobName: REQUIRED_COMPAT_CI_JOB_STEP_NAME_SEQUENCES,
      stepTopLevelFieldNamesByJobName: {
        [REQUIRED_COMPAT_CI_JOB_NAME]: REQUIRED_COMPAT_CI_STEP_FIELD_NAME_SEQUENCES
      },
      stepWithFieldNamesByJobName: {
        [REQUIRED_COMPAT_CI_JOB_NAME]: REQUIRED_COMPAT_CI_STEP_WITH_FIELD_NAME_SEQUENCES
      },
      stepEnvFieldNamesByJobName: {
        [REQUIRED_COMPAT_CI_JOB_NAME]: REQUIRED_COMPAT_CI_STEP_ENV_FIELD_NAME_SEQUENCES
      }
    });
  });

  it('keeps required CI job declarations unique in workflow', () => {
    const workflowYaml = loadCiWorkflowYaml();
    expect(extractTopLevelJobNames(workflowYaml)).toEqual(REQUIRED_COMPAT_CI_JOB_NAMES);
    expectEachDomainValueOccursExactlyOnce(
      REQUIRED_COMPAT_CI_JOB_NAMES,
      (jobName) => countJobNameOccurrences(workflowYaml, jobName),
      'required CI job declarations'
    );
  });

  it('keeps CI job count map aligned with required job uniqueness contracts', () => {
    const workflowYaml = loadCiWorkflowYaml();
    expectUniqueDomainCountMapParity(
      REQUIRED_COMPAT_CI_JOB_NAMES,
      extractJobNameCounts(workflowYaml),
      'workflow job-name counts'
    );
  });

  it('keeps CI job identity and runtime envelope aligned with contracts', () => {
    const workflowYaml = loadCiWorkflowYaml();
    const ciJobBlock = extractJobBlock(workflowYaml, REQUIRED_COMPAT_CI_JOB_NAME);
    expect(ciJobBlock, `missing CI workflow job: ${REQUIRED_COMPAT_CI_JOB_NAME}`).toBeTruthy();
    expect(extractJobTopLevelFieldNames(ciJobBlock)).toEqual(REQUIRED_COMPAT_CI_JOB_FIELD_NAMES);
    expect(extractScalarField(ciJobBlock, 'runs-on')).toBe(REQUIRED_COMPAT_CI_JOB_RUNS_ON);
    expect(extractScalarField(ciJobBlock, 'timeout-minutes')).toBe(REQUIRED_COMPAT_CI_JOB_TIMEOUT_MINUTES);
  });

  it('keeps required job-level fields unique within each required CI job', () => {
    const workflowYaml = loadCiWorkflowYaml();
    for (const [jobName, uniqueFieldNames] of Object.entries(REQUIRED_COMPAT_CI_JOB_UNIQUE_FIELD_NAME_SEQUENCES)) {
      const jobBlock = extractJobBlock(workflowYaml, jobName);
      expect(jobBlock, `missing CI workflow job: ${jobName}`).toBeTruthy();
      const scalarFieldNameCounts = extractScalarFieldNameCounts(jobBlock);
      expectEachDomainValueOccursExactlyOnce(
        uniqueFieldNames,
        (fieldName) => countScalarFieldOccurrences(jobBlock, fieldName),
        `required job-level fields in ${jobName}`
      );
      expectEachDomainValueOccursExactlyOnce(
        uniqueFieldNames,
        (fieldName) => scalarFieldNameCounts[fieldName] ?? 0,
        `required job-level scalar field count-map in ${jobName}`
      );
    }
  });

  it('keeps required CI step sequences ordered within each required job', () => {
    const workflowYaml = loadCiWorkflowYaml();
    for (const [jobName, requiredStepNames] of Object.entries(REQUIRED_COMPAT_CI_JOB_STEP_NAME_SEQUENCES)) {
      const jobBlock = extractJobBlock(workflowYaml, jobName);
      expect(jobBlock, `missing CI workflow job: ${jobName}`).toBeTruthy();
      let previousStepStartIndex = -1;
      for (const stepName of requiredStepNames) {
        const stepMetadata = extractStepMetadata(jobBlock, stepName);
        expect(stepMetadata, `missing CI workflow step: ${stepName} in ${jobName}`).toBeTruthy();
        const { startIndex } = stepMetadata;
        expect(
          startIndex,
          `step "${stepName}" appears before previous required CI step in sequence for ${jobName}`
        ).toBeGreaterThan(previousStepStartIndex);
        previousStepStartIndex = startIndex;
      }
    }
  });

  it('keeps required CI steps unique within each required job', () => {
    const workflowYaml = loadCiWorkflowYaml();
    for (const [jobName, requiredStepNames] of Object.entries(REQUIRED_COMPAT_CI_JOB_STEP_NAME_SEQUENCES)) {
      const jobBlock = extractJobBlock(workflowYaml, jobName);
      expect(jobBlock, `missing CI workflow job: ${jobName}`).toBeTruthy();
      expectEachDomainValueOccursExactlyOnce(
        requiredStepNames,
        (stepName) => countStepNameOccurrences(jobBlock, stepName),
        `required CI steps in ${jobName}`
      );
    }
  });

  it('keeps CI step-name count map aligned with required step uniqueness contracts', () => {
    const workflowYaml = loadCiWorkflowYaml();
    for (const [jobName, requiredStepNames] of Object.entries(REQUIRED_COMPAT_CI_JOB_STEP_NAME_SEQUENCES)) {
      const jobBlock = extractJobBlock(workflowYaml, jobName);
      expect(jobBlock, `missing CI workflow job: ${jobName}`).toBeTruthy();
      expectUniqueDomainCountMapParity(
        requiredStepNames,
        extractStepNameCounts(jobBlock),
        `step-name counts for ${jobName}`
      );
    }
  });

  it('keeps CI step-name domain exact for compat job', () => {
    const workflowYaml = loadCiWorkflowYaml();
    const ciJobBlock = extractJobBlock(workflowYaml, REQUIRED_COMPAT_CI_JOB_NAME);
    expect(ciJobBlock, `missing CI workflow job: ${REQUIRED_COMPAT_CI_JOB_NAME}`).toBeTruthy();
    expect(extractStepNames(ciJobBlock)).toEqual(REQUIRED_COMPAT_CI_STEP_NAMES);
  });

  it('keeps canonical top-level field-name domain for each required CI step', () => {
    const workflowYaml = loadCiWorkflowYaml();
    const ciJobBlock = extractJobBlock(workflowYaml, REQUIRED_COMPAT_CI_JOB_NAME);
    expect(ciJobBlock, `missing CI workflow job: ${REQUIRED_COMPAT_CI_JOB_NAME}`).toBeTruthy();
    for (const [stepName, expectedFieldNames] of Object.entries(REQUIRED_COMPAT_CI_STEP_FIELD_NAME_SEQUENCES)) {
      const stepBlock = extractStepBlock(ciJobBlock, stepName);
      expect(stepBlock, `missing CI workflow step: ${stepName}`).toBeTruthy();
      expect(extractStepFieldNames(stepBlock)).toEqual(expectedFieldNames);
    }
  });

  it('keeps canonical nested with/env field-name domains for required CI steps', () => {
    const workflowYaml = loadCiWorkflowYaml();
    const ciJobBlock = extractJobBlock(workflowYaml, REQUIRED_COMPAT_CI_JOB_NAME);
    expect(ciJobBlock, `missing CI workflow job: ${REQUIRED_COMPAT_CI_JOB_NAME}`).toBeTruthy();

    for (const [stepName, expectedWithFieldNames] of Object.entries(REQUIRED_COMPAT_CI_STEP_WITH_FIELD_NAME_SEQUENCES)) {
      const stepBlock = extractStepBlock(ciJobBlock, stepName);
      expect(stepBlock, `missing CI workflow step: ${stepName}`).toBeTruthy();
      expect(extractNestedSectionFieldNames(stepBlock, 'with')).toEqual(expectedWithFieldNames);
    }

    for (const [stepName, expectedEnvFieldNames] of Object.entries(REQUIRED_COMPAT_CI_STEP_ENV_FIELD_NAME_SEQUENCES)) {
      const stepBlock = extractStepBlock(ciJobBlock, stepName);
      expect(stepBlock, `missing CI workflow step: ${stepName}`).toBeTruthy();
      expect(extractNestedSectionFieldNames(stepBlock, 'env')).toEqual(expectedEnvFieldNames);
    }
  });

  it('keeps canonical scalar value contracts for top-level and nested step fields', () => {
    const workflowYaml = loadCiWorkflowYaml();
    const ciJobBlock = extractJobBlock(workflowYaml, REQUIRED_COMPAT_CI_JOB_NAME);
    expect(ciJobBlock, `missing CI workflow job: ${REQUIRED_COMPAT_CI_JOB_NAME}`).toBeTruthy();

    for (const [stepName, scalarValueContracts] of Object.entries(REQUIRED_COMPAT_CI_STEP_TOP_LEVEL_SCALAR_VALUE_CONTRACTS)) {
      const stepBlock = extractStepBlock(ciJobBlock, stepName);
      expect(stepBlock, `missing CI workflow step: ${stepName}`).toBeTruthy();
      for (const [fieldName, expectedValue] of Object.entries(scalarValueContracts)) {
        expect(
          extractScalarField(stepBlock, fieldName),
          `unexpected top-level scalar field value for step=${stepName} field=${fieldName}`
        ).toBe(expectedValue);
      }
    }

    for (const [stepName, scalarValueContracts] of Object.entries(REQUIRED_COMPAT_CI_STEP_WITH_SCALAR_VALUE_CONTRACTS)) {
      const stepBlock = extractStepBlock(ciJobBlock, stepName);
      expect(stepBlock, `missing CI workflow step: ${stepName}`).toBeTruthy();
      const withFieldMap = extractNestedSectionScalarFieldMap(stepBlock, 'with');
      expect(withFieldMap, `missing with-section field map for step=${stepName}`).toBeTruthy();
      for (const [fieldName, expectedValue] of Object.entries(scalarValueContracts)) {
        expect(withFieldMap[fieldName], `unexpected nested with-field value for step=${stepName} field=${fieldName}`).toBe(expectedValue);
      }
    }

    for (const [stepName, scalarValueContracts] of Object.entries(REQUIRED_COMPAT_CI_STEP_ENV_SCALAR_VALUE_CONTRACTS)) {
      const stepBlock = extractStepBlock(ciJobBlock, stepName);
      expect(stepBlock, `missing CI workflow step: ${stepName}`).toBeTruthy();
      const envFieldMap = extractNestedSectionScalarFieldMap(stepBlock, 'env');
      expect(envFieldMap, `missing env-section field map for step=${stepName}`).toBeTruthy();
      for (const [fieldName, expectedValue] of Object.entries(scalarValueContracts)) {
        expect(envFieldMap[fieldName], `unexpected nested env-field value for step=${stepName} field=${fieldName}`).toBe(expectedValue);
      }
    }
  });

  it('keeps checkout/setup/install steps aligned with canonical CI environment contracts', () => {
    const workflowYaml = loadCiWorkflowYaml();
    const ciJobBlock = extractJobBlock(workflowYaml, REQUIRED_COMPAT_CI_JOB_NAME);
    expect(ciJobBlock, `missing CI workflow job: ${REQUIRED_COMPAT_CI_JOB_NAME}`).toBeTruthy();
    const checkoutStepBlock = extractStepBlock(ciJobBlock, REQUIRED_COMPAT_CI_CHECKOUT_STEP_NAME);
    const setupNodeStepBlock = extractStepBlock(ciJobBlock, REQUIRED_COMPAT_CI_SETUP_NODE_STEP_NAME);
    const installStepBlock = extractStepBlock(ciJobBlock, REQUIRED_COMPAT_CI_INSTALL_STEP_NAME);
    expect(checkoutStepBlock, `missing CI workflow step: ${REQUIRED_COMPAT_CI_CHECKOUT_STEP_NAME}`).toBeTruthy();
    expect(setupNodeStepBlock, `missing CI workflow step: ${REQUIRED_COMPAT_CI_SETUP_NODE_STEP_NAME}`).toBeTruthy();
    expect(installStepBlock, `missing CI workflow step: ${REQUIRED_COMPAT_CI_INSTALL_STEP_NAME}`).toBeTruthy();
    expect(extractUsesField(checkoutStepBlock)).toBe(REQUIRED_COMPAT_CI_CHECKOUT_USES);
    expect(extractUsesField(setupNodeStepBlock)).toBe(REQUIRED_COMPAT_CI_SETUP_NODE_USES);
    expect(extractScalarField(setupNodeStepBlock, 'node-version')).toBe(
      REQUIRED_COMPAT_CI_SETUP_NODE_VERSION
    );
    expect(extractScalarField(setupNodeStepBlock, 'cache')).toBe(
      REQUIRED_COMPAT_CI_SETUP_NODE_CACHE
    );
    expect(extractRunCommand(installStepBlock)).toBe(REQUIRED_COMPAT_CI_INSTALL_COMMAND);
  });

  it('runs canonical ci command from primary run step', () => {
    const workflowYaml = loadCiWorkflowYaml();
    const ciJobBlock = extractJobBlock(workflowYaml, REQUIRED_COMPAT_CI_JOB_NAME);
    expect(ciJobBlock, `missing CI workflow job: ${REQUIRED_COMPAT_CI_JOB_NAME}`).toBeTruthy();
    const stepBlock = extractStepBlock(ciJobBlock, REQUIRED_COMPAT_CI_PRIMARY_RUN_STEP_NAME);
    expect(stepBlock, `missing CI workflow step: ${REQUIRED_COMPAT_CI_PRIMARY_RUN_STEP_NAME}`).toBeTruthy();
    const runCommand = extractRunCommand(stepBlock);
    const reportDirValue = extractEnvField(stepBlock, REQUIRED_COMPAT_CI_REPORT_DIR_ENV_KEY);
    expect(runCommand).toBe(REQUIRED_COMPAT_CI_PRIMARY_RUN_COMMAND);
    expect(reportDirValue).toBe(REQUIRED_COMPAT_CI_REPORT_DIR_ENV_VALUE);
  });

  it('uploads required compatibility artifact files in canonical order', () => {
    const workflowYaml = loadCiWorkflowYaml();
    const ciJobBlock = extractJobBlock(workflowYaml, REQUIRED_COMPAT_CI_JOB_NAME);
    expect(ciJobBlock, `missing CI workflow job: ${REQUIRED_COMPAT_CI_JOB_NAME}`).toBeTruthy();
    const stepBlock = extractStepBlock(ciJobBlock, REQUIRED_COMPAT_CI_UPLOAD_STEP_NAME);
    expect(stepBlock, `missing CI workflow step: ${REQUIRED_COMPAT_CI_UPLOAD_STEP_NAME}`).toBeTruthy();
    const artifactName = extractScalarField(stepBlock, 'name');
    const stepCondition = extractScalarField(stepBlock, 'if');
    const stepUses = extractUsesField(stepBlock);
    const ifNoFilesFoundValue = extractScalarField(stepBlock, 'if-no-files-found');
    const uploadPaths = extractUploadArtifactPaths(stepBlock);
    expect(uploadPaths, `step "${REQUIRED_COMPAT_CI_UPLOAD_STEP_NAME}" must include a multiline path block`).toBeTruthy();
    const expectedPaths = REQUIRED_COMPAT_CI_UPLOAD_ARTIFACT_FILES.map(
      (artifactFile) => `${REQUIRED_COMPAT_CI_UPLOAD_ARTIFACT_PATH_PREFIX}${artifactFile}`
    );
    expect(artifactName).toBe(REQUIRED_COMPAT_CI_UPLOAD_ARTIFACT_NAME);
    expect(stepCondition).toBe(REQUIRED_COMPAT_CI_UPLOAD_CONDITION);
    expect(stepUses).toBe(REQUIRED_COMPAT_CI_UPLOAD_USES);
    expect(ifNoFilesFoundValue).toBe(REQUIRED_COMPAT_CI_UPLOAD_IF_NO_FILES_FOUND);
    expect(uploadPaths).toEqual(expectedPaths);
    expect(extractNestedSectionListOrMultilineFieldValues(stepBlock, 'with', 'path')).toEqual(expectedPaths);
  });

  it('keeps failure artifact upload step aligned with compat report directory contracts', () => {
    const workflowYaml = loadCiWorkflowYaml();
    const ciJobBlock = extractJobBlock(workflowYaml, REQUIRED_COMPAT_CI_JOB_NAME);
    expect(ciJobBlock, `missing CI workflow job: ${REQUIRED_COMPAT_CI_JOB_NAME}`).toBeTruthy();
    const stepBlock = extractStepBlock(ciJobBlock, REQUIRED_COMPAT_CI_FAILURE_UPLOAD_STEP_NAME);
    expect(stepBlock, `missing CI workflow step: ${REQUIRED_COMPAT_CI_FAILURE_UPLOAD_STEP_NAME}`).toBeTruthy();
    const ifCondition = extractScalarField(stepBlock, 'if');
    const artifactName = extractScalarField(stepBlock, 'name');
    const stepUses = extractUsesField(stepBlock);
    const uploadPath = extractScalarField(stepBlock, 'path');
    const uploadPathList = extractNestedSectionListOrMultilineFieldValues(stepBlock, 'with', 'path');
    const ifNoFilesFoundValue = extractScalarField(stepBlock, 'if-no-files-found');
    expect(ifCondition).toBe(REQUIRED_COMPAT_CI_FAILURE_UPLOAD_CONDITION);
    expect(artifactName).toBe(REQUIRED_COMPAT_CI_FAILURE_UPLOAD_ARTIFACT_NAME);
    expect(stepUses).toBe(REQUIRED_COMPAT_CI_FAILURE_UPLOAD_USES);
    expect(uploadPath).toBe(REQUIRED_COMPAT_CI_FAILURE_UPLOAD_PATH);
    expect(uploadPathList).toEqual([REQUIRED_COMPAT_CI_FAILURE_UPLOAD_PATH]);
    expect(ifNoFilesFoundValue).toBe(REQUIRED_COMPAT_CI_FAILURE_UPLOAD_IF_NO_FILES_FOUND);
  });
});
