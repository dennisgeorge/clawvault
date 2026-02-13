import { describe, expect, it } from 'vitest';
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
  REQUIRED_COMPAT_CI_SETUP_NODE_CACHE,
  REQUIRED_COMPAT_CI_SETUP_NODE_STEP_NAME,
  REQUIRED_COMPAT_CI_SETUP_NODE_USES,
  REQUIRED_COMPAT_CI_SETUP_NODE_VERSION,
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
    expect(Array.isArray(REQUIRED_COMPAT_CI_WORKFLOW_UNIQUE_FIELD_NAMES)).toBe(true);
    expect(REQUIRED_COMPAT_CI_WORKFLOW_UNIQUE_FIELD_NAMES.length).toBeGreaterThan(0);
    expect(new Set(REQUIRED_COMPAT_CI_WORKFLOW_UNIQUE_FIELD_NAMES).size).toBe(REQUIRED_COMPAT_CI_WORKFLOW_UNIQUE_FIELD_NAMES.length);
    expect(Array.isArray(REQUIRED_COMPAT_CI_TRIGGER_PUSH_BRANCHES)).toBe(true);
    expect(REQUIRED_COMPAT_CI_TRIGGER_PUSH_BRANCHES.length).toBeGreaterThan(0);
    expect(new Set(REQUIRED_COMPAT_CI_TRIGGER_PUSH_BRANCHES).size).toBe(REQUIRED_COMPAT_CI_TRIGGER_PUSH_BRANCHES.length);
    expect(Array.isArray(REQUIRED_COMPAT_CI_TRIGGER_NAMES)).toBe(true);
    expect(REQUIRED_COMPAT_CI_TRIGGER_NAMES.length).toBeGreaterThan(0);
    expect(new Set(REQUIRED_COMPAT_CI_TRIGGER_NAMES).size).toBe(REQUIRED_COMPAT_CI_TRIGGER_NAMES.length);
    expect(typeof REQUIRED_COMPAT_CI_CHECKOUT_STEP_NAME).toBe('string');
    expect(REQUIRED_COMPAT_CI_CHECKOUT_STEP_NAME.length).toBeGreaterThan(0);
    expect(typeof REQUIRED_COMPAT_CI_CHECKOUT_USES).toBe('string');
    expect(REQUIRED_COMPAT_CI_CHECKOUT_USES.length).toBeGreaterThan(0);
    expect(typeof REQUIRED_COMPAT_CI_JOB_NAME).toBe('string');
    expect(REQUIRED_COMPAT_CI_JOB_NAME.length).toBeGreaterThan(0);
    expect(Array.isArray(REQUIRED_COMPAT_CI_JOB_NAMES)).toBe(true);
    expect(REQUIRED_COMPAT_CI_JOB_NAMES.length).toBeGreaterThan(0);
    expect(new Set(REQUIRED_COMPAT_CI_JOB_NAMES).size).toBe(REQUIRED_COMPAT_CI_JOB_NAMES.length);
    expect(REQUIRED_COMPAT_CI_JOB_NAMES).toContain(REQUIRED_COMPAT_CI_JOB_NAME);
    expect(typeof REQUIRED_COMPAT_CI_JOB_RUNS_ON).toBe('string');
    expect(REQUIRED_COMPAT_CI_JOB_RUNS_ON.length).toBeGreaterThan(0);
    expect(typeof REQUIRED_COMPAT_CI_JOB_TIMEOUT_MINUTES).toBe('string');
    expect(REQUIRED_COMPAT_CI_JOB_TIMEOUT_MINUTES.length).toBeGreaterThan(0);
    expect(Array.isArray(REQUIRED_COMPAT_CI_JOB_UNIQUE_FIELD_NAMES)).toBe(true);
    expect(REQUIRED_COMPAT_CI_JOB_UNIQUE_FIELD_NAMES.length).toBeGreaterThan(0);
    expect(new Set(REQUIRED_COMPAT_CI_JOB_UNIQUE_FIELD_NAMES).size).toBe(REQUIRED_COMPAT_CI_JOB_UNIQUE_FIELD_NAMES.length);
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
    expect(Array.isArray(REQUIRED_COMPAT_CI_STEP_SEQUENCE)).toBe(true);
    expect(REQUIRED_COMPAT_CI_STEP_SEQUENCE.length).toBeGreaterThan(0);
    expect(new Set(REQUIRED_COMPAT_CI_STEP_SEQUENCE).size).toBe(REQUIRED_COMPAT_CI_STEP_SEQUENCE.length);
    expect(Array.isArray(REQUIRED_COMPAT_CI_STEP_NAMES)).toBe(true);
    expect(REQUIRED_COMPAT_CI_STEP_NAMES.length).toBeGreaterThan(0);
    expect(new Set(REQUIRED_COMPAT_CI_STEP_NAMES).size).toBe(REQUIRED_COMPAT_CI_STEP_NAMES.length);
    expect(REQUIRED_COMPAT_CI_STEP_NAMES).toEqual(REQUIRED_COMPAT_CI_STEP_SEQUENCE);
    expect(Object.keys(REQUIRED_COMPAT_CI_STEP_FIELD_NAME_SEQUENCES).sort()).toEqual(
      [...REQUIRED_COMPAT_CI_STEP_NAMES].sort()
    );
    for (const fieldNameSequence of Object.values(REQUIRED_COMPAT_CI_STEP_FIELD_NAME_SEQUENCES)) {
      expect(Array.isArray(fieldNameSequence)).toBe(true);
      expect(fieldNameSequence.length).toBeGreaterThan(0);
      expect(new Set(fieldNameSequence).size).toBe(fieldNameSequence.length);
      expect(fieldNameSequence[0]).toBe('name');
    }
  });

  it('keeps required upload artifact file domain unique and non-empty', () => {
    expect(Array.isArray(REQUIRED_COMPAT_CI_UPLOAD_ARTIFACT_FILES)).toBe(true);
    expect(REQUIRED_COMPAT_CI_UPLOAD_ARTIFACT_FILES.length).toBeGreaterThan(0);
    expect(
      REQUIRED_COMPAT_CI_UPLOAD_ARTIFACT_FILES.every((artifactFile) => typeof artifactFile === 'string' && artifactFile.length > 0)
    ).toBe(true);
    expect(new Set(REQUIRED_COMPAT_CI_UPLOAD_ARTIFACT_FILES).size).toBe(REQUIRED_COMPAT_CI_UPLOAD_ARTIFACT_FILES.length);
    expect(REQUIRED_COMPAT_CI_UPLOAD_ARTIFACT_FILES).toContain('artifact-bundle-validator-result.json');
    expect(REQUIRED_COMPAT_CI_UPLOAD_ARTIFACT_FILES).toContain('summary.json');
  });
});
