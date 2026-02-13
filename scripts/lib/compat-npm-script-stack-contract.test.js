import { beforeAll, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  REQUIRED_COMPAT_ARTIFACT_PRODUCER_CONSUMER_CONTRACTS,
  REQUIRED_COMPAT_CI_REACHABLE_SCRIPT_NAMES,
  REQUIRED_COMPAT_CI_RUN_TARGETS,
  REQUIRED_COMPAT_CI_SEQUENCE,
  REQUIRED_COMPAT_ARTIFACT_CLI_DRIFT_PATHS,
  REQUIRED_COMPAT_ARTIFACT_STACK_RUN_TARGETS,
  REQUIRED_COMPAT_ARTIFACT_STACK_SEQUENCE,
  REQUIRED_COMPAT_NPM_SCRIPT_NAMES,
  REQUIRED_COMPAT_REPORT_STACK_RUN_TARGETS,
  REQUIRED_COMPAT_REPORT_STACK_SEQUENCE,
  REQUIRED_COMPAT_SCRIPT_STACK_CONTRACT_TEST_PATHS,
  REQUIRED_COMPAT_SCRIPT_REFERENCE_SOURCES,
  REQUIRED_COMPAT_SUMMARY_STACK_RUN_TARGETS,
  REQUIRED_COMPAT_SUMMARY_STACK_SEQUENCE,
  REQUIRED_COMPAT_VALIDATOR_STACK_RUN_TARGETS,
  REQUIRED_COMPAT_VALIDATOR_STACK_SEQUENCE
} from './compat-npm-script-contracts.mjs';
import {
  expectArrayContainsAllValues,
  expectKeyedNonEmptyStringValues,
  expectNonEmptyString,
  expectStringSegmentPairOrderedAndUnique,
  expectStringContainsSegmentsExactlyOnce,
  expectStringContainsSegmentsExactlyOnceInOrder
} from './compat-contract-assertion-test-utils.js';
import {
  buildReachableNpmRunGraph,
  collectNpmRunTargets,
  hasReachableNpmRunCycle
} from './compat-npm-script-graph-utils.mjs';

function loadPackageScripts() {
  const packageJsonPath = path.resolve(process.cwd(), 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  return packageJson.scripts ?? {};
}

describe('compat npm script stack contracts', () => {
  let scripts = {};

  beforeAll(() => {
    scripts = loadPackageScripts();
  });

  it('keeps required compat script names present', () => {
    expectKeyedNonEmptyStringValues(
      scripts,
      REQUIRED_COMPAT_NPM_SCRIPT_NAMES,
      'required compat script domain',
      { requireExactKeyDomain: false }
    );
  });

  it('keeps npm-run references resolvable across required stack sources', () => {
    const { unresolvedScripts } = buildReachableNpmRunGraph({
      scripts,
      sourceScripts: REQUIRED_COMPAT_SCRIPT_REFERENCE_SOURCES
    });
    expect(
      [...unresolvedScripts],
      'missing npm-run targets detected in reachable compat stack graph'
    ).toEqual([]);
  });

  it('keeps reachable compat npm-run graph acyclic', () => {
    const { unresolvedScripts, adjacencyByScript } = buildReachableNpmRunGraph({
      scripts,
      sourceScripts: REQUIRED_COMPAT_SCRIPT_REFERENCE_SOURCES
    });
    expect(
      [...unresolvedScripts],
      'cannot evaluate cycle contracts with unresolved npm-run targets'
    ).toEqual([]);
    expect(
      hasReachableNpmRunCycle(adjacencyByScript, adjacencyByScript.keys()),
      'cycle detected in reachable compat npm-run graph'
    ).toBe(false);
  });

  it('keeps dedicated artifact CLI drift script wired to both validator suites', () => {
    const cliDriftScript = scripts['test:compat-artifact-cli-drift:fast'];
    expectNonEmptyString(cliDriftScript, 'test:compat-artifact-cli-drift:fast');
    expectStringContainsSegmentsExactlyOnce(
      cliDriftScript,
      REQUIRED_COMPAT_ARTIFACT_CLI_DRIFT_PATHS,
      'test:compat-artifact-cli-drift:fast'
    );
  });

  it('keeps script-stack contract runner wired to all governance suites', () => {
    const stackContractScript = scripts['test:compat-script-stack-contract:fast'];
    expectNonEmptyString(stackContractScript, 'test:compat-script-stack-contract:fast');
    expectStringContainsSegmentsExactlyOnce(
      stackContractScript,
      REQUIRED_COMPAT_SCRIPT_STACK_CONTRACT_TEST_PATHS,
      'test:compat-script-stack-contract:fast'
    );
  });

  it('keeps fast artifact stack ordering aligned with required contract gates', () => {
    const artifactStackScript = scripts['test:compat-artifact-stack:fast'];
    expectNonEmptyString(artifactStackScript, 'test:compat-artifact-stack:fast');
    expectStringContainsSegmentsExactlyOnceInOrder(
      artifactStackScript,
      REQUIRED_COMPAT_ARTIFACT_STACK_SEQUENCE,
      'test:compat-artifact-stack:fast'
    );
    expect(collectNpmRunTargets(artifactStackScript)).toEqual(REQUIRED_COMPAT_ARTIFACT_STACK_RUN_TARGETS);
  });

  it('keeps fast report stack chained through validator/artifact stacks', () => {
    const reportStackScript = scripts['test:compat-report-stack:fast'];
    expectNonEmptyString(reportStackScript, 'test:compat-report-stack:fast');
    expectStringContainsSegmentsExactlyOnceInOrder(
      reportStackScript,
      REQUIRED_COMPAT_REPORT_STACK_SEQUENCE,
      'test:compat-report-stack:fast'
    );
    expect(collectNpmRunTargets(reportStackScript)).toEqual(REQUIRED_COMPAT_REPORT_STACK_RUN_TARGETS);
  });

  it('keeps fast validator stack sequence ordered for verifier/schema gates', () => {
    const validatorStackScript = scripts['test:compat-validator-stack:fast'];
    expectNonEmptyString(validatorStackScript, 'test:compat-validator-stack:fast');
    expectStringContainsSegmentsExactlyOnceInOrder(
      validatorStackScript,
      REQUIRED_COMPAT_VALIDATOR_STACK_SEQUENCE,
      'test:compat-validator-stack:fast'
    );
    expect(collectNpmRunTargets(validatorStackScript)).toEqual(REQUIRED_COMPAT_VALIDATOR_STACK_RUN_TARGETS);
  });

  it('keeps fast summary stack chained through report stack', () => {
    const summaryFastScript = scripts['test:compat-summary:fast'];
    expectNonEmptyString(summaryFastScript, 'test:compat-summary:fast');
    expectStringContainsSegmentsExactlyOnceInOrder(
      summaryFastScript,
      REQUIRED_COMPAT_SUMMARY_STACK_SEQUENCE,
      'test:compat-summary:fast'
    );
    expect(collectNpmRunTargets(summaryFastScript)).toEqual(REQUIRED_COMPAT_SUMMARY_STACK_RUN_TARGETS);
  });

  it('keeps ci script ordered through core + compat gates', () => {
    const ciScript = scripts.ci;
    expectNonEmptyString(ciScript, 'ci');
    expectStringContainsSegmentsExactlyOnceInOrder(
      ciScript,
      REQUIRED_COMPAT_CI_SEQUENCE,
      'ci'
    );
    expect(collectNpmRunTargets(ciScript)).toEqual(REQUIRED_COMPAT_CI_RUN_TARGETS);
  });

  it('keeps artifact producers ordered before their consumer gates', () => {
    const requiredScriptNames = [...new Set(REQUIRED_COMPAT_ARTIFACT_PRODUCER_CONSUMER_CONTRACTS.map(({ scriptName }) => scriptName))];
    expectKeyedNonEmptyStringValues(
      scripts,
      requiredScriptNames,
      'artifact producer/consumer script domain',
      { requireExactKeyDomain: false }
    );
    for (const {
      scriptName,
      artifactFile,
      producerSegment,
      consumerSegment
    } of REQUIRED_COMPAT_ARTIFACT_PRODUCER_CONSUMER_CONTRACTS) {
      const command = scripts[scriptName];
      expectNonEmptyString(command, `missing script for producer/consumer contract: ${scriptName}`);
      expectStringSegmentPairOrderedAndUnique(
        command,
        producerSegment,
        consumerSegment,
        `${scriptName} producer/consumer contract for ${artifactFile}`
      );
    }
  });

  it('keeps required compat scripts reachable from ci npm-run graph', () => {
    const { unresolvedScripts, visitedScripts } = buildReachableNpmRunGraph({
      scripts,
      sourceScripts: ['ci']
    });
    expect(
      [...unresolvedScripts],
      'cannot evaluate ci reachability contracts with unresolved npm-run targets'
    ).toEqual([]);
    expectArrayContainsAllValues(
      [...visitedScripts],
      REQUIRED_COMPAT_CI_REACHABLE_SCRIPT_NAMES,
      'ci npm-run graph reachable script domain'
    );
  });
});
