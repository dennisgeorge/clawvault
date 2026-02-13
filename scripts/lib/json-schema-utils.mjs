import * as fs from 'fs';
import Ajv2020 from 'ajv/dist/2020.js';

export function loadJsonValue(payloadPath, label) {
  try {
    const raw = fs.readFileSync(payloadPath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Unable to read ${label} at ${payloadPath}: ${err?.message || String(err)}`);
  }
}

export function loadJsonObject(payloadPath, label) {
  const parsed = loadJsonValue(payloadPath, label);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Unable to read ${label} at ${payloadPath}: ${label} must be a JSON object`);
  }
  return parsed;
}

export function createJsonSchemaAjv() {
  return new Ajv2020({ allErrors: true, strict: false });
}

export function compileSchemaFromPath(ajv, schemaPath, label) {
  const schema = loadJsonObject(schemaPath, `${label} schema`);
  const validate = ajv.compile(schema);
  return { schema, validate };
}

export function formatSchemaErrors(errors, label) {
  return (errors ?? [])
    .map((entry) => `${label} [${entry.keyword}] ${entry.instancePath || '/'} ${entry.message || ''}`.trim());
}

export function validateWithCompiledSchema(validate, schemaPath, payload, label) {
  const valid = validate(payload);
  if (!valid) {
    const details = formatSchemaErrors(validate.errors, label);
    throw new Error(`Schema validation failed for ${label} using ${schemaPath}: ${details.join('; ')}`);
  }
}

export function getSchemaConst(schema, fieldPath, label) {
  let cursor = schema;
  for (const segment of fieldPath) {
    if (!cursor || typeof cursor !== 'object' || !(segment in cursor)) {
      throw new Error(`Schema ${label} is missing field path ${fieldPath.join('.')}`);
    }
    cursor = cursor[segment];
  }
  if (!Number.isInteger(cursor) || cursor < 0) {
    throw new Error(`Schema ${label} has invalid non-integer const at ${fieldPath.join('.')}`);
  }
  return cursor;
}

export function getSchemaId(schema, label) {
  if (!schema || typeof schema !== 'object' || typeof schema.$id !== 'string' || schema.$id.length === 0) {
    throw new Error(`Schema ${label} missing non-empty $id`);
  }
  return schema.$id;
}
