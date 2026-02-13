import { describe, expect, it } from 'vitest';
import {
  REQUIRED_COMPAT_ARTIFACT_CLI_DRIFT_PATHS,
  REQUIRED_COMPAT_ARTIFACT_STACK_SEQUENCE,
  REQUIRED_COMPAT_NPM_SCRIPT_NAMES,
  REQUIRED_COMPAT_REPORT_STACK_SEQUENCE,
  REQUIRED_COMPAT_SUMMARY_STACK_SEQUENCE
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
  });

  it('keeps required stack sequences and drift paths unique and non-empty', () => {
    expectNonEmptyUniqueStringArray(REQUIRED_COMPAT_ARTIFACT_CLI_DRIFT_PATHS, 'REQUIRED_COMPAT_ARTIFACT_CLI_DRIFT_PATHS');
    expectNonEmptyUniqueStringArray(REQUIRED_COMPAT_ARTIFACT_STACK_SEQUENCE, 'REQUIRED_COMPAT_ARTIFACT_STACK_SEQUENCE');
    expectNonEmptyUniqueStringArray(REQUIRED_COMPAT_REPORT_STACK_SEQUENCE, 'REQUIRED_COMPAT_REPORT_STACK_SEQUENCE');
    expectNonEmptyUniqueStringArray(REQUIRED_COMPAT_SUMMARY_STACK_SEQUENCE, 'REQUIRED_COMPAT_SUMMARY_STACK_SEQUENCE');
  });
});
