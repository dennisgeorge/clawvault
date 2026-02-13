import * as path from 'path';
import {
  loadCompatSummary
} from './lib/compat-fixture-runner.mjs';
import {
  loadCompatArtifactBundleManifest
} from './lib/compat-artifact-bundle-manifest.mjs';
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
import {
  bestEffortOutPath,
  isJsonModeRequestedFromArgv,
  writeValidatedJsonPayload
} from './lib/validator-cli-utils.mjs';
import {
  compileSchemaFromPath,
  createJsonSchemaAjv,
  getSchemaConst,
  getSchemaId,
  loadJsonObject,
  validateWithCompiledSchema
} from './lib/json-schema-utils.mjs';

function parseCliArgs(argv) {
  const parsed = {
    reportDir: '',
    manifestPath: '',
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
    if (value === '--manifest') {
      const nextValue = argv[index + 1];
      if (!nextValue || nextValue.startsWith('--')) {
        throw new Error('Missing value for --manifest');
      }
      parsed.manifestPath = nextValue;
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
  console.log('       node scripts/validate-compat-artifact-bundle.mjs --manifest <manifest.json> --json --out <result.json>');
  console.log('');
  console.log('Resolution order:');
  console.log('  report dir: --report-dir | COMPAT_REPORT_DIR');
  console.log('  manifest  : --manifest | schemas/compat-artifact-bundle.manifest.json');
  console.log('  flags     : --json (emit machine-readable payload)');
  console.log('              --out <file> (write machine-readable payload)');
  console.log('              --allow-error-status (allow validator payload statuses of "error")');
}

function writeResultPayload(outPath, payload) {
  writeValidatedJsonPayload(outPath, payload, ensureCompatArtifactBundleValidatorPayloadShape);
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

function resolveManifestPath(args) {
  if (args.manifestPath && args.manifestPath.trim()) {
    return path.resolve(process.cwd(), args.manifestPath);
  }
  return path.resolve(process.cwd(), 'schemas', 'compat-artifact-bundle.manifest.json');
}

function main() {
  const args = parseCliArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const reportDir = resolveReportDir(args);
  const manifestPath = resolveManifestPath(args);
  const manifest = loadCompatArtifactBundleManifest(manifestPath);
  const requireOk = !args.allowErrorStatus;
  const artifactContracts = manifest.artifacts.map((entry) => ({
    ...entry,
    artifactPath: path.join(reportDir, entry.artifactFile),
    schemaPathResolved: path.resolve(process.cwd(), entry.schemaPath)
  }));
  const requiredArtifactNames = [
    'summary.json',
    'report-schema-validator-result.json',
    'validator-result.json',
    'schema-validator-result.json',
    'validator-result-verifier-result.json'
  ];
  for (const requiredName of requiredArtifactNames) {
    if (!artifactContracts.some((entry) => entry.artifactName === requiredName)) {
      throw new Error(`compat artifact bundle manifest missing required artifactName: ${requiredName}`);
    }
  }
  const artifactPathByName = new Map(artifactContracts.map((entry) => [entry.artifactName, entry.artifactPath]));

  const artifactPayloadsByName = new Map();
  for (const entry of artifactContracts) {
    if (entry.artifactName === 'summary.json') {
      artifactPayloadsByName.set(entry.artifactName, loadCompatSummary(entry.artifactPath));
      continue;
    }
    if (entry.artifactName === 'report-schema-validator-result.json') {
      artifactPayloadsByName.set(entry.artifactName, loadCompatReportSchemaValidatorPayload(entry.artifactPath));
      continue;
    }
    if (entry.artifactName === 'validator-result.json') {
      artifactPayloadsByName.set(entry.artifactName, loadSummaryValidatorPayload(entry.artifactPath));
      continue;
    }
    if (entry.artifactName === 'schema-validator-result.json') {
      artifactPayloadsByName.set(entry.artifactName, loadJsonSchemaValidatorPayload(entry.artifactPath));
      continue;
    }
    if (entry.artifactName === 'validator-result-verifier-result.json') {
      const payload = loadJsonObject(entry.artifactPath, 'validator-result verifier payload');
      ensureValidatorResultVerifierPayloadShape(payload);
      artifactPayloadsByName.set(entry.artifactName, payload);
      continue;
    }
    throw new Error(`Unsupported compat artifact bundle manifest artifactName: ${entry.artifactName}`);
  }
  const summary = artifactPayloadsByName.get('summary.json');
  const reportSchemaValidatorPayload = artifactPayloadsByName.get('report-schema-validator-result.json');
  const summaryValidatorPayload = artifactPayloadsByName.get('validator-result.json');
  const schemaValidatorPayload = artifactPayloadsByName.get('schema-validator-result.json');
  const validatorResultVerifierPayload = artifactPayloadsByName.get('validator-result-verifier-result.json');

  const ajv = createJsonSchemaAjv();
  const schemasByArtifactName = new Map(
    artifactContracts.map((entry) => [entry.artifactName, compileSchemaFromPath(ajv, entry.schemaPathResolved, entry.artifactName)])
  );
  const validatorsByArtifactName = new Map(
    artifactContracts.map((entry) => [entry.artifactName, schemasByArtifactName.get(entry.artifactName).validate])
  );
  for (const entry of artifactContracts) {
    validateWithCompiledSchema(
      validatorsByArtifactName.get(entry.artifactName),
      entry.schemaPathResolved,
      artifactPayloadsByName.get(entry.artifactName),
      `${entry.artifactName} artifact`
    );
  }

  const pathChecks = [];
  if (summaryValidatorPayload.status === 'ok') {
    pathChecks.push(
      ['validator-result summaryPath', summaryValidatorPayload.summaryPath, artifactPathByName.get('summary.json')],
      ['validator-result reportDir', summaryValidatorPayload.reportDir, reportDir]
    );
  }
  if (reportSchemaValidatorPayload.status === 'ok') {
    pathChecks.push(
      ['report-schema-validator summaryPath', reportSchemaValidatorPayload.summaryPath, artifactPathByName.get('summary.json')],
      ['report-schema-validator reportDir', reportSchemaValidatorPayload.reportDir, reportDir]
    );
  }
  if (schemaValidatorPayload.status === 'ok') {
    pathChecks.push(['schema-validator dataPath', schemaValidatorPayload.dataPath, artifactPathByName.get('validator-result.json')]);
  }
  if (validatorResultVerifierPayload.status === 'ok') {
    pathChecks.push(['validator-result verifier payloadPath', validatorResultVerifierPayload.payloadPath, artifactPathByName.get('validator-result.json')]);
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
  const artifactContractEntries = artifactContracts.map((entry) => {
    const schema = schemasByArtifactName.get(entry.artifactName).schema;
    const payload = artifactPayloadsByName.get(entry.artifactName);
    const expectedSchemaVersion = entry.versionField === 'summarySchemaVersion'
      ? getSchemaConst(schema, ['properties', 'summarySchemaVersion', 'const'], entry.artifactName)
      : getSchemaConst(schema, ['properties', 'outputSchemaVersion', 'const'], entry.artifactName);
    return {
      artifactName: entry.artifactName,
      artifactPath: entry.artifactPath,
      schemaPath: entry.schemaPathResolved,
      schemaId: getSchemaId(schema, entry.artifactName),
      versionField: entry.versionField,
      expectedSchemaVersion,
      actualSchemaVersion: payload?.[entry.versionField]
    };
  });
  for (const contract of artifactContractEntries) {
    const manifestSchemaId = artifactContracts.find((entry) => entry.artifactName === contract.artifactName)?.schemaId;
    if (manifestSchemaId !== contract.schemaId) {
      throw new Error(`artifact contract schemaId mismatch for ${contract.artifactName} (manifest=${manifestSchemaId}, actual=${contract.schemaId})`);
    }
    if (contract.actualSchemaVersion !== contract.expectedSchemaVersion) {
      throw new Error(
        `artifact contract version mismatch for ${contract.artifactName} (${contract.versionField} expected ${contract.expectedSchemaVersion}, received ${contract.actualSchemaVersion})`
      );
    }
  }

  const payload = buildCompatArtifactBundleValidatorSuccessPayload({
    reportDir,
    summaryMode: summary.mode,
    requireOk,
    summaryPath: artifactPathByName.get('summary.json'),
    validatorResultPath: artifactPathByName.get('validator-result.json'),
    reportSchemaValidatorResultPath: artifactPathByName.get('report-schema-validator-result.json'),
    schemaValidatorResultPath: artifactPathByName.get('schema-validator-result.json'),
    validatorResultVerifierResultPath: artifactPathByName.get('validator-result-verifier-result.json'),
    artifactContracts: artifactContractEntries,
    verifiedArtifacts: artifactContracts.map((entry) => entry.artifactName)
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
