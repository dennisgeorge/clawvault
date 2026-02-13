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
  loadValidatorResultVerifierPayload
} from './lib/compat-validator-result-verifier-output.mjs';
import {
  loadCompatReportSchemaValidatorPayload
} from './lib/compat-report-schema-validator-output.mjs';
import {
  loadCompatArtifactBundleManifestValidatorPayload
} from './lib/compat-artifact-bundle-manifest-validator-output.mjs';
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
  validateWithCompiledSchema
} from './lib/json-schema-utils.mjs';
import {
  parseValidatorCliArgs
} from './lib/validator-cli-parser.mjs';
import {
  ensureArtifactContractVersionParity,
  ensureArtifactPathCoherence,
  ensureCrossPayloadCoherence,
  ensureManifestValidatorPayloadCoherence,
  ensureRequireOkStatuses
} from './lib/compat-artifact-bundle-coherence.mjs';
import {
  resolveCompatArtifactBundleManifestPath,
  resolveCompatCaseReportSchemaPath
} from './lib/compat-contract-paths.mjs';

function parseCliArgs(argv) {
  return parseValidatorCliArgs(argv, {
    initialValues: {
      reportDir: '',
      manifestPath: '',
      allowErrorStatus: false
    },
    valueOptions: [
      { name: '--report-dir', key: 'reportDir' },
      { name: '--manifest', key: 'manifestPath' }
    ],
    booleanOptions: [
      { name: '--allow-error-status', key: 'allowErrorStatus' }
    ]
  }).parsed;
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
  return resolveCompatArtifactBundleManifestPath();
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
      artifactPayloadsByName.set(entry.artifactName, loadValidatorResultVerifierPayload(entry.artifactPath));
      continue;
    }
    if (entry.artifactName === 'artifact-bundle-manifest-validator-result.json') {
      artifactPayloadsByName.set(entry.artifactName, loadCompatArtifactBundleManifestValidatorPayload(entry.artifactPath));
      continue;
    }
    throw new Error(`Unsupported compat artifact bundle manifest artifactName: ${entry.artifactName}`);
  }
  const summary = artifactPayloadsByName.get('summary.json');
  const reportSchemaValidatorPayload = artifactPayloadsByName.get('report-schema-validator-result.json');
  const summaryValidatorPayload = artifactPayloadsByName.get('validator-result.json');
  const schemaValidatorPayload = artifactPayloadsByName.get('schema-validator-result.json');
  const validatorResultVerifierPayload = artifactPayloadsByName.get('validator-result-verifier-result.json');
  const artifactBundleManifestValidatorPayload = artifactPayloadsByName.get('artifact-bundle-manifest-validator-result.json');

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

  ensureArtifactPathCoherence({
    summaryValidatorPayload,
    reportSchemaValidatorPayload,
    schemaValidatorPayload,
    validatorResultVerifierPayload,
    artifactBundleManifestValidatorPayload,
    artifactPathByName,
    reportDir,
    manifestPath
  });
  ensureCrossPayloadCoherence({
    summary,
    summaryValidatorPayload,
    reportSchemaValidatorPayload,
    validatorResultVerifierPayload,
    schemaValidatorPayload,
    artifactContracts,
    expectedCaseSchemaPath: resolveCompatCaseReportSchemaPath()
  });
  ensureRequireOkStatuses({
    requireOk,
    reportSchemaValidatorPayload,
    summaryValidatorPayload,
    schemaValidatorPayload,
    validatorResultVerifierPayload,
    artifactBundleManifestValidatorPayload
  });
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
  ensureArtifactContractVersionParity(artifactContractEntries, artifactContracts);
  ensureManifestValidatorPayloadCoherence({
    artifactBundleManifestValidatorPayload,
    artifactContracts,
    artifactContractEntries
  });

  const payload = buildCompatArtifactBundleValidatorSuccessPayload({
    reportDir,
    summaryMode: summary.mode,
    requireOk,
    summaryPath: artifactPathByName.get('summary.json'),
    validatorResultPath: artifactPathByName.get('validator-result.json'),
    reportSchemaValidatorResultPath: artifactPathByName.get('report-schema-validator-result.json'),
    schemaValidatorResultPath: artifactPathByName.get('schema-validator-result.json'),
    validatorResultVerifierResultPath: artifactPathByName.get('validator-result-verifier-result.json'),
    artifactBundleManifestValidatorResultPath: artifactPathByName.get('artifact-bundle-manifest-validator-result.json'),
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
