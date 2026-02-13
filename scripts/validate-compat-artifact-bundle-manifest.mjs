import * as path from 'path';
import {
  loadCompatArtifactBundleManifest
} from './lib/compat-artifact-bundle-manifest.mjs';
import {
  buildCompatArtifactBundleManifestValidatorErrorPayload,
  buildCompatArtifactBundleManifestValidatorSuccessPayload,
  ensureCompatArtifactBundleManifestValidatorPayloadShape
} from './lib/compat-artifact-bundle-manifest-validator-output.mjs';
import {
  bestEffortOutPath,
  isJsonModeRequestedFromArgv,
  writeValidatedJsonPayload
} from './lib/validator-cli-utils.mjs';
import {
  parseValidatorCliArgs
} from './lib/validator-cli-parser.mjs';
import {
  compileSchemaFromPath,
  createJsonSchemaAjv,
  getSchemaConst,
  getSchemaId
} from './lib/json-schema-utils.mjs';
import {
  resolveCompatArtifactBundleManifestPath
} from './lib/compat-contract-paths.mjs';

function parseCliArgs(argv) {
  return parseValidatorCliArgs(argv, {
    initialValues: {
      manifestPath: ''
    },
    valueOptions: [
      { name: '--manifest', key: 'manifestPath' }
    ]
  }).parsed;
}

function printHelp() {
  console.log('Usage: node scripts/validate-compat-artifact-bundle-manifest.mjs');
  console.log('       node scripts/validate-compat-artifact-bundle-manifest.mjs --manifest <manifest.json>');
  console.log('       node scripts/validate-compat-artifact-bundle-manifest.mjs --json --out <result.json>');
  console.log('');
  console.log('Resolution order:');
  console.log('  manifest path: --manifest | schemas/compat-artifact-bundle.manifest.json');
  console.log('  flags       : --json (emit machine-readable payload)');
  console.log('                --out <file> (write machine-readable payload)');
}

function resolveManifestPath(args) {
  if (args.manifestPath && args.manifestPath.trim()) {
    return path.resolve(process.cwd(), args.manifestPath);
  }
  return resolveCompatArtifactBundleManifestPath();
}

function writeResultPayload(outPath, payload) {
  writeValidatedJsonPayload(outPath, payload, ensureCompatArtifactBundleManifestValidatorPayloadShape);
}

function main() {
  const args = parseCliArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const manifestPath = resolveManifestPath(args);
  const manifest = loadCompatArtifactBundleManifest(manifestPath);
  const ajv = createJsonSchemaAjv();

  const schemaContracts = manifest.artifacts.map((entry) => {
    const schemaPath = path.resolve(process.cwd(), entry.schemaPath);
    const { schema } = compileSchemaFromPath(ajv, schemaPath, entry.artifactName);
    const schemaId = getSchemaId(schema, entry.artifactName);
    if (schemaId !== entry.schemaId) {
      throw new Error(`compat artifact bundle manifest schemaId mismatch for ${entry.artifactName} (manifest=${entry.schemaId}, actual=${schemaId})`);
    }
    const expectedSchemaVersion = entry.versionField === 'summarySchemaVersion'
      ? getSchemaConst(schema, ['properties', 'summarySchemaVersion', 'const'], entry.artifactName)
      : getSchemaConst(schema, ['properties', 'outputSchemaVersion', 'const'], entry.artifactName);
    return {
      artifactName: entry.artifactName,
      artifactFile: entry.artifactFile,
      schemaPath,
      schemaId,
      versionField: entry.versionField,
      expectedSchemaVersion
    };
  });

  const payload = buildCompatArtifactBundleManifestValidatorSuccessPayload({
    manifestPath,
    artifactCount: manifest.artifacts.length,
    artifacts: manifest.artifacts.map((entry) => entry.artifactName),
    schemaContracts
  });
  if (args.outPath) {
    writeResultPayload(args.outPath, payload);
  }
  if (args.json) {
    console.log(JSON.stringify(payload));
    return;
  }
  console.log(`Compatibility artifact bundle manifest validation passed artifacts=${payload.artifactCount} manifest=${manifestPath}`);
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
  const payload = buildCompatArtifactBundleManifestValidatorErrorPayload(message);
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
