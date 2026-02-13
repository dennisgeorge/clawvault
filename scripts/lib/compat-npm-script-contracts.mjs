import {
  REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_DEFINITIONS
} from './compat-artifact-bundle-contracts.mjs';

export const REQUIRED_COMPAT_NPM_SCRIPT_NAMES = Object.freeze([
  'ci',
  'test:compat-script-stack-contract:fast',
  'test:compat-summary:fast',
  'test:compat-report-stack:fast',
  'test:compat-validator-stack:fast',
  'test:compat-artifact-stack:fast',
  'test:compat-artifact-alignment:fast',
  'test:compat-artifact-cli-drift:fast'
]);

export const REQUIRED_COMPAT_CI_REACHABLE_SCRIPT_NAMES = Object.freeze([
  ...REQUIRED_COMPAT_NPM_SCRIPT_NAMES
]);

export const REQUIRED_COMPAT_SCRIPT_REFERENCE_SOURCES = Object.freeze([
  'ci',
  'test:compat-summary:fast',
  'test:compat-report-stack:fast',
  'test:compat-validator-stack:fast',
  'test:compat-artifact-stack:fast'
]);

export const REQUIRED_COMPAT_ARTIFACT_CLI_DRIFT_PATHS = Object.freeze([
  'scripts/validate-compat-artifact-bundle-manifest.test.js',
  'scripts/validate-compat-artifact-bundle.test.js'
]);

export const REQUIRED_COMPAT_SCRIPT_STACK_CONTRACT_TEST_PATHS = Object.freeze([
  'scripts/lib/compat-npm-script-contracts.test.js',
  'scripts/lib/compat-npm-script-graph-utils.test.js',
  'scripts/lib/compat-npm-script-stack-contract.test.js',
  'scripts/lib/compat-readme-contract.test.js',
  'scripts/lib/compat-ci-workflow-test-utils.test.js',
  'scripts/lib/compat-ci-workflow-contracts.test.js',
  'scripts/lib/compat-ci-workflow-contract.test.js'
]);

export const REQUIRED_COMPAT_README_PATH = 'README.md';
export const REQUIRED_COMPAT_README_CI_ARTIFACTS_LINE_PREFIX = '# in CI, compat-summary artifacts now include ';
export const REQUIRED_COMPAT_README_SCRIPT_REFERENCE_COMMANDS = Object.freeze(
  REQUIRED_COMPAT_SCRIPT_REFERENCE_SOURCES.map((scriptName) => `npm run ${scriptName}`)
);

const REQUIRED_COMPAT_CI_UPLOAD_ARTIFACT_DEFINITION_FILES = REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_DEFINITIONS
  .map((definition) => definition.artifactFile)
  .filter((artifactFile) => artifactFile !== 'artifact-bundle-manifest-validator-result.json');

export const REQUIRED_COMPAT_CI_UPLOAD_ARTIFACT_FILES = Object.freeze([
  ...REQUIRED_COMPAT_CI_UPLOAD_ARTIFACT_DEFINITION_FILES,
  'artifact-bundle-validator-result.json',
  'artifact-bundle-manifest-validator-result.json'
]);

export const REQUIRED_COMPAT_CI_WORKFLOW_NAME = 'CI';
export const REQUIRED_COMPAT_CI_WORKFLOW_UNIQUE_FIELD_NAMES = Object.freeze([
  'name',
  'on',
  'jobs'
]);
export const REQUIRED_COMPAT_CI_WORKFLOW_FIELD_NAMES = Object.freeze([
  ...REQUIRED_COMPAT_CI_WORKFLOW_UNIQUE_FIELD_NAMES
]);
export const REQUIRED_COMPAT_CI_TRIGGER_PUSH_BRANCHES = Object.freeze([
  'main',
  'master',
  'cursor/**'
]);
export const REQUIRED_COMPAT_CI_TRIGGER_NAMES = Object.freeze([
  'push',
  'pull_request'
]);
export const REQUIRED_COMPAT_CI_TRIGGER_SECTION_FIELD_NAME_SEQUENCES = Object.freeze({
  push: Object.freeze(['branches']),
  pull_request: Object.freeze([])
});

export const REQUIRED_COMPAT_CI_UPLOAD_ARTIFACT_PATH_PREFIX = '${{ runner.temp }}/compat-reports/';
export const REQUIRED_COMPAT_CI_UPLOAD_STEP_NAME = 'Upload compatibility summary artifact';
export const REQUIRED_COMPAT_CI_UPLOAD_ARTIFACT_NAME = 'compat-summary';
export const REQUIRED_COMPAT_CI_UPLOAD_CONDITION = 'always()';
export const REQUIRED_COMPAT_CI_UPLOAD_USES = 'actions/upload-artifact@v4';
export const REQUIRED_COMPAT_CI_UPLOAD_IF_NO_FILES_FOUND = 'ignore';
export const REQUIRED_COMPAT_CI_FAILURE_UPLOAD_STEP_NAME = 'Upload compatibility reports on failure';
export const REQUIRED_COMPAT_CI_FAILURE_UPLOAD_CONDITION = 'failure()';
export const REQUIRED_COMPAT_CI_FAILURE_UPLOAD_ARTIFACT_NAME = 'compat-reports';
export const REQUIRED_COMPAT_CI_FAILURE_UPLOAD_USES = 'actions/upload-artifact@v4';
export const REQUIRED_COMPAT_CI_FAILURE_UPLOAD_PATH = '${{ runner.temp }}/compat-reports';
export const REQUIRED_COMPAT_CI_FAILURE_UPLOAD_IF_NO_FILES_FOUND = 'ignore';
export const REQUIRED_COMPAT_CI_PRIMARY_RUN_STEP_NAME = 'Run quality and compatibility checks';
export const REQUIRED_COMPAT_CI_PRIMARY_RUN_COMMAND = 'npm run ci';
export const REQUIRED_COMPAT_CI_REPORT_DIR_ENV_KEY = 'COMPAT_REPORT_DIR';
export const REQUIRED_COMPAT_CI_REPORT_DIR_ENV_VALUE = '${{ runner.temp }}/compat-reports';
export const REQUIRED_COMPAT_CI_CHECKOUT_STEP_NAME = 'Checkout';
export const REQUIRED_COMPAT_CI_CHECKOUT_USES = 'actions/checkout@v4';
export const REQUIRED_COMPAT_CI_JOB_NAME = 'test-and-compat';
export const REQUIRED_COMPAT_CI_JOB_NAMES = Object.freeze([
  REQUIRED_COMPAT_CI_JOB_NAME
]);
export const REQUIRED_COMPAT_CI_JOB_RUNS_ON = 'ubuntu-latest';
export const REQUIRED_COMPAT_CI_JOB_TIMEOUT_MINUTES = '15';
export const REQUIRED_COMPAT_CI_JOB_UNIQUE_FIELD_NAMES = Object.freeze([
  'runs-on',
  'timeout-minutes',
  'steps'
]);
export const REQUIRED_COMPAT_CI_JOB_FIELD_NAMES = Object.freeze([
  ...REQUIRED_COMPAT_CI_JOB_UNIQUE_FIELD_NAMES
]);
export const REQUIRED_COMPAT_CI_JOB_FIELD_NAME_SEQUENCES = Object.freeze({
  [REQUIRED_COMPAT_CI_JOB_NAME]: REQUIRED_COMPAT_CI_JOB_FIELD_NAMES
});
export const REQUIRED_COMPAT_CI_JOB_TOP_LEVEL_SCALAR_VALUE_CONTRACTS = Object.freeze({
  [REQUIRED_COMPAT_CI_JOB_NAME]: Object.freeze({
    'runs-on': REQUIRED_COMPAT_CI_JOB_RUNS_ON,
    'timeout-minutes': REQUIRED_COMPAT_CI_JOB_TIMEOUT_MINUTES
  })
});
export const REQUIRED_COMPAT_CI_SETUP_NODE_STEP_NAME = 'Setup Node';
export const REQUIRED_COMPAT_CI_SETUP_NODE_USES = 'actions/setup-node@v4';
export const REQUIRED_COMPAT_CI_SETUP_NODE_VERSION = '20';
export const REQUIRED_COMPAT_CI_SETUP_NODE_CACHE = 'npm';
export const REQUIRED_COMPAT_CI_INSTALL_STEP_NAME = 'Install dependencies';
export const REQUIRED_COMPAT_CI_INSTALL_COMMAND = 'npm ci';
export const REQUIRED_COMPAT_CI_STEP_SEQUENCE = Object.freeze([
  REQUIRED_COMPAT_CI_CHECKOUT_STEP_NAME,
  REQUIRED_COMPAT_CI_SETUP_NODE_STEP_NAME,
  REQUIRED_COMPAT_CI_INSTALL_STEP_NAME,
  REQUIRED_COMPAT_CI_PRIMARY_RUN_STEP_NAME,
  REQUIRED_COMPAT_CI_FAILURE_UPLOAD_STEP_NAME,
  REQUIRED_COMPAT_CI_UPLOAD_STEP_NAME
]);
export const REQUIRED_COMPAT_CI_STEP_NAMES = Object.freeze([
  ...REQUIRED_COMPAT_CI_STEP_SEQUENCE
]);
export const REQUIRED_COMPAT_CI_JOB_STEP_NAME_SEQUENCES = Object.freeze({
  [REQUIRED_COMPAT_CI_JOB_NAME]: REQUIRED_COMPAT_CI_STEP_NAMES
});
export const REQUIRED_COMPAT_CI_STEP_FIELD_NAME_SEQUENCES = Object.freeze({
  [REQUIRED_COMPAT_CI_CHECKOUT_STEP_NAME]: Object.freeze(['name', 'uses']),
  [REQUIRED_COMPAT_CI_SETUP_NODE_STEP_NAME]: Object.freeze(['name', 'uses', 'with']),
  [REQUIRED_COMPAT_CI_INSTALL_STEP_NAME]: Object.freeze(['name', 'run']),
  [REQUIRED_COMPAT_CI_PRIMARY_RUN_STEP_NAME]: Object.freeze(['name', 'run', 'env']),
  [REQUIRED_COMPAT_CI_FAILURE_UPLOAD_STEP_NAME]: Object.freeze(['name', 'if', 'uses', 'with']),
  [REQUIRED_COMPAT_CI_UPLOAD_STEP_NAME]: Object.freeze(['name', 'if', 'uses', 'with'])
});
export const REQUIRED_COMPAT_CI_STEP_WITH_FIELD_NAME_SEQUENCES = Object.freeze({
  [REQUIRED_COMPAT_CI_SETUP_NODE_STEP_NAME]: Object.freeze(['node-version', 'cache']),
  [REQUIRED_COMPAT_CI_FAILURE_UPLOAD_STEP_NAME]: Object.freeze(['name', 'path', 'if-no-files-found']),
  [REQUIRED_COMPAT_CI_UPLOAD_STEP_NAME]: Object.freeze(['name', 'path', 'if-no-files-found'])
});
export const REQUIRED_COMPAT_CI_STEP_ENV_FIELD_NAME_SEQUENCES = Object.freeze({
  [REQUIRED_COMPAT_CI_PRIMARY_RUN_STEP_NAME]: Object.freeze([REQUIRED_COMPAT_CI_REPORT_DIR_ENV_KEY])
});
export const REQUIRED_COMPAT_CI_STEP_TOP_LEVEL_SCALAR_VALUE_CONTRACTS = Object.freeze({
  [REQUIRED_COMPAT_CI_CHECKOUT_STEP_NAME]: Object.freeze({
    uses: REQUIRED_COMPAT_CI_CHECKOUT_USES
  }),
  [REQUIRED_COMPAT_CI_SETUP_NODE_STEP_NAME]: Object.freeze({
    uses: REQUIRED_COMPAT_CI_SETUP_NODE_USES
  }),
  [REQUIRED_COMPAT_CI_INSTALL_STEP_NAME]: Object.freeze({
    run: REQUIRED_COMPAT_CI_INSTALL_COMMAND
  }),
  [REQUIRED_COMPAT_CI_PRIMARY_RUN_STEP_NAME]: Object.freeze({
    run: REQUIRED_COMPAT_CI_PRIMARY_RUN_COMMAND
  }),
  [REQUIRED_COMPAT_CI_FAILURE_UPLOAD_STEP_NAME]: Object.freeze({
    if: REQUIRED_COMPAT_CI_FAILURE_UPLOAD_CONDITION,
    uses: REQUIRED_COMPAT_CI_FAILURE_UPLOAD_USES
  }),
  [REQUIRED_COMPAT_CI_UPLOAD_STEP_NAME]: Object.freeze({
    if: REQUIRED_COMPAT_CI_UPLOAD_CONDITION,
    uses: REQUIRED_COMPAT_CI_UPLOAD_USES
  })
});
export const REQUIRED_COMPAT_CI_STEP_WITH_SCALAR_VALUE_CONTRACTS = Object.freeze({
  [REQUIRED_COMPAT_CI_SETUP_NODE_STEP_NAME]: Object.freeze({
    'node-version': REQUIRED_COMPAT_CI_SETUP_NODE_VERSION,
    cache: REQUIRED_COMPAT_CI_SETUP_NODE_CACHE
  }),
  [REQUIRED_COMPAT_CI_FAILURE_UPLOAD_STEP_NAME]: Object.freeze({
    name: REQUIRED_COMPAT_CI_FAILURE_UPLOAD_ARTIFACT_NAME,
    path: REQUIRED_COMPAT_CI_FAILURE_UPLOAD_PATH,
    'if-no-files-found': REQUIRED_COMPAT_CI_FAILURE_UPLOAD_IF_NO_FILES_FOUND
  }),
  [REQUIRED_COMPAT_CI_UPLOAD_STEP_NAME]: Object.freeze({
    name: REQUIRED_COMPAT_CI_UPLOAD_ARTIFACT_NAME,
    'if-no-files-found': REQUIRED_COMPAT_CI_UPLOAD_IF_NO_FILES_FOUND
  })
});
export const REQUIRED_COMPAT_CI_STEP_ENV_SCALAR_VALUE_CONTRACTS = Object.freeze({
  [REQUIRED_COMPAT_CI_PRIMARY_RUN_STEP_NAME]: Object.freeze({
    [REQUIRED_COMPAT_CI_REPORT_DIR_ENV_KEY]: REQUIRED_COMPAT_CI_REPORT_DIR_ENV_VALUE
  })
});

export const REQUIRED_COMPAT_ARTIFACT_STACK_SEQUENCE = Object.freeze([
  'npm run test:compat-artifact-alignment:fast',
  'npm run test:compat-artifact-cli-drift:fast',
  'npm run test:compat-artifact-bundle:manifest:schema',
  'npm run test:compat-artifact-bundle:manifest:verify:report',
  'npm run test:compat-artifact-bundle:manifest:verify:schema',
  'npm run test:compat-artifact-bundle:verify:report',
  'npm run test:compat-artifact-bundle:verify:schema'
]);

function deriveNpmRunTargets(sequence) {
  return Object.freeze(
    sequence
      .filter((segment) => segment.startsWith('npm run '))
      .map((segment) => segment.slice('npm run '.length).split(' ')[0])
  );
}

export const REQUIRED_COMPAT_ARTIFACT_STACK_RUN_TARGETS = deriveNpmRunTargets(REQUIRED_COMPAT_ARTIFACT_STACK_SEQUENCE);

export const REQUIRED_COMPAT_REPORT_STACK_SEQUENCE = Object.freeze([
  'npm run test:compat-report-schemas:verify:report',
  'npm run test:compat-report-schemas:verify:schema',
  'npm run test:compat-validator-stack:fast',
  'npm run test:compat-artifact-stack:fast'
]);
export const REQUIRED_COMPAT_REPORT_STACK_RUN_TARGETS = deriveNpmRunTargets(REQUIRED_COMPAT_REPORT_STACK_SEQUENCE);

export const REQUIRED_COMPAT_VALIDATOR_STACK_SEQUENCE = Object.freeze([
  'npm run test:compat-validator-result:verify:report',
  'npm run test:compat-validator-result:schema',
  'npm run test:compat-schema-validator-result:verify',
  'npm run test:compat-validator-result:verify:schema'
]);
export const REQUIRED_COMPAT_VALIDATOR_STACK_RUN_TARGETS = deriveNpmRunTargets(REQUIRED_COMPAT_VALIDATOR_STACK_SEQUENCE);

export const REQUIRED_COMPAT_SUMMARY_STACK_SEQUENCE = Object.freeze([
  'npm run test:compat-script-stack-contract:fast',
  'npm run test:compat-fixtures:fast',
  'node scripts/validate-compat-summary.mjs --out',
  'npm run test:compat-report-stack:fast'
]);
export const REQUIRED_COMPAT_SUMMARY_STACK_RUN_TARGETS = deriveNpmRunTargets(REQUIRED_COMPAT_SUMMARY_STACK_SEQUENCE);

export const REQUIRED_COMPAT_CI_SEQUENCE = Object.freeze([
  'npm run test:compat-script-stack-contract:fast',
  'npm run typecheck',
  'npm test',
  'npm run build',
  'npm run test:compat-contract:fast',
  'npm run test:compat-summary:fast'
]);
export const REQUIRED_COMPAT_CI_RUN_TARGETS = deriveNpmRunTargets(REQUIRED_COMPAT_CI_SEQUENCE);

export const REQUIRED_COMPAT_ARTIFACT_PRODUCER_CONSUMER_CONTRACTS = Object.freeze([
  Object.freeze({
    scriptName: 'test:compat-validator-stack:fast',
    artifactFile: 'validator-result-verifier-result.json',
    producerSegment: 'npm run test:compat-validator-result:verify:report',
    consumerSegment: 'npm run test:compat-validator-result:verify:schema'
  }),
  Object.freeze({
    scriptName: 'test:compat-validator-stack:fast',
    artifactFile: 'schema-validator-result.json',
    producerSegment: 'npm run test:compat-validator-result:schema',
    consumerSegment: 'npm run test:compat-schema-validator-result:verify'
  }),
  Object.freeze({
    scriptName: 'test:compat-report-stack:fast',
    artifactFile: 'report-schema-validator-result.json',
    producerSegment: 'npm run test:compat-report-schemas:verify:report',
    consumerSegment: 'npm run test:compat-report-schemas:verify:schema'
  }),
  Object.freeze({
    scriptName: 'test:compat-artifact-stack:fast',
    artifactFile: 'artifact-bundle-manifest-validator-result.json',
    producerSegment: 'npm run test:compat-artifact-bundle:manifest:verify:report',
    consumerSegment: 'npm run test:compat-artifact-bundle:manifest:verify:schema'
  }),
  Object.freeze({
    scriptName: 'test:compat-artifact-stack:fast',
    artifactFile: 'artifact-bundle-validator-result.json',
    producerSegment: 'npm run test:compat-artifact-bundle:verify:report',
    consumerSegment: 'npm run test:compat-artifact-bundle:verify:schema'
  })
]);
