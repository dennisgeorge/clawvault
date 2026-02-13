import * as fs from 'fs';
import * as path from 'path';
import {
  buildCompatReportSchemaValidatorErrorPayload,
  buildCompatReportSchemaValidatorSuccessPayload,
  ensureCompatReportSchemaValidatorPayloadShape
} from './lib/compat-report-schema-validator-output.mjs';
import {
  bestEffortOutPath,
  isJsonModeRequestedFromArgv,
  writeValidatedJsonPayload
} from './lib/validator-cli-utils.mjs';
import {
  compileSchemaFromPath,
  createJsonSchemaAjv,
  loadJsonObject,
  validateWithCompiledSchema
} from './lib/json-schema-utils.mjs';
import {
  parseValidatorCliArgs
} from './lib/validator-cli-parser.mjs';
import {
  COMPAT_CONTRACT_PATHS
} from './lib/compat-contract-paths.mjs';

function parseCliArgs(argv) {
  const { parsed, positional } = parseValidatorCliArgs(argv, {
    allowPositional: true,
    initialValues: {
      summaryPath: '',
      reportDir: '',
      summarySchemaPath: '',
      caseSchemaPath: '',
      allowMissingCaseReports: false
    },
    valueOptions: [
      { name: '--summary', key: 'summaryPath' },
      { name: '--report-dir', key: 'reportDir' },
      { name: '--summary-schema', key: 'summarySchemaPath' },
      { name: '--case-schema', key: 'caseSchemaPath' }
    ],
    booleanOptions: [
      { name: '--allow-missing-case-reports', key: 'allowMissingCaseReports' }
    ]
  });

  if (!parsed.summaryPath && positional.length > 0) {
    parsed.summaryPath = positional[0];
  }

  return parsed;
}

function printHelp() {
  console.log('Usage: node scripts/validate-compat-report-schemas.mjs [summary.json]');
  console.log('       node scripts/validate-compat-report-schemas.mjs --summary <summary.json> [--report-dir <dir>]');
  console.log('       node scripts/validate-compat-report-schemas.mjs --summary-schema <schema.json> --case-schema <schema.json>');
  console.log('');
  console.log('Resolution order:');
  console.log('  summary path : --summary | positional arg | COMPAT_SUMMARY_PATH | COMPAT_REPORT_DIR/summary.json');
  console.log('  report dir   : --report-dir | COMPAT_REPORT_DIR | dirname(summary path)');
  console.log('  summary schema: --summary-schema | schemas/compat-summary.schema.json');
  console.log('  case schema   : --case-schema | schemas/compat-case-report.schema.json');
  console.log('  flags         : --allow-missing-case-reports');
  console.log('                  --json, --out <file>');
}

function writeResultPayload(outPath, payload) {
  writeValidatedJsonPayload(outPath, payload, ensureCompatReportSchemaValidatorPayloadShape);
}

function resolvePaths(args) {
  const reportDir = args.reportDir && args.reportDir.trim()
    ? path.resolve(process.cwd(), args.reportDir)
    : (
      process.env.COMPAT_REPORT_DIR && process.env.COMPAT_REPORT_DIR.trim()
        ? path.resolve(process.cwd(), process.env.COMPAT_REPORT_DIR)
        : ''
    );

  if (args.summaryPath && args.summaryPath.trim()) {
    const summaryPath = path.resolve(process.cwd(), args.summaryPath);
    return {
      summaryPath,
      reportDir: reportDir || path.dirname(summaryPath)
    };
  }

  if (process.env.COMPAT_SUMMARY_PATH && process.env.COMPAT_SUMMARY_PATH.trim()) {
    const summaryPath = path.resolve(process.cwd(), process.env.COMPAT_SUMMARY_PATH);
    return {
      summaryPath,
      reportDir: reportDir || path.dirname(summaryPath)
    };
  }

  if (reportDir) {
    return {
      summaryPath: path.join(reportDir, 'summary.json'),
      reportDir
    };
  }

  throw new Error('Missing summary path. Provide <summary.json>, COMPAT_SUMMARY_PATH, or COMPAT_REPORT_DIR.');
}

function resolveSchemaPath(value, fallback) {
  if (value && value.trim()) {
    return path.resolve(process.cwd(), value);
  }
  return path.resolve(process.cwd(), fallback);
}

function main() {
  const args = parseCliArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const { summaryPath, reportDir } = resolvePaths(args);
  const summarySchemaPath = resolveSchemaPath(args.summarySchemaPath, COMPAT_CONTRACT_PATHS.summarySchema);
  const caseSchemaPath = resolveSchemaPath(args.caseSchemaPath, COMPAT_CONTRACT_PATHS.caseReportSchema);
  const summary = loadJsonObject(summaryPath, 'compat summary');
  const ajv = createJsonSchemaAjv();
  const { validate: validateSummary } = compileSchemaFromPath(ajv, summarySchemaPath, 'compat summary');
  const { validate: validateCaseReport } = compileSchemaFromPath(ajv, caseSchemaPath, 'compat case-report');
  validateWithCompiledSchema(validateSummary, summarySchemaPath, summary, 'compat summary');

  let validatedCaseReports = 0;
  if (!args.allowMissingCaseReports && summary.mode === 'fixtures') {
    const results = Array.isArray(summary.results) ? summary.results : [];
    for (const result of results) {
      const caseName = String(result?.name ?? '');
      const caseReportPath = path.join(reportDir, `${caseName}.json`);
      if (!fs.existsSync(caseReportPath)) {
        throw new Error(`Missing case report for summary result: ${caseName}`);
      }
      const caseReport = loadJsonObject(caseReportPath, `compat case report (${caseName})`);
      validateWithCompiledSchema(validateCaseReport, caseSchemaPath, caseReport, `compat case report (${caseName})`);
      validatedCaseReports += 1;
    }
  }

  const caseReportMode = args.allowMissingCaseReports ? 'skipped-case-reports' : 'validated-case-reports';
  const payload = buildCompatReportSchemaValidatorSuccessPayload({
    mode: summary.mode,
    summaryPath,
    reportDir,
    summarySchemaPath,
    caseSchemaPath,
    validatedCaseReports,
    caseReportMode
  });
  if (args.outPath) {
    writeResultPayload(args.outPath, payload);
  }
  if (args.json) {
    console.log(JSON.stringify(payload));
    return;
  }

  console.log(
    `Compatibility report schema validation passed mode=${summary.mode} summary=${summaryPath} reportDir=${reportDir} validatedCaseReports=${validatedCaseReports} ${caseReportMode}`
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
  const payload = buildCompatReportSchemaValidatorErrorPayload(message);
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
