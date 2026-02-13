export const REQUIRED_COMPAT_NPM_SCRIPT_NAMES = Object.freeze([
  'test:compat-summary:fast',
  'test:compat-report-stack:fast',
  'test:compat-validator-stack:fast',
  'test:compat-artifact-stack:fast',
  'test:compat-artifact-alignment:fast',
  'test:compat-artifact-cli-drift:fast'
]);

export const REQUIRED_COMPAT_ARTIFACT_CLI_DRIFT_PATHS = Object.freeze([
  'scripts/validate-compat-artifact-bundle-manifest.test.js',
  'scripts/validate-compat-artifact-bundle.test.js'
]);

export const REQUIRED_COMPAT_ARTIFACT_STACK_SEQUENCE = Object.freeze([
  'npm run test:compat-artifact-alignment:fast',
  'npm run test:compat-artifact-cli-drift:fast',
  'npm run test:compat-artifact-bundle:manifest:schema',
  'npm run test:compat-artifact-bundle:manifest:verify:report',
  'npm run test:compat-artifact-bundle:manifest:verify:schema',
  'npm run test:compat-artifact-bundle:verify:report',
  'npm run test:compat-artifact-bundle:verify:schema'
]);

export const REQUIRED_COMPAT_REPORT_STACK_SEQUENCE = Object.freeze([
  'npm run test:compat-report-schemas:verify:report',
  'npm run test:compat-report-schemas:verify:schema',
  'npm run test:compat-validator-stack:fast',
  'npm run test:compat-artifact-stack:fast'
]);

export const REQUIRED_COMPAT_SUMMARY_STACK_SEQUENCE = Object.freeze([
  'npm run test:compat-fixtures:fast',
  'node scripts/validate-compat-summary.mjs --out',
  'npm run test:compat-report-stack:fast'
]);
