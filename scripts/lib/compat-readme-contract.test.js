import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  REQUIRED_COMPAT_CI_UPLOAD_ARTIFACT_FILES,
  REQUIRED_COMPAT_README_CI_ARTIFACTS_LINE_PREFIX,
  REQUIRED_COMPAT_README_PATH,
  REQUIRED_COMPAT_README_SCRIPT_REFERENCE_COMMANDS
} from './compat-npm-script-contracts.mjs';

function loadReadmeContent() {
  const readmePath = path.resolve(process.cwd(), REQUIRED_COMPAT_README_PATH);
  return fs.readFileSync(readmePath, 'utf-8');
}

function countLinePrefixOccurrences(content, linePrefix) {
  return content
    .split('\n')
    .filter((line) => line.startsWith(linePrefix))
    .length;
}

function extractArtifactsLine(content, linePrefix) {
  const line = content
    .split('\n')
    .find((candidateLine) => candidateLine.startsWith(linePrefix));
  if (!line) {
    return null;
  }
  return line;
}

function parseArtifactsList(line, linePrefix) {
  if (!line.startsWith(linePrefix)) {
    return null;
  }
  return line
    .slice(linePrefix.length)
    .split(' + ')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function countExactLineOccurrences(content, expectedLine) {
  return content
    .split('\n')
    .filter((line) => line.trimEnd() === expectedLine)
    .length;
}

describe('compat readme contract', () => {
  it('keeps ci artifact documentation list aligned with canonical upload artifact contracts', () => {
    const readmeContent = loadReadmeContent();
    expect(
      countLinePrefixOccurrences(readmeContent, REQUIRED_COMPAT_README_CI_ARTIFACTS_LINE_PREFIX),
      'README must declare ci artifact list exactly once'
    ).toBe(1);
    const artifactListLine = extractArtifactsLine(readmeContent, REQUIRED_COMPAT_README_CI_ARTIFACTS_LINE_PREFIX);
    expect(artifactListLine).toBeTruthy();
    const documentedArtifacts = parseArtifactsList(artifactListLine, REQUIRED_COMPAT_README_CI_ARTIFACTS_LINE_PREFIX);
    expect(documentedArtifacts).toEqual(REQUIRED_COMPAT_CI_UPLOAD_ARTIFACT_FILES);
    expect(new Set(documentedArtifacts).size).toBe(documentedArtifacts.length);
  });

  it('keeps readme npm script references aligned with required script-reference contract set', () => {
    const readmeContent = loadReadmeContent();
    for (const commandLine of REQUIRED_COMPAT_README_SCRIPT_REFERENCE_COMMANDS) {
      expect(
        readmeContent.includes(`\n${commandLine}\n`) || readmeContent.startsWith(`${commandLine}\n`),
        `README is missing required compat command reference: ${commandLine}`
      ).toBe(true);
      expect(
        countExactLineOccurrences(readmeContent, commandLine),
        `README must include exactly one canonical compat command reference line: ${commandLine}`
      ).toBe(1);
    }
  });
});
