import * as path from 'path';
import {
  buildJsonSchemaValidatorErrorPayload,
  buildJsonSchemaValidatorSuccessPayload,
  ensureJsonSchemaValidatorPayloadShape
} from './lib/json-schema-validator-output.mjs';
import {
  bestEffortOutPath,
  writeValidatedJsonPayload
} from './lib/validator-cli-utils.mjs';
import {
  compileSchemaFromPath,
  createJsonSchemaAjv,
  loadJsonValue
} from './lib/json-schema-utils.mjs';
import {
  parseValidatorCliArgs
} from './lib/validator-cli-parser.mjs';

function parseCliArgs(argv) {
  const { parsed, positional } = parseValidatorCliArgs(argv, {
    allowPositional: true,
    initialValues: {
      schemaPath: '',
      dataPath: ''
    },
    valueOptions: [
      { name: '--schema', key: 'schemaPath' },
      { name: '--data', key: 'dataPath' }
    ]
  });

  if (!parsed.schemaPath && positional.length > 0) {
    parsed.schemaPath = positional[0];
  }
  if (!parsed.dataPath && positional.length > 1) {
    parsed.dataPath = positional[1];
  }

  return parsed;
}

function printHelp() {
  console.log('Usage: node scripts/validate-json-schema.mjs --schema <schema.json> --data <payload.json>');
  console.log('       node scripts/validate-json-schema.mjs <schema.json> <payload.json>');
  console.log('');
  console.log('Options:');
  console.log('  --json        Emit machine-readable output payload');
  console.log('  --out <file>  Write output payload to file');
  console.log('  --help        Show usage');
}

function resolvePathOrThrow(value, fieldName) {
  if (!value || !value.trim()) {
    throw new Error(`Missing required ${fieldName} path`);
  }
  return path.resolve(process.cwd(), value);
}

function normalizeValidationErrors(errors = []) {
  return errors.map((entry) => ({
    instancePath: String(entry.instancePath ?? ''),
    schemaPath: String(entry.schemaPath ?? ''),
    keyword: String(entry.keyword ?? ''),
    message: String(entry.message ?? '')
  }));
}

function writePayload(outPath, payload) {
  writeValidatedJsonPayload(outPath, payload, ensureJsonSchemaValidatorPayloadShape);
}

function main() {
  const args = parseCliArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const schemaPath = resolvePathOrThrow(args.schemaPath, 'schema');
  const dataPath = resolvePathOrThrow(args.dataPath, 'data');
  const data = loadJsonValue(dataPath, 'data');
  const ajv = createJsonSchemaAjv();
  const { validate } = compileSchemaFromPath(ajv, schemaPath, 'schema');
  const isValid = validate(data);
  if (!isValid) {
    const validationErrors = normalizeValidationErrors(validate.errors);
    const payload = buildJsonSchemaValidatorErrorPayload({
      error: 'JSON schema validation failed',
      validationErrors
    });
    if (args.outPath) writePayload(args.outPath, payload);
    if (args.json) {
      console.log(JSON.stringify(payload));
    } else {
      console.error(`JSON schema validation failed for data=${dataPath} schema=${schemaPath}`);
      for (const err of validationErrors) {
        console.error(`  - [${err.keyword}] ${err.instancePath} ${err.message}`.trim());
      }
    }
    process.exit(1);
  }

  const payload = buildJsonSchemaValidatorSuccessPayload({
    schemaPath,
    dataPath
  });
  if (args.outPath) writePayload(args.outPath, payload);
  if (args.json) {
    console.log(JSON.stringify(payload));
    return;
  }
  console.log(`JSON schema validation passed data=${dataPath} schema=${schemaPath}`);
}

try {
  main();
} catch (err) {
  const message = err?.message || String(err);
  const argv = process.argv.slice(2);
  const outPath = (() => {
    try {
      return parseCliArgs(argv).outPath;
    } catch {
      return bestEffortOutPath(argv);
    }
  })();
  const payload = buildJsonSchemaValidatorErrorPayload({ error: message });
  if (outPath) writePayload(outPath, payload);
  if (argv.includes('--json')) {
    console.log(JSON.stringify(payload));
  } else {
    console.error(message);
  }
  process.exit(1);
}
