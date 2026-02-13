import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  COMPAT_SUMMARY_VALIDATOR_OUTPUT_SCHEMA_VERSION
} from './compat-summary-validator-output.mjs';
import {
  COMPAT_VALIDATOR_RESULT_VERIFIER_OUTPUT_SCHEMA_VERSION
} from './compat-validator-result-verifier-output.mjs';
import {
  JSON_SCHEMA_VALIDATOR_OUTPUT_SCHEMA_VERSION
} from './json-schema-validator-output.mjs';
import {
  COMPAT_FIXTURE_SCHEMA_VERSION,
  COMPAT_SUMMARY_SCHEMA_VERSION
} from './compat-fixture-runner.mjs';
import {
  COMPAT_REPORT_SCHEMA_VALIDATOR_OUTPUT_SCHEMA_VERSION
} from './compat-report-schema-validator-output.mjs';
import {
  COMPAT_ARTIFACT_BUNDLE_VALIDATOR_OUTPUT_SCHEMA_VERSION
} from './compat-artifact-bundle-validator-output.mjs';

function readSchema(schemaFileName) {
  const schemaPath = path.resolve(process.cwd(), 'schemas', schemaFileName);
  const raw = fs.readFileSync(schemaPath, 'utf-8');
  return JSON.parse(raw);
}

describe('compat payload json schema contracts', () => {
  it('keeps summary validator schema in sync with runtime contract versions', () => {
    const schema = readSchema('compat-summary-validator-output.schema.json');
    expect(schema.properties.outputSchemaVersion.const).toBe(COMPAT_SUMMARY_VALIDATOR_OUTPUT_SCHEMA_VERSION);
    expect(schema.properties.status.enum).toEqual(['ok', 'error']);
    expect(schema.additionalProperties).toBe(false);
  });

  it('keeps validator-result verifier schema in sync with runtime contract versions', () => {
    const schema = readSchema('compat-validator-result-verifier-output.schema.json');
    expect(schema.properties.outputSchemaVersion.const).toBe(COMPAT_VALIDATOR_RESULT_VERIFIER_OUTPUT_SCHEMA_VERSION);
    expect(schema.properties.status.enum).toEqual(['ok', 'error']);
    expect(schema.additionalProperties).toBe(false);
  });

  it('keeps generic json-schema validator output schema in sync with runtime contract version', () => {
    const schema = readSchema('json-schema-validator-output.schema.json');
    expect(schema.properties.outputSchemaVersion.const).toBe(JSON_SCHEMA_VALIDATOR_OUTPUT_SCHEMA_VERSION);
    expect(schema.properties.status.enum).toEqual(['ok', 'error']);
    expect(schema.additionalProperties).toBe(false);
  });

  it('keeps compat summary artifact schema in sync with runtime summary constants', () => {
    const schema = readSchema('compat-summary.schema.json');
    expect(schema.properties.summarySchemaVersion.const).toBe(COMPAT_SUMMARY_SCHEMA_VERSION);
    expect(schema.properties.schemaVersion.const).toBe(COMPAT_FIXTURE_SCHEMA_VERSION);
    expect(schema.properties.mode.enum).toEqual(['contract', 'fixtures']);
    expect(schema.additionalProperties).toBe(false);
  });

  it('keeps compat case-report artifact schema aligned with runtime status contract', () => {
    const schema = readSchema('compat-case-report.schema.json');
    expect(schema.properties.checks.items.properties.status.enum).toEqual(['ok', 'warn', 'error']);
    expect(schema.additionalProperties).toBe(false);
  });

  it('keeps compat report-schema validator output schema in sync with runtime contract versions', () => {
    const schema = readSchema('compat-report-schema-validator-output.schema.json');
    expect(schema.properties.outputSchemaVersion.const).toBe(COMPAT_REPORT_SCHEMA_VALIDATOR_OUTPUT_SCHEMA_VERSION);
    expect(schema.properties.status.enum).toEqual(['ok', 'error']);
    expect(schema.additionalProperties).toBe(false);
  });

  it('keeps compat artifact-bundle validator output schema in sync with runtime contract versions', () => {
    const schema = readSchema('compat-artifact-bundle-validator-output.schema.json');
    expect(schema.properties.outputSchemaVersion.const).toBe(COMPAT_ARTIFACT_BUNDLE_VALIDATOR_OUTPUT_SCHEMA_VERSION);
    expect(schema.properties.status.enum).toEqual(['ok', 'error']);
    expect(schema.additionalProperties).toBe(false);
  });
});
