import { describe, expect, it } from 'vitest';
import {
  expectNonEmptyStringRecord,
  expectNonEmptyUniqueStringArray
} from './compat-contract-assertion-test-utils.js';
import {
  REQUIRED_COMPAT_CI_JOB_NAME,
  REQUIRED_COMPAT_CI_JOB_NAMES,
  REQUIRED_COMPAT_CI_JOB_FIELD_NAME_SEQUENCES,
  REQUIRED_COMPAT_CI_JOB_TOP_LEVEL_SCALAR_VALUE_CONTRACTS,
  REQUIRED_COMPAT_CI_JOB_STEP_NAME_SEQUENCES,
  REQUIRED_COMPAT_CI_JOB_UNIQUE_FIELD_NAME_SEQUENCES,
  REQUIRED_COMPAT_CI_JOB_RUNS_ON,
  REQUIRED_COMPAT_CI_JOB_TIMEOUT_MINUTES,
  REQUIRED_COMPAT_CI_JOB_FIELD_NAMES,
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
  REQUIRED_COMPAT_CI_STEP_SEQUENCE,
  REQUIRED_COMPAT_CI_PRIMARY_RUN_STEP_NAME,
  REQUIRED_COMPAT_CI_UPLOAD_ARTIFACT_NAME,
  REQUIRED_COMPAT_CI_UPLOAD_CONDITION,
  REQUIRED_COMPAT_CI_UPLOAD_ARTIFACT_FILES,
  REQUIRED_COMPAT_CI_UPLOAD_IF_NO_FILES_FOUND,
  REQUIRED_COMPAT_CI_UPLOAD_ARTIFACT_PATH_PREFIX,
  REQUIRED_COMPAT_CI_UPLOAD_STEP_NAME,
  REQUIRED_COMPAT_CI_UPLOAD_USES
} from './compat-npm-script-contracts.mjs';

describe('compat ci workflow contracts constants', () => {
  it('keeps required ci workflow string contracts non-empty', () => {
    expect(typeof REQUIRED_COMPAT_CI_PRIMARY_RUN_STEP_NAME).toBe('string');
    expect(REQUIRED_COMPAT_CI_PRIMARY_RUN_STEP_NAME.length).toBeGreaterThan(0);
    expect(typeof REQUIRED_COMPAT_CI_PRIMARY_RUN_COMMAND).toBe('string');
    expect(REQUIRED_COMPAT_CI_PRIMARY_RUN_COMMAND.length).toBeGreaterThan(0);
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
    expect(typeof REQUIRED_COMPAT_CI_UPLOAD_ARTIFACT_PATH_PREFIX).toBe('string');
    expect(REQUIRED_COMPAT_CI_UPLOAD_ARTIFACT_PATH_PREFIX.length).toBeGreaterThan(0);
    expect(typeof REQUIRED_COMPAT_CI_REPORT_DIR_ENV_KEY).toBe('string');
    expect(REQUIRED_COMPAT_CI_REPORT_DIR_ENV_KEY.length).toBeGreaterThan(0);
    expect(typeof REQUIRED_COMPAT_CI_REPORT_DIR_ENV_VALUE).toBe('string');
    expect(REQUIRED_COMPAT_CI_REPORT_DIR_ENV_VALUE.length).toBeGreaterThan(0);
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
    expectNonEmptyUniqueStringArray(
      REQUIRED_COMPAT_CI_WORKFLOW_UNIQUE_FIELD_NAMES,
      'REQUIRED_COMPAT_CI_WORKFLOW_UNIQUE_FIELD_NAMES'
    );
    expectNonEmptyUniqueStringArray(REQUIRED_COMPAT_CI_WORKFLOW_FIELD_NAMES, 'REQUIRED_COMPAT_CI_WORKFLOW_FIELD_NAMES');
    expect(REQUIRED_COMPAT_CI_WORKFLOW_FIELD_NAMES).toEqual(REQUIRED_COMPAT_CI_WORKFLOW_UNIQUE_FIELD_NAMES);
    expectNonEmptyUniqueStringArray(REQUIRED_COMPAT_CI_TRIGGER_PUSH_BRANCHES, 'REQUIRED_COMPAT_CI_TRIGGER_PUSH_BRANCHES');
    expectNonEmptyUniqueStringArray(REQUIRED_COMPAT_CI_TRIGGER_NAMES, 'REQUIRED_COMPAT_CI_TRIGGER_NAMES');
    expect(Object.keys(REQUIRED_COMPAT_CI_TRIGGER_SECTION_FIELD_NAME_SEQUENCES).sort()).toEqual(
      [...REQUIRED_COMPAT_CI_TRIGGER_NAMES].sort()
    );
    for (const [triggerName, fieldNames] of Object.entries(REQUIRED_COMPAT_CI_TRIGGER_SECTION_FIELD_NAME_SEQUENCES)) {
      expect(REQUIRED_COMPAT_CI_TRIGGER_NAMES).toContain(triggerName);
      expectNonEmptyUniqueStringArray(fieldNames, `trigger field-name sequence ${triggerName}`, { requireNonEmpty: false });
    }
    expect(typeof REQUIRED_COMPAT_CI_CHECKOUT_STEP_NAME).toBe('string');
    expect(REQUIRED_COMPAT_CI_CHECKOUT_STEP_NAME.length).toBeGreaterThan(0);
    expect(typeof REQUIRED_COMPAT_CI_CHECKOUT_USES).toBe('string');
    expect(REQUIRED_COMPAT_CI_CHECKOUT_USES.length).toBeGreaterThan(0);
    expect(typeof REQUIRED_COMPAT_CI_JOB_NAME).toBe('string');
    expect(REQUIRED_COMPAT_CI_JOB_NAME.length).toBeGreaterThan(0);
    expectNonEmptyUniqueStringArray(REQUIRED_COMPAT_CI_JOB_NAMES, 'REQUIRED_COMPAT_CI_JOB_NAMES');
    expect(REQUIRED_COMPAT_CI_JOB_NAMES).toContain(REQUIRED_COMPAT_CI_JOB_NAME);
    expect(Object.keys(REQUIRED_COMPAT_CI_JOB_UNIQUE_FIELD_NAME_SEQUENCES).sort()).toEqual(
      [...REQUIRED_COMPAT_CI_JOB_NAMES].sort()
    );
    for (const [jobName, fieldNames] of Object.entries(REQUIRED_COMPAT_CI_JOB_UNIQUE_FIELD_NAME_SEQUENCES)) {
      expect(REQUIRED_COMPAT_CI_JOB_NAMES).toContain(jobName);
      expectNonEmptyUniqueStringArray(fieldNames, `job unique field-name sequence ${jobName}`);
    }
    expect(Object.keys(REQUIRED_COMPAT_CI_JOB_FIELD_NAME_SEQUENCES).sort()).toEqual(
      [...REQUIRED_COMPAT_CI_JOB_NAMES].sort()
    );
    for (const [jobName, fieldNames] of Object.entries(REQUIRED_COMPAT_CI_JOB_FIELD_NAME_SEQUENCES)) {
      expect(REQUIRED_COMPAT_CI_JOB_NAMES).toContain(jobName);
      expectNonEmptyUniqueStringArray(fieldNames, `job field-name sequence ${jobName}`);
    }
    expect(Object.keys(REQUIRED_COMPAT_CI_JOB_TOP_LEVEL_SCALAR_VALUE_CONTRACTS).sort()).toEqual(
      [...REQUIRED_COMPAT_CI_JOB_NAMES].sort()
    );
    for (const [jobName, scalarValueContracts] of Object.entries(REQUIRED_COMPAT_CI_JOB_TOP_LEVEL_SCALAR_VALUE_CONTRACTS)) {
      expect(REQUIRED_COMPAT_CI_JOB_NAMES).toContain(jobName);
      expectNonEmptyStringRecord(scalarValueContracts, `job scalar-value contracts ${jobName}`);
    }
    expect(typeof REQUIRED_COMPAT_CI_JOB_RUNS_ON).toBe('string');
    expect(REQUIRED_COMPAT_CI_JOB_RUNS_ON.length).toBeGreaterThan(0);
    expect(typeof REQUIRED_COMPAT_CI_JOB_TIMEOUT_MINUTES).toBe('string');
    expect(REQUIRED_COMPAT_CI_JOB_TIMEOUT_MINUTES.length).toBeGreaterThan(0);
    expectNonEmptyUniqueStringArray(REQUIRED_COMPAT_CI_JOB_UNIQUE_FIELD_NAMES, 'REQUIRED_COMPAT_CI_JOB_UNIQUE_FIELD_NAMES');
    expectNonEmptyUniqueStringArray(REQUIRED_COMPAT_CI_JOB_FIELD_NAMES, 'REQUIRED_COMPAT_CI_JOB_FIELD_NAMES');
    expect(REQUIRED_COMPAT_CI_JOB_FIELD_NAMES).toEqual(REQUIRED_COMPAT_CI_JOB_UNIQUE_FIELD_NAMES);
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
    expectNonEmptyUniqueStringArray(REQUIRED_COMPAT_CI_STEP_NAMES, 'REQUIRED_COMPAT_CI_STEP_NAMES');
    expect(REQUIRED_COMPAT_CI_STEP_NAMES).toEqual(REQUIRED_COMPAT_CI_STEP_SEQUENCE);
    expect(Object.keys(REQUIRED_COMPAT_CI_JOB_STEP_NAME_SEQUENCES).sort()).toEqual(
      [...REQUIRED_COMPAT_CI_JOB_NAMES].sort()
    );
    for (const [jobName, stepNames] of Object.entries(REQUIRED_COMPAT_CI_JOB_STEP_NAME_SEQUENCES)) {
      expect(REQUIRED_COMPAT_CI_JOB_NAMES).toContain(jobName);
      expectNonEmptyUniqueStringArray(stepNames, `job step-name sequence ${jobName}`);
    }
    expect(Object.keys(REQUIRED_COMPAT_CI_STEP_FIELD_NAME_SEQUENCES).sort()).toEqual(
      [...REQUIRED_COMPAT_CI_STEP_NAMES].sort()
    );
    for (const fieldNameSequence of Object.values(REQUIRED_COMPAT_CI_STEP_FIELD_NAME_SEQUENCES)) {
      expectNonEmptyUniqueStringArray(fieldNameSequence, 'step field-name sequence');
      expect(fieldNameSequence[0]).toBe('name');
    }
    for (const [stepName, fieldNameSequence] of Object.entries(REQUIRED_COMPAT_CI_STEP_WITH_FIELD_NAME_SEQUENCES)) {
      expect(REQUIRED_COMPAT_CI_STEP_NAMES).toContain(stepName);
      expectNonEmptyUniqueStringArray(fieldNameSequence, `step with field-name sequence ${stepName}`);
    }
    for (const [stepName, fieldNameSequence] of Object.entries(REQUIRED_COMPAT_CI_STEP_ENV_FIELD_NAME_SEQUENCES)) {
      expect(REQUIRED_COMPAT_CI_STEP_NAMES).toContain(stepName);
      expectNonEmptyUniqueStringArray(fieldNameSequence, `step env field-name sequence ${stepName}`);
    }
    for (const [stepName, scalarValueContracts] of Object.entries(REQUIRED_COMPAT_CI_STEP_TOP_LEVEL_SCALAR_VALUE_CONTRACTS)) {
      expect(REQUIRED_COMPAT_CI_STEP_NAMES).toContain(stepName);
      expectNonEmptyStringRecord(scalarValueContracts, `step top-level scalar-value contracts ${stepName}`);
    }
    for (const [stepName, scalarValueContracts] of Object.entries(REQUIRED_COMPAT_CI_STEP_WITH_SCALAR_VALUE_CONTRACTS)) {
      expect(REQUIRED_COMPAT_CI_STEP_NAMES).toContain(stepName);
      expectNonEmptyStringRecord(scalarValueContracts, `step with scalar-value contracts ${stepName}`);
    }
    for (const [stepName, scalarValueContracts] of Object.entries(REQUIRED_COMPAT_CI_STEP_ENV_SCALAR_VALUE_CONTRACTS)) {
      expect(REQUIRED_COMPAT_CI_STEP_NAMES).toContain(stepName);
      expectNonEmptyStringRecord(scalarValueContracts, `step env scalar-value contracts ${stepName}`);
    }
  });

  it('keeps required upload artifact file domain unique and non-empty', () => {
    expectNonEmptyUniqueStringArray(REQUIRED_COMPAT_CI_UPLOAD_ARTIFACT_FILES, 'REQUIRED_COMPAT_CI_UPLOAD_ARTIFACT_FILES');
    expect(REQUIRED_COMPAT_CI_UPLOAD_ARTIFACT_FILES).toContain('artifact-bundle-validator-result.json');
    expect(REQUIRED_COMPAT_CI_UPLOAD_ARTIFACT_FILES).toContain('summary.json');
  });
});
