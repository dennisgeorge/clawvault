import { describe, expect, it } from 'vitest';
import {
  countTopLevelFieldOccurrences,
  countJobNameOccurrences,
  countScalarFieldOccurrences,
  countStepFieldOccurrences,
  countStepNameOccurrences,
  extractEnvField,
  extractJobBlock,
  extractJobMetadata,
  extractPushBranches,
  extractNestedSectionFieldNames,
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

describe('compat ci workflow test utils', () => {
  it('extracts workflow-level trigger metadata', () => {
    expect(extractWorkflowName(`\n${SAMPLE_WORKFLOW_YAML}\n`)).toBe('CI');
    expect(countTopLevelFieldOccurrences(`\n${SAMPLE_WORKFLOW_YAML}\n`, 'name')).toBe(1);
    expect(countTopLevelFieldOccurrences(`\n${SAMPLE_WORKFLOW_YAML}\n`, 'on')).toBe(1);
    expect(countTopLevelFieldOccurrences(`\n${SAMPLE_WORKFLOW_YAML}\n`, 'jobs')).toBe(1);
    expect(extractTopLevelJobNames(`\n${SAMPLE_WORKFLOW_YAML}\n`)).toEqual(['test-and-compat', 'second-job']);
    expect(extractOnTriggerNames(`\n${SAMPLE_WORKFLOW_YAML}\n`)).toEqual(['push', 'pull_request']);
    expect(extractPushBranches(`\n${SAMPLE_WORKFLOW_YAML}\n`)).toEqual(['main', 'master']);
    expect(hasPullRequestTrigger(`\n${SAMPLE_WORKFLOW_YAML}\n`)).toBe(true);
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
    expect(countJobNameOccurrences(`\n${SAMPLE_WORKFLOW_YAML}\n`, 'test-and-compat')).toBe(1);
    expect(countJobNameOccurrences(`\n${SAMPLE_WORKFLOW_YAML}\n`, 'Missing Job')).toBe(0);
    expect(countScalarFieldOccurrences(jobBlock, 'runs-on')).toBe(1);
    expect(countScalarFieldOccurrences(jobBlock, 'steps')).toBe(1);
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
    expect(countStepFieldOccurrences(metadata.block, 'run')).toBe(1);
    expect(countStepFieldOccurrences(metadata.block, 'missing')).toBe(0);
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
    expect(extractScalarField(uploadStepBlock, 'if-no-files-found')).toBe('ignore');
    expect(extractUploadArtifactPaths(uploadStepBlock)).toEqual([
      '${{ runner.temp }}/reports/a.json',
      '${{ runner.temp }}/reports/b.json'
    ]);
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
    expect(extractUploadArtifactPaths('- name: Upload\n  uses: actions/upload-artifact@v4')).toBe(null);
    expect(countScalarFieldOccurrences('run: npm test', 'missing')).toBe(0);
    expect(extractWorkflowName('jobs:\n  test:\n    runs-on: ubuntu-latest')).toBe(null);
    expect(extractOnTriggerNames('name: CI\njobs:\n  test:\n    runs-on: ubuntu-latest')).toBe(null);
    expect(extractTopLevelJobNames('name: CI\non:\n  pull_request:')).toBe(null);
    expect(extractPushBranches('on:\n  pull_request:')).toBe(null);
    expect(hasPullRequestTrigger('on:\n  push:\n    branches:\n      - main')).toBe(false);
  });
});
