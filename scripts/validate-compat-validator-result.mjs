import * as fs from 'fs';
import * as path from 'path';
import {
  loadSummaryValidatorPayload
} from './lib/compat-summary-validator-output.mjs';
import {
  buildValidatorResultVerifierErrorPayload,
  buildValidatorResultVerifierSuccessPayload,
  ensureValidatorResultVerifierPayloadShape
} from './lib/compat-validator-result-verifier-output.mjs';

function parseCliArgs(argv) {
  const parsed = {
    payloadPath: '',
    help: false,
    json: false,
    outPath: ''
  };
  const positional = [];

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--help' || value === '-h') {
      parsed.help = true;
      continue;
    }
    if (value === '--json') {
      parsed.json = true;
      continue;
    }
    if (value === '--out') {
      const nextValue = argv[index + 1];
      if (!nextValue || nextValue.startsWith('--')) {
        throw new Error('Missing value for --out');
      }
      parsed.outPath = nextValue;
      index += 1;
      continue;
    }
    if (value === '--validator-result') {
      const nextValue = argv[index + 1];
      if (!nextValue || nextValue.startsWith('--')) {
        throw new Error('Missing value for --validator-result');
      }
      parsed.payloadPath = nextValue;
      index += 1;
      continue;
    }
    if (value.startsWith('--')) {
      throw new Error(`Unknown option: ${value}`);
    }
    positional.push(value);
  }

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
}

function isJsonModeRequestedFromArgv(argv) {
  return argv.includes('--json');
}

function bestEffortOutPath(argv) {
  const index = argv.indexOf('--out');
  if (index === -1) return '';
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) return '';
  return value;
}

function writeResultPayload(outPath, payload) {
  ensureValidatorResultVerifierPayloadShape(payload);
  const resolvedPath = path.resolve(process.cwd(), outPath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  fs.writeFileSync(resolvedPath, JSON.stringify(payload, null, 2), 'utf-8');
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
