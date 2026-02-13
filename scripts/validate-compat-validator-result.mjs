import * as path from 'path';
import {
  loadSummaryValidatorPayload
} from './lib/compat-summary-validator-output.mjs';
import {
  buildValidatorResultVerifierErrorPayload,
  buildValidatorResultVerifierSuccessPayload,
  ensureValidatorResultVerifierPayloadShape
} from './lib/compat-validator-result-verifier-output.mjs';
import {
  bestEffortOutPath,
  isJsonModeRequestedFromArgv,
  writeValidatedJsonPayload
} from './lib/validator-cli-utils.mjs';
import {
  parseValidatorCliArgs
} from './lib/validator-cli-parser.mjs';

function parseCliArgs(argv) {
  const { parsed, positional } = parseValidatorCliArgs(argv, {
    allowPositional: true,
    initialValues: {
      payloadPath: '',
      requireOk: false
    },
    valueOptions: [
      { name: '--validator-result', key: 'payloadPath' }
    ],
    booleanOptions: [
      { name: '--require-ok', key: 'requireOk' }
    ]
  });

  if (!parsed.payloadPath && positional.length > 0) {
    parsed.payloadPath = positional[0];
  }

  return parsed;
}

function printHelp() {
  console.log('Usage: node scripts/validate-compat-validator-result.mjs [validator-result.json]');
  console.log('       node scripts/validate-compat-validator-result.mjs --validator-result <path>');
  console.log('       node scripts/validate-compat-validator-result.mjs --validator-result <path> --json');
  console.log('');
  console.log('Resolution order:');
  console.log('  validator-result path: --validator-result | positional arg | COMPAT_VALIDATOR_RESULT_PATH | COMPAT_REPORT_DIR/validator-result.json');
  console.log('  flags               : --json (emit machine-readable payload), --out <file> (persist result payload)');
  console.log('                        --require-ok (fail when payload.status is "error")');
}

function writeResultPayload(outPath, payload) {
  writeValidatedJsonPayload(outPath, payload, ensureValidatorResultVerifierPayloadShape);
}

function resolveValidatorResultPath(args) {
  if (args.payloadPath && args.payloadPath.trim()) {
    return path.resolve(process.cwd(), args.payloadPath);
  }
  if (process.env.COMPAT_VALIDATOR_RESULT_PATH && process.env.COMPAT_VALIDATOR_RESULT_PATH.trim()) {
    return path.resolve(process.cwd(), process.env.COMPAT_VALIDATOR_RESULT_PATH);
  }
  if (process.env.COMPAT_REPORT_DIR && process.env.COMPAT_REPORT_DIR.trim()) {
    return path.join(path.resolve(process.cwd(), process.env.COMPAT_REPORT_DIR), 'validator-result.json');
  }
  throw new Error('Missing validator result path. Provide <validator-result.json>, COMPAT_VALIDATOR_RESULT_PATH, or COMPAT_REPORT_DIR.');
}

function main() {
  const args = parseCliArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const payloadPath = resolveValidatorResultPath(args);
  const payload = loadSummaryValidatorPayload(payloadPath);
  if (args.requireOk && payload.status !== 'ok') {
    throw new Error(`validator-result payload status is "${payload.status}" but --require-ok was set`);
  }
  const resultPayload = buildValidatorResultVerifierSuccessPayload({
    payloadPath,
    payloadStatus: payload.status,
    validatorPayloadOutputSchemaVersion: payload.outputSchemaVersion
  });
  if (args.outPath) {
    writeResultPayload(args.outPath, resultPayload);
  }
  if (args.json) {
    console.log(JSON.stringify(resultPayload));
    return;
  }
  console.log(`Validator result payload is valid (status=${payload.status}) path=${payloadPath}`);
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
  const resultPayload = buildValidatorResultVerifierErrorPayload(message);
  if (outPath) {
    writeResultPayload(outPath, resultPayload);
  }
  if (isJsonModeRequestedFromArgv(argv)) {
    console.log(JSON.stringify(resultPayload));
  } else {
    console.error(message);
  }
  process.exit(1);
}
