import * as fs from 'fs';
import * as path from 'path';
import Ajv2020 from 'ajv/dist/2020.js';
import {
  loadCompatSummary
} from './lib/compat-fixture-runner.mjs';
import {
  loadSummaryValidatorPayload
} from './lib/compat-summary-validator-output.mjs';
import {
  loadJsonSchemaValidatorPayload
} from './lib/json-schema-validator-output.mjs';
import {
  ensureValidatorResultVerifierPayloadShape
} from './lib/compat-validator-result-verifier-output.mjs';
import {
  loadCompatReportSchemaValidatorPayload
} from './lib/compat-report-schema-validator-output.mjs';
import {
  buildCompatArtifactBundleValidatorErrorPayload,
  buildCompatArtifactBundleValidatorSuccessPayload,
  ensureCompatArtifactBundleValidatorPayloadShape
} from './lib/compat-artifact-bundle-validator-output.mjs';

function parseCliArgs(argv) {
  const parsed = {
    reportDir: '',
    help: false,
    json: false,
    outPath: '',
    allowErrorStatus: false
  };

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
    if (value === '--allow-error-status') {
      parsed.allowErrorStatus = true;
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
    if (value === '--report-dir') {
      const nextValue = argv[index + 1];
      if (!nextValue || nextValue.startsWith('--')) {
        throw new Error('Missing value for --report-dir');
      }
      parsed.reportDir = nextValue;
      index += 1;
      continue;
    }
    if (value.startsWith('--')) {
      throw new Error(`Unknown option: ${value}`);
    }
    throw new Error(`Unexpected positional argument: ${value}`);
  }

  return parsed;
}

function printHelp() {
  console.log('Usage: node scripts/validate-compat-artifact-bundle.mjs [--report-dir <dir>]');
  console.log('       node scripts/validate-compat-artifact-bundle.mjs --json --out <result.json>');
  console.log('');
  console.log('Resolution order:');
  console.log('  report dir: --report-dir | COMPAT_REPORT_DIR');
  console.log('  flags     : --json (emit machine-readable payload)');
  console.log('              --out <file> (write machine-readable payload)');
  console.log('              --allow-error-status (allow validator payload statuses of "error")');
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
  ensureCompatArtifactBundleValidatorPayloadShape(payload);
  const resolvedPath = path.resolve(process.cwd(), outPath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  fs.writeFileSync(resolvedPath, JSON.stringify(payload, null, 2), 'utf-8');
}

function resolveReportDir(args) {
  if (args.reportDir && args.reportDir.trim()) {
    return path.resolve(process.cwd(), args.reportDir);
  }
  if (process.env.COMPAT_REPORT_DIR && process.env.COMPAT_REPORT_DIR.trim()) {
    return path.resolve(process.cwd(), process.env.COMPAT_REPORT_DIR);
  }
  throw new Error('Missing report dir. Provide --report-dir or COMPAT_REPORT_DIR.');
}

function loadJsonObject(payloadPath, label) {
  try {
    const raw = fs.readFileSync(payloadPath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`${label} must be a JSON object`);
    }
    return parsed;
  } catch (err) {
    throw new Error(`Unable to read ${label} at ${payloadPath}: ${err?.message || String(err)}`);
  }
}

function formatSchemaErrors(errors, label) {
  return (errors ?? [])
    .map((entry) => `${label} [${entry.keyword}] ${entry.instancePath || '/'} ${entry.message || ''}`.trim());
}

function validateWithCompiledSchema(validate, schemaPath, payload, label) {
  const valid = validate(payload);
  if (!valid) {
    const details = formatSchemaErrors(validate.errors, label);
    throw new Error(`Schema validation failed for ${label} using ${schemaPath}: ${details.join('; ')}`);
  }
}

function main() {
  const args = parseCliArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const reportDir = resolveReportDir(args);
  const requireOk = !args.allowErrorStatus;
  const artifactPaths = {
    summaryPath: path.join(reportDir, 'summary.json'),
    reportSchemaValidatorResultPath: path.join(reportDir, 'report-schema-validator-result.json'),
    validatorResultPath: path.join(reportDir, 'validator-result.json'),
    schemaValidatorResultPath: path.join(reportDir, 'schema-validator-result.json'),
    validatorResultVerifierResultPath: path.join(reportDir, 'validator-result-verifier-result.json')
  };
  const schemaPaths = {
    summarySchemaPath: path.resolve(process.cwd(), 'schemas', 'compat-summary.schema.json'),
    reportSchemaValidatorOutputSchemaPath: path.resolve(process.cwd(), 'schemas', 'compat-report-schema-validator-output.schema.json'),
    summaryValidatorOutputSchemaPath: path.resolve(process.cwd(), 'schemas', 'compat-summary-validator-output.schema.json'),
    jsonSchemaValidatorOutputSchemaPath: path.resolve(process.cwd(), 'schemas', 'json-schema-validator-output.schema.json'),
    validatorResultVerifierOutputSchemaPath: path.resolve(process.cwd(), 'schemas', 'compat-validator-result-verifier-output.schema.json')
  };

  const summary = loadCompatSummary(artifactPaths.summaryPath);
  const reportSchemaValidatorPayload = loadCompatReportSchemaValidatorPayload(artifactPaths.reportSchemaValidatorResultPath);
  const summaryValidatorPayload = loadSummaryValidatorPayload(artifactPaths.validatorResultPath);
  const schemaValidatorPayload = loadJsonSchemaValidatorPayload(artifactPaths.schemaValidatorResultPath);
  const validatorResultVerifierPayload = loadJsonObject(
    artifactPaths.validatorResultVerifierResultPath,
    'validator-result verifier payload'
  );
  ensureValidatorResultVerifierPayloadShape(validatorResultVerifierPayload);

  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validators = {
    summary: ajv.compile(loadJsonObject(schemaPaths.summarySchemaPath, 'compat summary schema')),
    reportSchemaValidatorOutput: ajv.compile(loadJsonObject(schemaPaths.reportSchemaValidatorOutputSchemaPath, 'report-schema validator output schema')),
    summaryValidatorOutput: ajv.compile(loadJsonObject(schemaPaths.summaryValidatorOutputSchemaPath, 'summary validator output schema')),
    jsonSchemaValidatorOutput: ajv.compile(loadJsonObject(schemaPaths.jsonSchemaValidatorOutputSchemaPath, 'json-schema validator output schema')),
    validatorResultVerifierOutput: ajv.compile(loadJsonObject(schemaPaths.validatorResultVerifierOutputSchemaPath, 'validator-result verifier output schema'))
  };

  validateWithCompiledSchema(validators.summary, schemaPaths.summarySchemaPath, summary, 'summary artifact');
  validateWithCompiledSchema(
    validators.reportSchemaValidatorOutput,
    schemaPaths.reportSchemaValidatorOutputSchemaPath,
    reportSchemaValidatorPayload,
    'report-schema validator result artifact'
  );
  validateWithCompiledSchema(
    validators.summaryValidatorOutput,
    schemaPaths.summaryValidatorOutputSchemaPath,
    summaryValidatorPayload,
    'validator-result artifact'
  );
  validateWithCompiledSchema(
    validators.jsonSchemaValidatorOutput,
    schemaPaths.jsonSchemaValidatorOutputSchemaPath,
    schemaValidatorPayload,
    'schema-validator result artifact'
  );
  validateWithCompiledSchema(
    validators.validatorResultVerifierOutput,
    schemaPaths.validatorResultVerifierOutputSchemaPath,
    validatorResultVerifierPayload,
    'validator-result verifier artifact'
  );

  const pathChecks = [];
  if (summaryValidatorPayload.status === 'ok') {
    pathChecks.push(
      ['validator-result summaryPath', summaryValidatorPayload.summaryPath, artifactPaths.summaryPath],
      ['validator-result reportDir', summaryValidatorPayload.reportDir, reportDir]
    );
  }
  if (reportSchemaValidatorPayload.status === 'ok') {
    pathChecks.push(
      ['report-schema-validator summaryPath', reportSchemaValidatorPayload.summaryPath, artifactPaths.summaryPath],
      ['report-schema-validator reportDir', reportSchemaValidatorPayload.reportDir, reportDir]
    );
  }
  if (schemaValidatorPayload.status === 'ok') {
    pathChecks.push(['schema-validator dataPath', schemaValidatorPayload.dataPath, artifactPaths.validatorResultPath]);
  }
  if (validatorResultVerifierPayload.status === 'ok') {
    pathChecks.push(['validator-result verifier payloadPath', validatorResultVerifierPayload.payloadPath, artifactPaths.validatorResultPath]);
  }
  for (const [label, actualValue, expectedValue] of pathChecks) {
    if (actualValue !== expectedValue) {
      throw new Error(`${label} mismatch (expected ${expectedValue}, received ${String(actualValue)})`);
    }
  }

  if (summaryValidatorPayload.status === 'ok' && summaryValidatorPayload.mode !== summary.mode) {
    throw new Error(`summary mode mismatch between summary and validator-result payload (${summary.mode} vs ${summaryValidatorPayload.mode})`);
  }
  if (reportSchemaValidatorPayload.status === 'ok' && reportSchemaValidatorPayload.mode !== summary.mode) {
    throw new Error(`summary mode mismatch between summary and report-schema-validator payload (${summary.mode} vs ${reportSchemaValidatorPayload.mode})`);
  }

  if (requireOk) {
    const statusChecks = [
      ['report-schema-validator-result', reportSchemaValidatorPayload.status],
      ['validator-result', summaryValidatorPayload.status],
      ['schema-validator-result', schemaValidatorPayload.status],
      ['validator-result-verifier-result', validatorResultVerifierPayload.status]
    ];
    for (const [label, status] of statusChecks) {
      if (status !== 'ok') {
        throw new Error(`${label} status is "${String(status)}" but require-ok mode is enabled`);
      }
    }
  }

  const payload = buildCompatArtifactBundleValidatorSuccessPayload({
    reportDir,
    summaryMode: summary.mode,
    requireOk,
    summaryPath: artifactPaths.summaryPath,
    validatorResultPath: artifactPaths.validatorResultPath,
    reportSchemaValidatorResultPath: artifactPaths.reportSchemaValidatorResultPath,
    schemaValidatorResultPath: artifactPaths.schemaValidatorResultPath,
    validatorResultVerifierResultPath: artifactPaths.validatorResultVerifierResultPath,
    verifiedArtifacts: [
      'summary.json',
      'report-schema-validator-result.json',
      'validator-result.json',
      'schema-validator-result.json',
      'validator-result-verifier-result.json'
    ]
  });
  if (args.outPath) {
    writeResultPayload(args.outPath, payload);
  }
  if (args.json) {
    console.log(JSON.stringify(payload));
    return;
  }

  console.log(
    `Compatibility artifact bundle validation passed mode=${summary.mode} reportDir=${reportDir} requireOk=${requireOk} verified=${payload.verifiedArtifacts.length}`
  );
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
  const payload = buildCompatArtifactBundleValidatorErrorPayload(message);
  if (outPath) {
    writeResultPayload(outPath, payload);
  }
  if (isJsonModeRequestedFromArgv(argv)) {
    console.log(JSON.stringify(payload));
  } else {
    console.error(message);
  }
  process.exit(1);
}
