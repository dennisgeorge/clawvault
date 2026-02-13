import * as path from 'path';
import {
  loadSummaryValidatorPayload
} from './lib/compat-summary-validator-output.mjs';

function resolveValidatorResultPath(argv) {
  const cliPath = argv[0];
  if (cliPath && cliPath.trim()) {
    return path.resolve(process.cwd(), cliPath);
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
  const payloadPath = resolveValidatorResultPath(process.argv.slice(2));
  const payload = loadSummaryValidatorPayload(payloadPath);
  console.log(`Validator result payload is valid (status=${payload.status}) path=${payloadPath}`);
}

try {
  main();
} catch (err) {
  console.error(err?.message || String(err));
  process.exit(1);
}
