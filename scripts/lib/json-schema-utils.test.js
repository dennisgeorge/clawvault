import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  compileSchemaFromPath,
  createJsonSchemaAjv,
  formatSchemaErrors,
  getSchemaConst,
  getSchemaId,
  loadJsonObject,
  loadJsonValue,
  validateWithCompiledSchema
} from './json-schema-utils.mjs';

describe('json schema utility helpers', () => {
  it('loads json values and json objects with clear failures', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'json-schema-utils-'));
    try {
      const objectPath = path.join(root, 'object.json');
      const arrayPath = path.join(root, 'array.json');
      fs.writeFileSync(objectPath, JSON.stringify({ ok: true }), 'utf-8');
      fs.writeFileSync(arrayPath, JSON.stringify([1, 2, 3]), 'utf-8');

      expect(loadJsonValue(objectPath, 'object payload')).toEqual({ ok: true });
      expect(loadJsonObject(objectPath, 'object payload')).toEqual({ ok: true });
      expect(() => loadJsonObject(arrayPath, 'array payload')).toThrow('must be a JSON object');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('compiles schemas and validates payloads with consistent errors', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'json-schema-utils-'));
    try {
      const schemaPath = path.join(root, 'schema.json');
      fs.writeFileSync(schemaPath, JSON.stringify({
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: {
          name: { type: 'string' }
        },
        required: ['name'],
        additionalProperties: false
      }), 'utf-8');
      const ajv = createJsonSchemaAjv();
      const { validate } = compileSchemaFromPath(ajv, schemaPath, 'sample');
      expect(() => validateWithCompiledSchema(validate, schemaPath, { name: 'ok' }, 'sample payload')).not.toThrow();
      expect(() => validateWithCompiledSchema(validate, schemaPath, {}, 'sample payload')).toThrow('Schema validation failed');

      validate({});
      const formatted = formatSchemaErrors(validate.errors, 'sample payload');
      expect(formatted.length).toBeGreaterThan(0);
      expect(formatted[0]).toContain('sample payload');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('extracts schema constants and ids with strict checks', () => {
    const schema = {
      $id: 'https://example.dev/schema.json',
      properties: {
        outputSchemaVersion: {
          const: 1
        }
      }
    };
    expect(getSchemaId(schema, 'sample')).toBe('https://example.dev/schema.json');
    expect(getSchemaConst(schema, ['properties', 'outputSchemaVersion', 'const'], 'sample')).toBe(1);
    expect(() => getSchemaConst(schema, ['properties', 'missing', 'const'], 'sample')).toThrow('missing field path');
  });
});
