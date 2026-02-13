import * as path from 'path';

export const COMPAT_CONTRACT_PATHS = Object.freeze({
  summarySchema: path.join('schemas', 'compat-summary.schema.json'),
  caseReportSchema: path.join('schemas', 'compat-case-report.schema.json'),
  artifactBundleManifest: path.join('schemas', 'compat-artifact-bundle.manifest.json')
});

function resolveFromCwd(relativePath, cwd) {
  return path.resolve(cwd, relativePath);
}

export function resolveCompatSummarySchemaPath(cwd = process.cwd()) {
  return resolveFromCwd(COMPAT_CONTRACT_PATHS.summarySchema, cwd);
}

export function resolveCompatCaseReportSchemaPath(cwd = process.cwd()) {
  return resolveFromCwd(COMPAT_CONTRACT_PATHS.caseReportSchema, cwd);
}

export function resolveCompatArtifactBundleManifestPath(cwd = process.cwd()) {
  return resolveFromCwd(COMPAT_CONTRACT_PATHS.artifactBundleManifest, cwd);
}
