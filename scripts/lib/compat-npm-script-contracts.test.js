import { describe, expect, it } from 'vitest';
import {
  REQUIRED_COMPAT_ARTIFACT_PRODUCER_CONSUMER_CONTRACTS,
  REQUIRED_COMPAT_CI_PRIMARY_RUN_COMMAND,
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
  REQUIRED_COMPAT_CI_JOB_NAME,
  REQUIRED_COMPAT_CI_JOB_NAMES,
  REQUIRED_COMPAT_CI_JOB_RUNS_ON,
  REQUIRED_COMPAT_CI_JOB_TIMEOUT_MINUTES,
  REQUIRED_COMPAT_CI_JOB_UNIQUE_FIELD_NAMES,
  REQUIRED_COMPAT_CI_CHECKOUT_STEP_NAME,
  REQUIRED_COMPAT_CI_CHECKOUT_USES,
  REQUIRED_COMPAT_CI_INSTALL_COMMAND,
  REQUIRED_COMPAT_CI_INSTALL_STEP_NAME,
  REQUIRED_COMPAT_CI_REPORT_DIR_ENV_KEY,
  REQUIRED_COMPAT_CI_REPORT_DIR_ENV_VALUE,
  REQUIRED_COMPAT_CI_SETUP_NODE_CACHE,
  REQUIRED_COMPAT_CI_SETUP_NODE_STEP_NAME,
  REQUIRED_COMPAT_CI_SETUP_NODE_USES,
  REQUIRED_COMPAT_CI_SETUP_NODE_VERSION,
  REQUIRED_COMPAT_CI_STEP_SEQUENCE,
  REQUIRED_COMPAT_CI_PRIMARY_RUN_STEP_NAME,
  REQUIRED_COMPAT_CI_REACHABLE_SCRIPT_NAMES,
  REQUIRED_COMPAT_CI_SEQUENCE,
  REQUIRED_COMPAT_CI_UPLOAD_ARTIFACT_NAME,
  REQUIRED_COMPAT_CI_UPLOAD_CONDITION,
  REQUIRED_COMPAT_CI_UPLOAD_ARTIFACT_FILES,
  REQUIRED_COMPAT_CI_UPLOAD_IF_NO_FILES_FOUND,
  REQUIRED_COMPAT_CI_UPLOAD_ARTIFACT_PATH_PREFIX,
  REQUIRED_COMPAT_CI_UPLOAD_STEP_NAME,
  REQUIRED_COMPAT_CI_UPLOAD_USES,
  REQUIRED_COMPAT_ARTIFACT_CLI_DRIFT_PATHS,
  REQUIRED_COMPAT_ARTIFACT_STACK_SEQUENCE,
  REQUIRED_COMPAT_NPM_SCRIPT_NAMES,
  REQUIRED_COMPAT_REPORT_STACK_SEQUENCE,
  REQUIRED_COMPAT_SCRIPT_STACK_CONTRACT_TEST_PATHS,
  REQUIRED_COMPAT_SUMMARY_STACK_SEQUENCE,
  REQUIRED_COMPAT_SCRIPT_REFERENCE_SOURCES,
  REQUIRED_COMPAT_VALIDATOR_STACK_SEQUENCE
} from './compat-npm-script-contracts.mjs';

function expectNonEmptyUniqueStringArray(values, label) {
  expect(Array.isArray(values), `${label} must be an array`).toBe(true);
  expect(values.length, `${label} must not be empty`).toBeGreaterThan(0);
  expect(values.every((value) => typeof value === 'string' && value.length > 0), `${label} must contain non-empty strings`).toBe(true);
  expect(new Set(values).size, `${label} must be unique`).toBe(values.length);
}

describe('compat npm script contracts constants', () => {
  it('keeps required script names unique and non-empty', () => {
    expectNonEmptyUniqueStringArray(REQUIRED_COMPAT_NPM_SCRIPT_NAMES, 'REQUIRED_COMPAT_NPM_SCRIPT_NAMES');
    expectNonEmptyUniqueStringArray(REQUIRED_COMPAT_CI_REACHABLE_SCRIPT_NAMES, 'REQUIRED_COMPAT_CI_REACHABLE_SCRIPT_NAMES');
    expectNonEmptyUniqueStringArray(REQUIRED_COMPAT_SCRIPT_REFERENCE_SOURCES, 'REQUIRED_COMPAT_SCRIPT_REFERENCE_SOURCES');
    expect(REQUIRED_COMPAT_CI_REACHABLE_SCRIPT_NAMES).toEqual(REQUIRED_COMPAT_NPM_SCRIPT_NAMES);
    expect(REQUIRED_COMPAT_SCRIPT_REFERENCE_SOURCES.every((name) => REQUIRED_COMPAT_NPM_SCRIPT_NAMES.includes(name))).toBe(true);
  });

  it('keeps required stack sequences and drift paths unique and non-empty', () => {
    expectNonEmptyUniqueStringArray(REQUIRED_COMPAT_ARTIFACT_CLI_DRIFT_PATHS, 'REQUIRED_COMPAT_ARTIFACT_CLI_DRIFT_PATHS');
    expectNonEmptyUniqueStringArray(REQUIRED_COMPAT_SCRIPT_STACK_CONTRACT_TEST_PATHS, 'REQUIRED_COMPAT_SCRIPT_STACK_CONTRACT_TEST_PATHS');
    expectNonEmptyUniqueStringArray(REQUIRED_COMPAT_CI_UPLOAD_ARTIFACT_FILES, 'REQUIRED_COMPAT_CI_UPLOAD_ARTIFACT_FILES');
    expectNonEmptyUniqueStringArray(REQUIRED_COMPAT_ARTIFACT_STACK_SEQUENCE, 'REQUIRED_COMPAT_ARTIFACT_STACK_SEQUENCE');
    expectNonEmptyUniqueStringArray(REQUIRED_COMPAT_REPORT_STACK_SEQUENCE, 'REQUIRED_COMPAT_REPORT_STACK_SEQUENCE');
    expectNonEmptyUniqueStringArray(REQUIRED_COMPAT_VALIDATOR_STACK_SEQUENCE, 'REQUIRED_COMPAT_VALIDATOR_STACK_SEQUENCE');
    expectNonEmptyUniqueStringArray(REQUIRED_COMPAT_SUMMARY_STACK_SEQUENCE, 'REQUIRED_COMPAT_SUMMARY_STACK_SEQUENCE');
    expectNonEmptyUniqueStringArray(REQUIRED_COMPAT_CI_SEQUENCE, 'REQUIRED_COMPAT_CI_SEQUENCE');
    expect(typeof REQUIRED_COMPAT_CI_UPLOAD_ARTIFACT_PATH_PREFIX).toBe('string');
    expect(REQUIRED_COMPAT_CI_UPLOAD_ARTIFACT_PATH_PREFIX.length).toBeGreaterThan(0);
    expect(typeof REQUIRED_COMPAT_CI_UPLOAD_STEP_NAME).toBe('string');
    expect(REQUIRED_COMPAT_CI_UPLOAD_STEP_NAME.length).toBeGreaterThan(0);
    expect(typeof REQUIRED_COMPAT_CI_UPLOAD_ARTIFACT_NAME).toBe('string');
    expect(REQUIRED_COMPAT_CI_UPLOAD_ARTIFACT_NAME.length).toBeGreaterThan(0);
    expect(typeof REQUIRED_COMPAT_CI_UPLOAD_CONDITION).toBe('string');
    expect(REQUIRED_COMPAT_CI_UPLOAD_CONDITION.length).toBeGreaterThan(0);
    expect(typeof REQUIRED_COMPAT_CI_UPLOAD_USES).toBe('string');
    expect(REQUIRED_COMPAT_CI_UPLOAD_USES.length).toBeGreaterThan(0);
    expect(typeof REQUIRED_COMPAT_CI_UPLOAD_IF_NO_FILES_FOUND).toBe('string');
    expect(REQUIRED_COMPAT_CI_UPLOAD_IF_NO_FILES_FOUND.length).toBeGreaterThan(0);
    expect(typeof REQUIRED_COMPAT_CI_PRIMARY_RUN_STEP_NAME).toBe('string');
    expect(REQUIRED_COMPAT_CI_PRIMARY_RUN_STEP_NAME.length).toBeGreaterThan(0);
    expect(typeof REQUIRED_COMPAT_CI_PRIMARY_RUN_COMMAND).toBe('string');
    expect(REQUIRED_COMPAT_CI_PRIMARY_RUN_COMMAND.length).toBeGreaterThan(0);
    expect(typeof REQUIRED_COMPAT_CI_FAILURE_UPLOAD_STEP_NAME).toBe('string');
    expect(REQUIRED_COMPAT_CI_FAILURE_UPLOAD_STEP_NAME.length).toBeGreaterThan(0);
    expect(typeof REQUIRED_COMPAT_CI_FAILURE_UPLOAD_CONDITION).toBe('string');
    expect(REQUIRED_COMPAT_CI_FAILURE_UPLOAD_CONDITION.length).toBeGreaterThan(0);
    expect(typeof REQUIRED_COMPAT_CI_FAILURE_UPLOAD_ARTIFACT_NAME).toBe('string');
    expect(REQUIRED_COMPAT_CI_FAILURE_UPLOAD_ARTIFACT_NAME.length).toBeGreaterThan(0);
    expect(typeof REQUIRED_COMPAT_CI_FAILURE_UPLOAD_PATH).toBe('string');
    expect(REQUIRED_COMPAT_CI_FAILURE_UPLOAD_PATH.length).toBeGreaterThan(0);
    expect(typeof REQUIRED_COMPAT_CI_FAILURE_UPLOAD_USES).toBe('string');
    expect(REQUIRED_COMPAT_CI_FAILURE_UPLOAD_USES.length).toBeGreaterThan(0);
    expect(typeof REQUIRED_COMPAT_CI_FAILURE_UPLOAD_IF_NO_FILES_FOUND).toBe('string');
    expect(REQUIRED_COMPAT_CI_FAILURE_UPLOAD_IF_NO_FILES_FOUND.length).toBeGreaterThan(0);
    expect(typeof REQUIRED_COMPAT_CI_WORKFLOW_NAME).toBe('string');
    expect(REQUIRED_COMPAT_CI_WORKFLOW_NAME.length).toBeGreaterThan(0);
    expectNonEmptyUniqueStringArray(REQUIRED_COMPAT_CI_WORKFLOW_UNIQUE_FIELD_NAMES, 'REQUIRED_COMPAT_CI_WORKFLOW_UNIQUE_FIELD_NAMES');
    expect(REQUIRED_COMPAT_CI_WORKFLOW_UNIQUE_FIELD_NAMES).toEqual(expect.arrayContaining([
      'name',
      'on',
      'jobs'
    ]));
    expectNonEmptyUniqueStringArray(REQUIRED_COMPAT_CI_TRIGGER_PUSH_BRANCHES, 'REQUIRED_COMPAT_CI_TRIGGER_PUSH_BRANCHES');
    expect(REQUIRED_COMPAT_CI_TRIGGER_PUSH_BRANCHES).toEqual(expect.arrayContaining([
      'main',
      'master',
      'cursor/**'
    ]));
    expectNonEmptyUniqueStringArray(REQUIRED_COMPAT_CI_TRIGGER_NAMES, 'REQUIRED_COMPAT_CI_TRIGGER_NAMES');
    expect(REQUIRED_COMPAT_CI_TRIGGER_NAMES).toEqual(expect.arrayContaining([
      'push',
      'pull_request'
    ]));
    expect(typeof REQUIRED_COMPAT_CI_CHECKOUT_STEP_NAME).toBe('string');
    expect(REQUIRED_COMPAT_CI_CHECKOUT_STEP_NAME.length).toBeGreaterThan(0);
    expect(typeof REQUIRED_COMPAT_CI_CHECKOUT_USES).toBe('string');
    expect(REQUIRED_COMPAT_CI_CHECKOUT_USES.length).toBeGreaterThan(0);
    expect(typeof REQUIRED_COMPAT_CI_JOB_NAME).toBe('string');
    expect(REQUIRED_COMPAT_CI_JOB_NAME.length).toBeGreaterThan(0);
    expectNonEmptyUniqueStringArray(REQUIRED_COMPAT_CI_JOB_NAMES, 'REQUIRED_COMPAT_CI_JOB_NAMES');
    expect(REQUIRED_COMPAT_CI_JOB_NAMES).toContain(REQUIRED_COMPAT_CI_JOB_NAME);
    expect(typeof REQUIRED_COMPAT_CI_JOB_RUNS_ON).toBe('string');
    expect(REQUIRED_COMPAT_CI_JOB_RUNS_ON.length).toBeGreaterThan(0);
    expect(typeof REQUIRED_COMPAT_CI_JOB_TIMEOUT_MINUTES).toBe('string');
    expect(REQUIRED_COMPAT_CI_JOB_TIMEOUT_MINUTES.length).toBeGreaterThan(0);
    expectNonEmptyUniqueStringArray(REQUIRED_COMPAT_CI_JOB_UNIQUE_FIELD_NAMES, 'REQUIRED_COMPAT_CI_JOB_UNIQUE_FIELD_NAMES');
    expect(REQUIRED_COMPAT_CI_JOB_UNIQUE_FIELD_NAMES).toEqual(expect.arrayContaining([
      'runs-on',
      'timeout-minutes',
      'steps'
    ]));
    expect(typeof REQUIRED_COMPAT_CI_SETUP_NODE_STEP_NAME).toBe('string');
    expect(REQUIRED_COMPAT_CI_SETUP_NODE_STEP_NAME.length).toBeGreaterThan(0);
    expect(typeof REQUIRED_COMPAT_CI_SETUP_NODE_USES).toBe('string');
    expect(REQUIRED_COMPAT_CI_SETUP_NODE_USES.length).toBeGreaterThan(0);
    expect(typeof REQUIRED_COMPAT_CI_SETUP_NODE_VERSION).toBe('string');
    expect(REQUIRED_COMPAT_CI_SETUP_NODE_VERSION.length).toBeGreaterThan(0);
    expect(typeof REQUIRED_COMPAT_CI_SETUP_NODE_CACHE).toBe('string');
    expect(REQUIRED_COMPAT_CI_SETUP_NODE_CACHE.length).toBeGreaterThan(0);
    expect(typeof REQUIRED_COMPAT_CI_INSTALL_STEP_NAME).toBe('string');
    expect(REQUIRED_COMPAT_CI_INSTALL_STEP_NAME.length).toBeGreaterThan(0);
    expect(typeof REQUIRED_COMPAT_CI_INSTALL_COMMAND).toBe('string');
    expect(REQUIRED_COMPAT_CI_INSTALL_COMMAND.length).toBeGreaterThan(0);
    expectNonEmptyUniqueStringArray(REQUIRED_COMPAT_CI_STEP_SEQUENCE, 'REQUIRED_COMPAT_CI_STEP_SEQUENCE');
    expect(REQUIRED_COMPAT_CI_STEP_SEQUENCE).toEqual(expect.arrayContaining([
      REQUIRED_COMPAT_CI_CHECKOUT_STEP_NAME,
      REQUIRED_COMPAT_CI_SETUP_NODE_STEP_NAME,
      REQUIRED_COMPAT_CI_INSTALL_STEP_NAME,
      REQUIRED_COMPAT_CI_PRIMARY_RUN_STEP_NAME,
      REQUIRED_COMPAT_CI_FAILURE_UPLOAD_STEP_NAME,
      REQUIRED_COMPAT_CI_UPLOAD_STEP_NAME
    ]));
    expect(typeof REQUIRED_COMPAT_CI_REPORT_DIR_ENV_KEY).toBe('string');
    expect(REQUIRED_COMPAT_CI_REPORT_DIR_ENV_KEY.length).toBeGreaterThan(0);
    expect(typeof REQUIRED_COMPAT_CI_REPORT_DIR_ENV_VALUE).toBe('string');
    expect(REQUIRED_COMPAT_CI_REPORT_DIR_ENV_VALUE.length).toBeGreaterThan(0);
    expect(Array.isArray(REQUIRED_COMPAT_ARTIFACT_PRODUCER_CONSUMER_CONTRACTS)).toBe(true);
    expect(REQUIRED_COMPAT_ARTIFACT_PRODUCER_CONSUMER_CONTRACTS.length).toBeGreaterThan(0);
    for (const contract of REQUIRED_COMPAT_ARTIFACT_PRODUCER_CONSUMER_CONTRACTS) {
      expect(typeof contract.scriptName).toBe('string');
      expect(contract.scriptName.length).toBeGreaterThan(0);
      expect(typeof contract.artifactFile).toBe('string');
      expect(contract.artifactFile.length).toBeGreaterThan(0);
      expect(typeof contract.producerSegment).toBe('string');
      expect(contract.producerSegment.length).toBeGreaterThan(0);
      expect(typeof contract.consumerSegment).toBe('string');
      expect(contract.consumerSegment.length).toBeGreaterThan(0);
      expect(contract.producerSegment).not.toBe(contract.consumerSegment);
    }
  });
});
