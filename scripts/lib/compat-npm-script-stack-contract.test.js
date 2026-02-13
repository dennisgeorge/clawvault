import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  REQUIRED_COMPAT_ARTIFACT_CLI_DRIFT_PATHS,
  REQUIRED_COMPAT_ARTIFACT_STACK_SEQUENCE,
  REQUIRED_COMPAT_NPM_SCRIPT_NAMES,
  REQUIRED_COMPAT_REPORT_STACK_SEQUENCE,
  REQUIRED_COMPAT_SUMMARY_STACK_SEQUENCE
} from './compat-npm-script-contracts.mjs';

function loadPackageScripts() {
  const packageJsonPath = path.resolve(process.cwd(), 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  return packageJson.scripts ?? {};
}

function expectContainsInOrder(value, parts, label) {
  let cursor = -1;
  for (const part of parts) {
    const nextIndex = value.indexOf(part, cursor + 1);
    expect(nextIndex, `${label} is missing segment: ${part}`).toBeGreaterThanOrEqual(0);
    cursor = nextIndex;
  }
}

describe('compat npm script stack contracts', () => {
  it('keeps required compat script names present', () => {
    const scripts = loadPackageScripts();
    for (const scriptName of REQUIRED_COMPAT_NPM_SCRIPT_NAMES) {
      expect(typeof scripts[scriptName], `missing required script: ${scriptName}`).toBe('string');
    }
  });

  it('keeps dedicated artifact CLI drift script wired to both validator suites', () => {
    const scripts = loadPackageScripts();
    const cliDriftScript = scripts['test:compat-artifact-cli-drift:fast'];
    expect(typeof cliDriftScript).toBe('string');
    for (const driftPath of REQUIRED_COMPAT_ARTIFACT_CLI_DRIFT_PATHS) {
      expect(cliDriftScript).toContain(driftPath);
    }
  });

  it('keeps fast artifact stack ordering aligned with required contract gates', () => {
    const scripts = loadPackageScripts();
    const artifactStackScript = scripts['test:compat-artifact-stack:fast'];
    expect(typeof artifactStackScript).toBe('string');
    expectContainsInOrder(
      artifactStackScript,
      REQUIRED_COMPAT_ARTIFACT_STACK_SEQUENCE,
      'test:compat-artifact-stack:fast'
    );
  });

  it('keeps fast report stack chained through validator/artifact stacks', () => {
    const scripts = loadPackageScripts();
    const reportStackScript = scripts['test:compat-report-stack:fast'];
    expect(typeof reportStackScript).toBe('string');
    expectContainsInOrder(
      reportStackScript,
      REQUIRED_COMPAT_REPORT_STACK_SEQUENCE,
      'test:compat-report-stack:fast'
    );
  });

  it('keeps fast summary stack chained through report stack', () => {
    const scripts = loadPackageScripts();
    const summaryFastScript = scripts['test:compat-summary:fast'];
    expect(typeof summaryFastScript).toBe('string');
    expectContainsInOrder(
      summaryFastScript,
      REQUIRED_COMPAT_SUMMARY_STACK_SEQUENCE,
      'test:compat-summary:fast'
    );
  });
});
