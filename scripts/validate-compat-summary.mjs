import * as fs from 'fs';
import * as path from 'path';
import {
  loadCompatSummary,
  validateCompatSummaryCaseReports
} from './lib/compat-fixture-runner.mjs';

const COMPAT_SUMMARY_VALIDATION_OUTPUT_SCHEMA_VERSION = 1;

function parseCliArgs(argv) {
  const parsed = {
    summaryPath: '',
    reportDir: '',
    help: false,
    allowMissingCaseReports: false,
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
    if (value === '--allow-missing-case-reports') {
      parsed.allowMissingCaseReports = true;
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
    if (value === '--summary') {
      const nextValue = argv[index + 1];
      if (!nextValue || nextValue.startsWith('--')) {
        throw new Error('Missing value for --summary');
      }
      parsed.summaryPath = nextValue;
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
    positional.push(value);
  }

  if (!parsed.summaryPath && positional.length > 0) {
    parsed.summaryPath = positional[0];
  }

  return parsed;
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

function printHelp() {
  console.log('Usage: node scripts/validate-compat-summary.mjs [summary.json]');
  console.log('       node scripts/validate-compat-summary.mjs --summary <summary.json> [--report-dir <dir>]');
  console.log('       node scripts/validate-compat-summary.mjs --summary <summary.json> --allow-missing-case-reports');
  console.log('       node scripts/validate-compat-summary.mjs --summary <summary.json> --json');
  console.log('       node scripts/validate-compat-summary.mjs --summary <summary.json> --out <output.json>');
  console.log('');
  console.log('Resolution order:');
  console.log('  summary path: --summary | positional arg | COMPAT_SUMMARY_PATH | COMPAT_REPORT_DIR/summary.json');
  console.log('  report dir : --report-dir | COMPAT_REPORT_DIR | dirname(summary path)');
  console.log('  flags      : --allow-missing-case-reports (skip fixtures case-report file validation)');
  console.log('               --json (emit machine-readable success payload)');
  console.log('               --out <output.json> (write machine-readable result payload to file)');
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

function writeResultPayload(outPath, payload) {
  const resolvedPath = path.resolve(process.cwd(), outPath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  fs.writeFileSync(resolvedPath, JSON.stringify(payload, null, 2), 'utf-8');
}

function main() {
  const args = parseCliArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }
  const { summaryPath, reportDir } = resolvePaths(args);
  const summary = loadCompatSummary(summaryPath);
  if (!args.allowMissingCaseReports) {
    validateCompatSummaryCaseReports(summary, reportDir);
  }

  const resultCount = Array.isArray(summary.results) ? summary.results.length : 0;
  const caseReportMode = args.allowMissingCaseReports ? 'skipped-case-reports' : 'validated-case-reports';
  const payload = {
    outputSchemaVersion: COMPAT_SUMMARY_VALIDATION_OUTPUT_SCHEMA_VERSION,
    status: 'ok',
    summarySchemaVersion: summary.summarySchemaVersion,
    fixtureSchemaVersion: summary.schemaVersion,
    mode: summary.mode,
    selectedTotal: summary.selectedTotal,
    resultCount,
    summaryPath,
    reportDir,
    caseReportMode
  };
  if (args.outPath) {
    writeResultPayload(args.outPath, payload);
  }

  if (args.json) {
    console.log(JSON.stringify(payload));
    return;
  }

  console.log(`Compatibility summary validation passed (${summary.mode}) selected=${summary.selectedTotal} results=${resultCount} reportDir=${reportDir} ${caseReportMode}`);
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
  const payload = {
    outputSchemaVersion: COMPAT_SUMMARY_VALIDATION_OUTPUT_SCHEMA_VERSION,
    status: 'error',
    error: message
  };
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
