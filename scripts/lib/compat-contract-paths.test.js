import { describe, expect, it } from 'vitest';
import * as path from 'path';
import {
  COMPAT_CONTRACT_PATHS,
  resolveCompatArtifactBundleManifestPath,
  resolveCompatCaseReportSchemaPath,
  resolveCompatSummarySchemaPath
} from './compat-contract-paths.mjs';

describe('compat contract paths', () => {
  it('exposes stable relative contract paths', () => {
    expect(COMPAT_CONTRACT_PATHS).toEqual({
      summarySchema: path.join('schemas', 'compat-summary.schema.json'),
      caseReportSchema: path.join('schemas', 'compat-case-report.schema.json'),
      artifactBundleManifest: path.join('schemas', 'compat-artifact-bundle.manifest.json')
    });
  });

  it('resolves contract paths from an explicit cwd', () => {
    const fakeCwd = '/tmp/clawvault';
    expect(resolveCompatSummarySchemaPath(fakeCwd)).toBe('/tmp/clawvault/schemas/compat-summary.schema.json');
    expect(resolveCompatCaseReportSchemaPath(fakeCwd)).toBe('/tmp/clawvault/schemas/compat-case-report.schema.json');
    expect(resolveCompatArtifactBundleManifestPath(fakeCwd)).toBe('/tmp/clawvault/schemas/compat-artifact-bundle.manifest.json');
  });
});
