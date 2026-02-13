import { describe, expect, it } from 'vitest';
import {
  buildWorkflowJobsContractSnapshot,
  buildWorkflowContractSnapshot,
  countTopLevelFieldOccurrences,
  countJobNameOccurrences,
  countScalarFieldOccurrences,
  countStepFieldOccurrences,
  countStepNameOccurrences,
  extractEnvField,
  extractJobBlock,
  extractJobTopLevelFieldNames,
  extractJobMetadata,
  extractOnTriggerSectionFieldNames,
  extractPushBranches,
  extractNestedSectionFieldNames,
  extractNestedSectionFieldEntries,
  extractNestedSectionListOrMultilineFieldValues,
  extractNestedSectionScalarFieldMap,
  extractNestedSectionScalarFieldValue,
  extractTopLevelFieldNames,
  extractTopLevelJobNames,
  extractRunCommand,
  extractScalarField,
  extractStepFieldNames,
  extractStepNames,
  extractStepBlock,
  extractStepMetadata,
  extractUploadArtifactPaths,
  extractUsesField,
  extractOnTriggerNames,
  extractWorkflowName,
  hasPullRequestTrigger
} from './compat-ci-workflow-test-utils.js';

const SAMPLE_WORKFLOW_YAML = `
name: CI
on:
  push:
    branches:
      - main
      - master
  pull_request:
jobs:
  test-and-compat:
    runs-on: ubuntu-latest
    steps:
      - name: First Step
        uses: actions/example@v1
      - name: Build
        run: npm run build
        env:
          SAMPLE_ENV: hello
      - name: Upload
        uses: actions/upload-artifact@v4
        with:
          name: sample-artifact
          path: |
            \${{ runner.temp }}/reports/a.json
            \${{ runner.temp }}/reports/b.json
          if-no-files-found: ignore
  second-job:
    runs-on: ubuntu-latest
    steps:
      - name: Done
        run: echo done
`.trim();

const ALT_INDENTED_STEPS_SNIPPET = `
steps:
  - name: Alpha
    run: echo alpha
  - name: Beta
    run: echo beta
`.trim();

const LIST_STYLE_UPLOAD_STEP_SNIPPET = `
- name: Upload
  uses: actions/upload-artifact@v4
  with:
    path:
      - \${{ runner.temp }}/reports/a.json
      - \${{ runner.temp }}/reports/b.json
    if-no-files-found: ignore
`.trim();

const SCALAR_PATH_UPLOAD_STEP_SNIPPET = `
- name: Upload
  uses: actions/upload-artifact@v4
  with:
    path: \${{ runner.temp }}/reports/single.json
    if-no-files-found: ignore
`.trim();

const MATRIX_WORKFLOW_YAML = `
name: Matrix CI
on:
  push:
    branches:
      - main
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - name: Lint
        run: npm run lint
  test-matrix:
    needs: lint
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node:
          - 20
          - 22
    steps:
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: \${{ matrix.node }}
      - name: Run tests
        run: npm test
        env:
          NODE_VERSION: \${{ matrix.node }}
`.trim();

describe('compat ci workflow test utils', () => {
  it('extracts workflow-level trigger metadata', () => {
    expect(extractWorkflowName(`\n${SAMPLE_WORKFLOW_YAML}\n`)).toBe('CI');
    expect(extractTopLevelFieldNames(`\n${SAMPLE_WORKFLOW_YAML}\n`)).toEqual(['name', 'on', 'jobs']);
    expect(countTopLevelFieldOccurrences(`\n${SAMPLE_WORKFLOW_YAML}\n`, 'name')).toBe(1);
    expect(countTopLevelFieldOccurrences(`\n${SAMPLE_WORKFLOW_YAML}\n`, 'on')).toBe(1);
    expect(countTopLevelFieldOccurrences(`\n${SAMPLE_WORKFLOW_YAML}\n`, 'jobs')).toBe(1);
    expect(extractTopLevelJobNames(`\n${SAMPLE_WORKFLOW_YAML}\n`)).toEqual(['test-and-compat', 'second-job']);
    expect(extractOnTriggerNames(`\n${SAMPLE_WORKFLOW_YAML}\n`)).toEqual(['push', 'pull_request']);
    expect(extractOnTriggerSectionFieldNames(`\n${SAMPLE_WORKFLOW_YAML}\n`, 'push')).toEqual(['branches']);
    expect(extractOnTriggerSectionFieldNames(`\n${SAMPLE_WORKFLOW_YAML}\n`, 'pull_request')).toEqual([]);
    expect(extractPushBranches(`\n${SAMPLE_WORKFLOW_YAML}\n`)).toEqual(['main', 'master']);
    expect(hasPullRequestTrigger(`\n${SAMPLE_WORKFLOW_YAML}\n`)).toBe(true);
  });

  it('builds normalized workflow contract snapshot view', () => {
    const snapshot = buildWorkflowContractSnapshot({
      workflowYaml: `\n${SAMPLE_WORKFLOW_YAML}\n`,
      jobName: 'test-and-compat',
      stepNames: ['First Step', 'Build', 'Upload']
    });
    expect(snapshot.workflowName).toBe('CI');
    expect(snapshot.topLevelFieldNames).toEqual(['name', 'on', 'jobs']);
    expect(snapshot.triggerNames).toEqual(['push', 'pull_request']);
    expect(snapshot.triggerSectionFieldNamesByTrigger).toEqual({
      push: ['branches'],
      pull_request: []
    });
    expect(snapshot.pushBranches).toEqual(['main', 'master']);
    expect(snapshot.pullRequestTrigger).toBe(true);
    expect(snapshot.jobNames).toEqual(['test-and-compat', 'second-job']);
    expect(snapshot.jobTopLevelFieldNames).toEqual(['runs-on', 'steps']);
    expect(snapshot.jobRunsOn).toBe('ubuntu-latest');
    expect(snapshot.jobTimeoutMinutes).toBe(null);
    expect(snapshot.stepNames).toEqual(['First Step', 'Build', 'Upload']);
    expect(snapshot.stepTopLevelFieldNamesByName['Build']).toEqual(['name', 'run', 'env']);
    expect(snapshot.stepWithFieldNamesByName['Upload']).toEqual(['name', 'path', 'if-no-files-found']);
    expect(snapshot.stepEnvFieldNamesByName['Build']).toEqual(['SAMPLE_ENV']);
    expect(snapshot.stepEnvFieldNamesByName['First Step']).toBe(null);
  });

  it('builds normalized workflow job snapshots keyed by job name', () => {
    const snapshotsByJobName = buildWorkflowJobsContractSnapshot({
      workflowYaml: `\n${SAMPLE_WORKFLOW_YAML}\n`,
      jobNames: ['test-and-compat', 'second-job'],
      stepNamesByJobName: {
        'test-and-compat': ['First Step', 'Build', 'Upload'],
        'second-job': ['Done']
      }
    });
    expect(Object.keys(snapshotsByJobName)).toEqual(['test-and-compat', 'second-job']);
    expect(snapshotsByJobName['test-and-compat']).toEqual({
      jobName: 'test-and-compat',
      jobTopLevelFieldNames: ['runs-on', 'steps'],
      jobRunsOn: 'ubuntu-latest',
      jobTimeoutMinutes: null,
      stepNames: ['First Step', 'Build', 'Upload'],
      stepTopLevelFieldNamesByName: {
        'First Step': ['name', 'uses'],
        Build: ['name', 'run', 'env'],
        Upload: ['name', 'uses', 'with']
      },
      stepWithFieldNamesByName: {
        'First Step': null,
        Build: null,
        Upload: ['name', 'path', 'if-no-files-found']
      },
      stepEnvFieldNamesByName: {
        'First Step': null,
        Build: ['SAMPLE_ENV'],
        Upload: null
      }
    });
    expect(snapshotsByJobName['second-job']).toEqual({
      jobName: 'second-job',
      jobTopLevelFieldNames: ['runs-on', 'steps'],
      jobRunsOn: 'ubuntu-latest',
      jobTimeoutMinutes: null,
      stepNames: ['Done'],
      stepTopLevelFieldNamesByName: {
        Done: ['name', 'run']
      },
      stepWithFieldNamesByName: {
        Done: null
      },
      stepEnvFieldNamesByName: {
        Done: null
      }
    });
  });

  it('discovers workflow job names when explicit job list is omitted', () => {
    const snapshotsByJobName = buildWorkflowJobsContractSnapshot({
      workflowYaml: `\n${SAMPLE_WORKFLOW_YAML}\n`,
      stepNamesByJobName: {
        'test-and-compat': ['First Step'],
        'second-job': ['Done']
      }
    });
    expect(Object.keys(snapshotsByJobName)).toEqual(['test-and-compat', 'second-job']);
    expect(snapshotsByJobName['test-and-compat'].jobName).toBe('test-and-compat');
    expect(snapshotsByJobName['test-and-compat'].stepTopLevelFieldNamesByName).toEqual({
      'First Step': ['name', 'uses']
    });
    expect(snapshotsByJobName['second-job'].jobName).toBe('second-job');
    expect(snapshotsByJobName['second-job'].stepTopLevelFieldNamesByName).toEqual({
      Done: ['name', 'run']
    });
  });

  it('extracts job metadata/block boundaries and scalar fields', () => {
    const metadata = extractJobMetadata(`\n${SAMPLE_WORKFLOW_YAML}\n`, 'test-and-compat');
    expect(metadata).toBeTruthy();
    expect(metadata.startIndex).toBeGreaterThanOrEqual(0);
    const jobBlock = extractJobBlock(`\n${SAMPLE_WORKFLOW_YAML}\n`, 'test-and-compat');
    expect(jobBlock).toContain('runs-on: ubuntu-latest');
    expect(jobBlock).toContain('- name: Upload');
    expect(jobBlock).not.toContain('second-job:');
    expect(extractScalarField(jobBlock, 'runs-on')).toBe('ubuntu-latest');
    expect(extractJobTopLevelFieldNames(jobBlock)).toEqual(['runs-on', 'steps']);
    expect(countJobNameOccurrences(`\n${SAMPLE_WORKFLOW_YAML}\n`, 'test-and-compat')).toBe(1);
    expect(countJobNameOccurrences(`\n${SAMPLE_WORKFLOW_YAML}\n`, 'Missing Job')).toBe(0);
    expect(countScalarFieldOccurrences(jobBlock, 'runs-on')).toBe(1);
    expect(countScalarFieldOccurrences(jobBlock, 'steps')).toBe(1);
  });

  it('extracts matrix-job top-level fields and step snapshots across multiple jobs', () => {
    const matrixJobBlock = extractJobBlock(`\n${MATRIX_WORKFLOW_YAML}\n`, 'test-matrix');
    expect(matrixJobBlock).toBeTruthy();
    expect(matrixJobBlock).toContain('strategy:');
    expect(matrixJobBlock).toContain('matrix:');
    expect(matrixJobBlock).not.toContain('lint:');
    expect(extractJobTopLevelFieldNames(matrixJobBlock)).toEqual([
      'needs',
      'runs-on',
      'strategy',
      'steps'
    ]);

    const snapshotsByJobName = buildWorkflowJobsContractSnapshot({
      workflowYaml: `\n${MATRIX_WORKFLOW_YAML}\n`,
      stepNamesByJobName: {
        lint: ['Lint'],
        'test-matrix': ['Setup Node', 'Run tests']
      }
    });
    expect(Object.keys(snapshotsByJobName)).toEqual(['lint', 'test-matrix']);
    expect(snapshotsByJobName['test-matrix']).toEqual({
      jobName: 'test-matrix',
      jobTopLevelFieldNames: ['needs', 'runs-on', 'strategy', 'steps'],
      jobRunsOn: 'ubuntu-latest',
      jobTimeoutMinutes: null,
      stepNames: ['Setup Node', 'Run tests'],
      stepTopLevelFieldNamesByName: {
        'Setup Node': ['name', 'uses', 'with'],
        'Run tests': ['name', 'run', 'env']
      },
      stepWithFieldNamesByName: {
        'Setup Node': ['node-version'],
        'Run tests': null
      },
      stepEnvFieldNamesByName: {
        'Setup Node': null,
        'Run tests': ['NODE_VERSION']
      }
    });
  });

  it('extracts step metadata/block and run/env fields', () => {
    const metadata = extractStepMetadata(`\n${SAMPLE_WORKFLOW_YAML}\n`, 'Build');
    expect(metadata).toBeTruthy();
    expect(metadata.startIndex).toBeGreaterThanOrEqual(0);
    expect(metadata.block).toContain('- name: Build');
    expect(extractStepBlock(`\n${SAMPLE_WORKFLOW_YAML}\n`, 'Build')).toContain('run: npm run build');
    expect(extractRunCommand(metadata.block)).toBe('npm run build');
    expect(extractEnvField(metadata.block, 'SAMPLE_ENV')).toBe('hello');
    expect(countStepNameOccurrences(`\n${SAMPLE_WORKFLOW_YAML}\n`, 'Build')).toBe(1);
    expect(countStepNameOccurrences(`\n${SAMPLE_WORKFLOW_YAML}\n`, 'Missing Step')).toBe(0);
    expect(extractStepNames(`\n${SAMPLE_WORKFLOW_YAML}\n`)).toEqual(['First Step', 'Build', 'Upload', 'Done']);
    expect(extractStepFieldNames(metadata.block)).toEqual(['name', 'run', 'env']);
    expect(extractNestedSectionFieldNames(metadata.block, 'env')).toEqual(['SAMPLE_ENV']);
    expect(extractNestedSectionScalarFieldValue(metadata.block, 'env', 'SAMPLE_ENV')).toBe('hello');
    expect(countStepFieldOccurrences(metadata.block, 'run')).toBe(1);
    expect(countStepFieldOccurrences(metadata.block, 'missing')).toBe(0);
  });

  it('extracts bounded step blocks without fixed indentation assumptions', () => {
    const metadata = extractStepMetadata(`\n${ALT_INDENTED_STEPS_SNIPPET}\n`, 'Alpha');
    expect(metadata).toBeTruthy();
    expect(metadata.block).toContain('- name: Alpha');
    expect(metadata.block).not.toContain('- name: Beta');
    expect(extractRunCommand(metadata.block)).toBe('echo alpha');
  });

  it('extracts uses/scalar fields and multiline upload paths', () => {
    const uploadStepBlock = extractStepBlock(`\n${SAMPLE_WORKFLOW_YAML}\n`, 'Upload');
    expect(uploadStepBlock).toBeTruthy();
    expect(extractUsesField(uploadStepBlock)).toBe('actions/upload-artifact@v4');
    expect(extractScalarField(uploadStepBlock, 'name')).toBe('sample-artifact');
    expect(extractStepFieldNames(uploadStepBlock)).toEqual(['name', 'uses', 'with']);
    expect(extractNestedSectionFieldNames(uploadStepBlock, 'with')).toEqual([
      'name',
      'path',
      'if-no-files-found'
    ]);
    expect(extractNestedSectionFieldEntries(uploadStepBlock, 'with')).toEqual([
      { fieldName: 'name', fieldValue: 'sample-artifact' },
      { fieldName: 'path', fieldValue: '|' },
      { fieldName: 'if-no-files-found', fieldValue: 'ignore' }
    ]);
    expect(extractNestedSectionScalarFieldValue(uploadStepBlock, 'with', 'name')).toBe('sample-artifact');
    expect(extractNestedSectionScalarFieldValue(uploadStepBlock, 'with', 'if-no-files-found')).toBe('ignore');
    expect(extractNestedSectionScalarFieldMap(uploadStepBlock, 'with')).toEqual({
      name: 'sample-artifact',
      path: '|',
      'if-no-files-found': 'ignore'
    });
    expect(extractScalarField(uploadStepBlock, 'if-no-files-found')).toBe('ignore');
    expect(extractUploadArtifactPaths(uploadStepBlock)).toEqual([
      '${{ runner.temp }}/reports/a.json',
      '${{ runner.temp }}/reports/b.json'
    ]);
    expect(extractNestedSectionListOrMultilineFieldValues(uploadStepBlock, 'with', 'path')).toEqual([
      '${{ runner.temp }}/reports/a.json',
      '${{ runner.temp }}/reports/b.json'
    ]);
  });

  it('extracts upload artifact paths from list-style path blocks', () => {
    const expectedPaths = [
      '${{ runner.temp }}/reports/a.json',
      '${{ runner.temp }}/reports/b.json'
    ];
    expect(extractUploadArtifactPaths(LIST_STYLE_UPLOAD_STEP_SNIPPET)).toEqual(expectedPaths);
    expect(extractNestedSectionListOrMultilineFieldValues(LIST_STYLE_UPLOAD_STEP_SNIPPET, 'with', 'path')).toEqual(expectedPaths);
    expect(extractNestedSectionScalarFieldMap(LIST_STYLE_UPLOAD_STEP_SNIPPET, 'with')).toEqual({
      path: '',
      'if-no-files-found': 'ignore'
    });
  });

  it('extracts upload artifact paths from scalar path fields and keeps parity with specialized helper', () => {
    const expectedPaths = ['${{ runner.temp }}/reports/single.json'];
    expect(extractUploadArtifactPaths(SCALAR_PATH_UPLOAD_STEP_SNIPPET)).toEqual(expectedPaths);
    expect(extractNestedSectionListOrMultilineFieldValues(SCALAR_PATH_UPLOAD_STEP_SNIPPET, 'with', 'path')).toEqual(expectedPaths);
  });

  it('returns null for missing steps/fields/path blocks', () => {
    const missingStepBlock = extractStepBlock(`\n${SAMPLE_WORKFLOW_YAML}\n`, 'Missing Step');
    expect(missingStepBlock).toBe(null);
    expect(extractJobBlock(`\n${SAMPLE_WORKFLOW_YAML}\n`, 'Missing Job')).toBe(null);
    expect(extractJobMetadata(`\n${SAMPLE_WORKFLOW_YAML}\n`, 'Missing Job')).toBe(null);
    expect(extractStepMetadata(`\n${SAMPLE_WORKFLOW_YAML}\n`, 'Missing Step')).toBe(null);
    expect(extractScalarField('run: npm test', 'missing')).toBe(null);
    expect(extractStepFieldNames('run: npm test')).toBe(null);
    expect(extractNestedSectionFieldNames('run: npm test', 'env')).toBe(null);
    expect(extractNestedSectionFieldEntries('run: npm test', 'env')).toBe(null);
    expect(extractNestedSectionScalarFieldMap('run: npm test', 'env')).toBe(null);
    expect(extractNestedSectionScalarFieldValue('run: npm test', 'env', 'SAMPLE_ENV')).toBe(null);
    expect(extractUploadArtifactPaths('- name: Upload\n  uses: actions/upload-artifact@v4')).toBe(null);
    expect(countScalarFieldOccurrences('run: npm test', 'missing')).toBe(0);
    expect(extractWorkflowName('jobs:\n  test:\n    runs-on: ubuntu-latest')).toBe(null);
    expect(extractTopLevelFieldNames('  name: CI\njobs:\n  test:\n    runs-on: ubuntu-latest')).toEqual(['jobs']);
    expect(extractOnTriggerNames('name: CI\njobs:\n  test:\n    runs-on: ubuntu-latest')).toBe(null);
    expect(extractOnTriggerSectionFieldNames('name: CI\njobs:\n  test:\n    runs-on: ubuntu-latest', 'push')).toBe(null);
    expect(extractTopLevelJobNames('name: CI\non:\n  pull_request:')).toBe(null);
    expect(extractJobTopLevelFieldNames('name: CI\njobs:\n  # no concrete job header')).toBe(null);
    expect(extractPushBranches('on:\n  pull_request:')).toBe(null);
    expect(hasPullRequestTrigger('on:\n  push:\n    branches:\n      - main')).toBe(false);
  });
});
