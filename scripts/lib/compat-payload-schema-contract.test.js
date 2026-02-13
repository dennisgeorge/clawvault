import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  COMPAT_SUMMARY_VALIDATOR_OUTPUT_SCHEMA_VERSION
} from './compat-summary-validator-output.mjs';
import {
  COMPAT_VALIDATOR_RESULT_VERIFIER_OUTPUT_SCHEMA_VERSION
} from './compat-validator-result-verifier-output.mjs';

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
});
