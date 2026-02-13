import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  buildJsonSchemaValidatorErrorPayload,
  buildJsonSchemaValidatorSuccessPayload,
  ensureJsonSchemaValidatorPayloadShape,
  JSON_SCHEMA_VALIDATOR_OUTPUT_SCHEMA_VERSION,
  loadJsonSchemaValidatorPayload
} from './json-schema-validator-output.mjs';

describe('json schema validator output payload contracts', () => {
  it('builds and validates success payloads', () => {
    const payload = buildJsonSchemaValidatorSuccessPayload({
      schemaPath: '/tmp/schema.json',
      dataPath: '/tmp/payload.json'
    });
    expect(payload.outputSchemaVersion).toBe(JSON_SCHEMA_VALIDATOR_OUTPUT_SCHEMA_VERSION);
    expect(() => ensureJsonSchemaValidatorPayloadShape(payload)).not.toThrow();
  });

  it('builds and validates error payloads', () => {
    const payload = buildJsonSchemaValidatorErrorPayload({
      error: 'failed',
      validationErrors: [
        {
          instancePath: '/field',
          schemaPath: '#/required',
          keyword: 'required',
          message: 'must have required property'
        }
      ]
    });
    expect(payload.status).toBe('error');
    expect(() => ensureJsonSchemaValidatorPayloadShape(payload)).not.toThrow();
  });

  it('loads and validates payloads from disk', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'json-schema-validator-output-'));
    const payloadPath = path.join(root, 'payload.json');
    try {
      const payload = buildJsonSchemaValidatorSuccessPayload({
        schemaPath: '/tmp/schema.json',
        dataPath: '/tmp/payload.json'
      });
      fs.writeFileSync(payloadPath, JSON.stringify(payload, null, 2), 'utf-8');
      expect(loadJsonSchemaValidatorPayload(payloadPath)).toEqual(payload);

      fs.writeFileSync(payloadPath, '{"status":"ok"', 'utf-8');
      expect(() => loadJsonSchemaValidatorPayload(payloadPath)).toThrow('Unable to read JSON schema validator payload');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
