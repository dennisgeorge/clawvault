import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  REQUIRED_COMPAT_CI_JOB_NAME,
  REQUIRED_COMPAT_CI_JOB_NAMES,
  REQUIRED_COMPAT_CI_JOB_RUNS_ON,
  REQUIRED_COMPAT_CI_JOB_TIMEOUT_MINUTES,
  REQUIRED_COMPAT_CI_JOB_UNIQUE_FIELD_NAMES,
  REQUIRED_COMPAT_CI_CHECKOUT_STEP_NAME,
  REQUIRED_COMPAT_CI_CHECKOUT_USES,
  REQUIRED_COMPAT_CI_FAILURE_UPLOAD_ARTIFACT_NAME,
  REQUIRED_COMPAT_CI_FAILURE_UPLOAD_CONDITION,
  REQUIRED_COMPAT_CI_FAILURE_UPLOAD_IF_NO_FILES_FOUND,
  REQUIRED_COMPAT_CI_FAILURE_UPLOAD_PATH,
  REQUIRED_COMPAT_CI_FAILURE_UPLOAD_STEP_NAME,
  REQUIRED_COMPAT_CI_FAILURE_UPLOAD_USES,
  REQUIRED_COMPAT_CI_WORKFLOW_NAME,
  REQUIRED_COMPAT_CI_WORKFLOW_UNIQUE_FIELD_NAMES,
  REQUIRED_COMPAT_CI_TRIGGER_PUSH_BRANCHES,
  REQUIRED_COMPAT_CI_TRIGGER_NAMES,
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
  REQUIRED_COMPAT_CI_STEP_FIELD_NAME_SEQUENCES,
  REQUIRED_COMPAT_CI_STEP_NAMES,
  REQUIRED_COMPAT_CI_STEP_SEQUENCE,
  REQUIRED_COMPAT_CI_UPLOAD_ARTIFACT_NAME,
  REQUIRED_COMPAT_CI_UPLOAD_CONDITION,
  REQUIRED_COMPAT_CI_UPLOAD_ARTIFACT_FILES,
  REQUIRED_COMPAT_CI_UPLOAD_IF_NO_FILES_FOUND,
  REQUIRED_COMPAT_CI_UPLOAD_ARTIFACT_PATH_PREFIX,
  REQUIRED_COMPAT_CI_UPLOAD_STEP_NAME,
  REQUIRED_COMPAT_CI_UPLOAD_USES
} from './compat-npm-script-contracts.mjs';
import {
  countTopLevelFieldOccurrences,
  countJobNameOccurrences,
  countScalarFieldOccurrences,
  countStepNameOccurrences,
  extractEnvField,
  extractJobBlock,
  extractRunCommand,
  extractScalarField,
  extractStepFieldNames,
  extractStepBlock,
  extractStepMetadata,
  extractPushBranches,
  extractTopLevelJobNames,
  extractOnTriggerNames,
  extractStepNames,
  extractUploadArtifactPaths,
  extractUsesField,
  extractWorkflowName,
  hasPullRequestTrigger
} from './compat-ci-workflow-test-utils.js';

function loadCiWorkflowYaml() {
  const workflowPath = path.resolve(process.cwd(), '.github', 'workflows', 'ci.yml');
  return fs.readFileSync(workflowPath, 'utf-8');
}

describe('compat ci workflow contract', () => {
  it('keeps workflow identity and top-level fields aligned with contracts', () => {
    const workflowYaml = loadCiWorkflowYaml();
    expect(extractWorkflowName(workflowYaml)).toBe(REQUIRED_COMPAT_CI_WORKFLOW_NAME);
    for (const fieldName of REQUIRED_COMPAT_CI_WORKFLOW_UNIQUE_FIELD_NAMES) {
      expect(
        countTopLevelFieldOccurrences(workflowYaml, fieldName),
        `required top-level workflow field "${fieldName}" must appear exactly once`
      ).toBe(1);
    }
  });

  it('keeps workflow trigger domain aligned with push + pull-request contracts', () => {
    const workflowYaml = loadCiWorkflowYaml();
    expect(extractOnTriggerNames(workflowYaml)).toEqual(REQUIRED_COMPAT_CI_TRIGGER_NAMES);
    expect(extractPushBranches(workflowYaml)).toEqual(REQUIRED_COMPAT_CI_TRIGGER_PUSH_BRANCHES);
    expect(hasPullRequestTrigger(workflowYaml)).toBe(true);
  });

  it('keeps compat job declaration unique in workflow', () => {
    const workflowYaml = loadCiWorkflowYaml();
    expect(extractTopLevelJobNames(workflowYaml)).toEqual(REQUIRED_COMPAT_CI_JOB_NAMES);
    expect(
      countJobNameOccurrences(workflowYaml, REQUIRED_COMPAT_CI_JOB_NAME),
      `required CI job "${REQUIRED_COMPAT_CI_JOB_NAME}" must appear exactly once`
    ).toBe(1);
  });

  it('keeps CI job identity and runtime envelope aligned with contracts', () => {
    const workflowYaml = loadCiWorkflowYaml();
    const ciJobBlock = extractJobBlock(workflowYaml, REQUIRED_COMPAT_CI_JOB_NAME);
    expect(ciJobBlock, `missing CI workflow job: ${REQUIRED_COMPAT_CI_JOB_NAME}`).toBeTruthy();
    expect(extractScalarField(ciJobBlock, 'runs-on')).toBe(REQUIRED_COMPAT_CI_JOB_RUNS_ON);
    expect(extractScalarField(ciJobBlock, 'timeout-minutes')).toBe(REQUIRED_COMPAT_CI_JOB_TIMEOUT_MINUTES);
  });

  it('keeps required job-level fields unique within compat job', () => {
    const workflowYaml = loadCiWorkflowYaml();
    const ciJobBlock = extractJobBlock(workflowYaml, REQUIRED_COMPAT_CI_JOB_NAME);
    expect(ciJobBlock, `missing CI workflow job: ${REQUIRED_COMPAT_CI_JOB_NAME}`).toBeTruthy();
    for (const fieldName of REQUIRED_COMPAT_CI_JOB_UNIQUE_FIELD_NAMES) {
      expect(
        countScalarFieldOccurrences(ciJobBlock, fieldName),
        `required job field "${fieldName}" must appear exactly once in ${REQUIRED_COMPAT_CI_JOB_NAME}`
      ).toBe(1);
    }
  });

  it('keeps core CI step sequence ordered', () => {
    const workflowYaml = loadCiWorkflowYaml();
    const ciJobBlock = extractJobBlock(workflowYaml, REQUIRED_COMPAT_CI_JOB_NAME);
    expect(ciJobBlock, `missing CI workflow job: ${REQUIRED_COMPAT_CI_JOB_NAME}`).toBeTruthy();
    let previousStepStartIndex = -1;
    for (const stepName of REQUIRED_COMPAT_CI_STEP_SEQUENCE) {
      const stepMetadata = extractStepMetadata(ciJobBlock, stepName);
      expect(stepMetadata, `missing CI workflow step: ${stepName}`).toBeTruthy();
      const { startIndex } = stepMetadata;
      expect(
        startIndex,
        `step "${stepName}" appears before previous required CI step in sequence`
      ).toBeGreaterThan(previousStepStartIndex);
      previousStepStartIndex = startIndex;
    }
  });

  it('keeps required CI steps unique within compat job', () => {
    const workflowYaml = loadCiWorkflowYaml();
    const ciJobBlock = extractJobBlock(workflowYaml, REQUIRED_COMPAT_CI_JOB_NAME);
    expect(ciJobBlock, `missing CI workflow job: ${REQUIRED_COMPAT_CI_JOB_NAME}`).toBeTruthy();
    for (const stepName of REQUIRED_COMPAT_CI_STEP_SEQUENCE) {
      expect(
        countStepNameOccurrences(ciJobBlock, stepName),
        `required CI step "${stepName}" must appear exactly once in ${REQUIRED_COMPAT_CI_JOB_NAME}`
      ).toBe(1);
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
    const ifNoFilesFoundValue = extractScalarField(stepBlock, 'if-no-files-found');
    expect(ifCondition).toBe(REQUIRED_COMPAT_CI_FAILURE_UPLOAD_CONDITION);
    expect(artifactName).toBe(REQUIRED_COMPAT_CI_FAILURE_UPLOAD_ARTIFACT_NAME);
    expect(stepUses).toBe(REQUIRED_COMPAT_CI_FAILURE_UPLOAD_USES);
    expect(uploadPath).toBe(REQUIRED_COMPAT_CI_FAILURE_UPLOAD_PATH);
    expect(ifNoFilesFoundValue).toBe(REQUIRED_COMPAT_CI_FAILURE_UPLOAD_IF_NO_FILES_FOUND);
  });
});
