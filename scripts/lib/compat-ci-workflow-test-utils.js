export function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractTopLevelFieldEntries(workflowYaml) {
  return workflowYaml
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => /^[A-Za-z0-9_-]+:\s*/.test(line))
    .map((line) => {
      const fieldMatch = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
      return fieldMatch
        ? {
            fieldName: fieldMatch[1],
            fieldValue: fieldMatch[2].trim()
          }
        : null;
    })
    .filter((entry) => entry !== null);
}

export function extractWorkflowName(workflowYaml) {
  const match = workflowYaml.match(/^name:\s*(.+)\s*$/m);
  return match ? match[1].trim() : null;
}

export function extractTopLevelFieldNames(workflowYaml) {
  return extractTopLevelFieldEntries(workflowYaml)
    .map((entry) => entry.fieldName);
}

export function extractTopLevelFieldNameCounts(workflowYaml) {
  return extractTopLevelFieldEntries(workflowYaml).reduce((counts, entry) => {
    const existingCount = counts[entry.fieldName] ?? 0;
    counts[entry.fieldName] = existingCount + 1;
    return counts;
  }, {});
}

function findSectionHeaderLineIndex(lines, sectionName) {
  return lines.findIndex((line) => line.trim() === `${sectionName}:`);
}

function getIndentedBlockRange(lines, headerLineIndex) {
  const headerIndent = countLeadingSpaces(lines[headerLineIndex]);
  let blockEndLineIndex = lines.length;
  for (let index = headerLineIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) {
      continue;
    }
    const lineIndent = countLeadingSpaces(line);
    if (lineIndent <= headerIndent) {
      blockEndLineIndex = index;
      break;
    }
  }
  return {
    headerIndent,
    blockEndLineIndex
  };
}

function findDirectChildIndent(lines, headerLineIndex) {
  const {
    headerIndent,
    blockEndLineIndex
  } = getIndentedBlockRange(lines, headerLineIndex);
  let childIndent = null;
  for (let index = headerLineIndex + 1; index < blockEndLineIndex; index += 1) {
    const line = lines[index];
    if (!line.trim()) {
      continue;
    }
    const lineIndent = countLeadingSpaces(line);
    if (lineIndent <= headerIndent) {
      break;
    }
    if (childIndent === null || lineIndent < childIndent) {
      childIndent = lineIndent;
    }
  }
  return childIndent;
}

function listDirectChildLineEntries(lines, headerLineIndex) {
  const {
    blockEndLineIndex
  } = getIndentedBlockRange(lines, headerLineIndex);
  const childIndent = findDirectChildIndent(lines, headerLineIndex);
  if (childIndent === null) {
    return [];
  }

  const entries = [];
  for (let index = headerLineIndex + 1; index < blockEndLineIndex; index += 1) {
    const line = lines[index];
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      continue;
    }
    const lineIndent = countLeadingSpaces(line);
    if (lineIndent !== childIndent) {
      continue;
    }
    const fieldMatch = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(trimmedLine);
    if (!fieldMatch) {
      continue;
    }
    entries.push({
      lineIndex: index,
      fieldName: fieldMatch[1],
      fieldValue: fieldMatch[2].trim()
    });
  }
  return entries;
}

function findDirectChildLineEntry(lines, headerLineIndex, fieldName) {
  return listDirectChildLineEntries(lines, headerLineIndex)
    .find((entry) => entry.fieldName === fieldName) ?? null;
}

function collectDirectListValues(lines, headerLineIndex) {
  const {
    blockEndLineIndex
  } = getIndentedBlockRange(lines, headerLineIndex);
  const childIndent = findDirectChildIndent(lines, headerLineIndex);
  if (childIndent === null) {
    return [];
  }
  const values = [];
  for (let index = headerLineIndex + 1; index < blockEndLineIndex; index += 1) {
    const line = lines[index];
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      continue;
    }
    const lineIndent = countLeadingSpaces(line);
    if (lineIndent !== childIndent) {
      continue;
    }
    const listItemMatch = /^-\s+(.+)$/.exec(trimmedLine);
    if (listItemMatch) {
      values.push(listItemMatch[1].trim());
    }
  }
  return values;
}

export function extractOnTriggerNames(workflowYaml) {
  const lines = workflowYaml.split('\n');
  const onLineIndex = findSectionHeaderLineIndex(lines, 'on');
  if (onLineIndex < 0) {
    return null;
  }
  return listDirectChildLineEntries(lines, onLineIndex)
    .map((entry) => entry.fieldName);
}

export function extractOnTriggerSectionFieldNames(workflowYaml, triggerName) {
  const lines = workflowYaml.split('\n');
  const onLineIndex = findSectionHeaderLineIndex(lines, 'on');
  if (onLineIndex < 0) {
    return null;
  }
  const triggerEntry = findDirectChildLineEntry(lines, onLineIndex, triggerName);
  if (!triggerEntry) {
    return null;
  }
  return listDirectChildLineEntries(lines, triggerEntry.lineIndex)
    .map((entry) => entry.fieldName);
}

export function extractTopLevelJobNames(workflowYaml) {
  const lines = workflowYaml.split('\n');
  const jobsLineIndex = findSectionHeaderLineIndex(lines, 'jobs');
  if (jobsLineIndex < 0) {
    return null;
  }
  return listDirectChildLineEntries(lines, jobsLineIndex)
    .map((entry) => entry.fieldName);
}

export function countTopLevelFieldOccurrences(workflowYaml, fieldName) {
  return extractTopLevelFieldNameCounts(workflowYaml)[fieldName] ?? 0;
}

export function extractPushBranches(workflowYaml) {
  const lines = workflowYaml.split('\n');
  const onLineIndex = findSectionHeaderLineIndex(lines, 'on');
  if (onLineIndex < 0) {
    return null;
  }
  const pushLineEntry = findDirectChildLineEntry(lines, onLineIndex, 'push');
  if (!pushLineEntry) {
    return null;
  }
  const branchesLineEntry = findDirectChildLineEntry(lines, pushLineEntry.lineIndex, 'branches');
  if (!branchesLineEntry) {
    return null;
  }
  const branches = collectDirectListValues(lines, branchesLineEntry.lineIndex);
  if (branches.length === 0) {
    return null;
  }
  return branches;
}

export function hasPullRequestTrigger(workflowYaml) {
  const triggerNames = extractOnTriggerNames(workflowYaml);
  return Array.isArray(triggerNames) && triggerNames.includes('pull_request');
}

export function extractJobMetadata(workflowYaml, jobName) {
  const lines = workflowYaml.split('\n');
  const lineStartIndexes = computeLineStartIndexes(lines);
  const jobsLineIndex = findSectionHeaderLineIndex(lines, 'jobs');
  if (jobsLineIndex < 0) {
    return null;
  }
  const jobEntry = findDirectChildLineEntry(lines, jobsLineIndex, jobName);
  if (!jobEntry) {
    return null;
  }
  const jobHeaderLineIndex = jobEntry.lineIndex;

  const jobHeaderIndent = countLeadingSpaces(lines[jobHeaderLineIndex]);
  let blockEndLineIndex = lines.length;
  const jobHeaderPattern = /^([A-Za-z0-9_-]+):\s*$/;
  for (let index = jobHeaderLineIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      continue;
    }
    const lineIndent = countLeadingSpaces(line);
    if (lineIndent < jobHeaderIndent) {
      blockEndLineIndex = index;
      break;
    }
    if (lineIndent === jobHeaderIndent && jobHeaderPattern.test(trimmedLine)) {
      blockEndLineIndex = index;
      break;
    }
    if (lineIndent === 0) {
      blockEndLineIndex = index;
      break;
    }
  }

  const startIndex = lineStartIndexes[jobHeaderLineIndex];
  return {
    startIndex,
    block: lines.slice(jobHeaderLineIndex, blockEndLineIndex).join('\n')
  };
}

export function extractJobBlock(workflowYaml, jobName) {
  return extractJobMetadata(workflowYaml, jobName)?.block ?? null;
}

export function extractJobTopLevelFieldNames(jobBlock) {
  const lines = jobBlock.split('\n');
  const jobHeaderLineIndex = lines.findIndex((line) => /^\s*[A-Za-z0-9_-]+:\s*$/.test(line.trimEnd()));
  if (jobHeaderLineIndex < 0) {
    return null;
  }
  if (countLeadingSpaces(lines[jobHeaderLineIndex]) === 0) {
    return null;
  }
  return listDirectChildLineEntries(lines, jobHeaderLineIndex)
    .map((entry) => entry.fieldName);
}

export function countJobNameOccurrences(workflowYaml, jobName) {
  const jobNames = extractTopLevelJobNames(workflowYaml);
  if (!jobNames) {
    return 0;
  }
  return jobNames.filter((candidateJobName) => candidateJobName === jobName).length;
}

export function countStepNameOccurrences(workflowYamlOrJobBlock, stepName) {
  return extractStepNames(workflowYamlOrJobBlock)
    .filter((candidateStepName) => candidateStepName === stepName)
    .length;
}

export function extractStepNames(workflowYamlOrJobBlock) {
  return workflowYamlOrJobBlock
    .split('\n')
    .map((line) => /^\s*-\s+name:\s+(.+?)\s*$/.exec(line)?.[1]?.trim() ?? null)
    .filter((stepName) => typeof stepName === 'string' && stepName.length > 0);
}

export function extractStepFieldNames(stepBlock) {
  const lines = stepBlock.split('\n');
  const stepHeaderLine = lines.find((line) => line.trim().startsWith('- name:'));
  if (!stepHeaderLine) {
    return null;
  }
  const stepHeaderIndentMatch = /^(\s*)- name:\s+/.exec(stepHeaderLine);
  if (!stepHeaderIndentMatch) {
    return null;
  }
  const topLevelFieldIndent = stepHeaderIndentMatch[1].length + 2;
  const topLevelFieldPattern = new RegExp(`^\\s{${topLevelFieldIndent}}([A-Za-z0-9-]+):\\s*`);
  const fieldNames = ['name'];
  for (const line of lines) {
    const fieldMatch = topLevelFieldPattern.exec(line);
    if (!fieldMatch) {
      continue;
    }
    fieldNames.push(fieldMatch[1]);
  }
  return fieldNames;
}

export function countStepFieldOccurrences(stepBlock, fieldName) {
  return (extractStepFieldNames(stepBlock) ?? [])
    .filter((candidateFieldName) => candidateFieldName === fieldName)
    .length;
}

function countLeadingSpaces(line) {
  return line.length - line.trimStart().length;
}

function computeLineStartIndexes(lines) {
  const lineStartIndexes = [];
  let currentOffset = 0;
  for (const line of lines) {
    lineStartIndexes.push(currentOffset);
    currentOffset += line.length + 1;
  }
  return lineStartIndexes;
}

function extractNestedSectionContext(stepBlock, sectionName) {
  const lines = stepBlock.split('\n');
  const sectionLineIndex = lines.findIndex((line) => {
    const trimmedLine = line.trim();
    return trimmedLine === `${sectionName}:` || trimmedLine === `${sectionName}: |`;
  });
  if (sectionLineIndex < 0) {
    return null;
  }
  return {
    lines,
    sectionLineIndex,
    sectionIndent: countLeadingSpaces(lines[sectionLineIndex])
  };
}

function collectNestedSectionEntries(sectionContext) {
  const {
    lines,
    sectionLineIndex,
    sectionIndent
  } = sectionContext;
  const sectionEntries = [];
  for (let index = sectionLineIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      continue;
    }
    const lineIndent = countLeadingSpaces(line);
    if (lineIndent <= sectionIndent) {
      break;
    }
    const fieldMatch = /^\s*([A-Za-z0-9_-]+):\s*(.*)$/.exec(trimmedLine);
    if (!fieldMatch) {
      continue;
    }
    sectionEntries.push({
      fieldName: fieldMatch[1],
      fieldValue: fieldMatch[2].trim(),
      lineIndex: index,
      lineIndent
    });
  }
  return sectionEntries;
}

export function extractNestedSectionFieldNames(stepBlock, sectionName) {
  const sectionContext = extractNestedSectionContext(stepBlock, sectionName);
  if (!sectionContext) {
    return null;
  }
  return collectNestedSectionEntries(sectionContext)
    .map((entry) => entry.fieldName);
}

export function extractNestedSectionScalarFieldValue(stepBlock, sectionName, fieldName) {
  const sectionContext = extractNestedSectionContext(stepBlock, sectionName);
  if (!sectionContext) {
    return null;
  }
  return collectNestedSectionEntries(sectionContext)
    .find((entry) => entry.fieldName === fieldName)?.fieldValue ?? null;
}

export function extractNestedSectionFieldEntries(stepBlock, sectionName) {
  const sectionContext = extractNestedSectionContext(stepBlock, sectionName);
  if (!sectionContext) {
    return null;
  }
  return collectNestedSectionEntries(sectionContext)
    .map(({ fieldName, fieldValue }) => ({ fieldName, fieldValue }));
}

export function extractNestedSectionScalarFieldMap(stepBlock, sectionName) {
  const fieldEntries = extractNestedSectionFieldEntries(stepBlock, sectionName);
  if (!fieldEntries) {
    return null;
  }
  return Object.fromEntries(
    fieldEntries.map(({ fieldName, fieldValue }) => [fieldName, fieldValue])
  );
}

export function countScalarFieldOccurrences(block, fieldName) {
  const fieldPattern = new RegExp(`\\n\\s*${escapeRegex(fieldName)}:\\s*`, 'g');
  return [...block.matchAll(fieldPattern)].length;
}

export function extractStepMetadata(workflowYaml, stepName) {
  const lines = workflowYaml.split('\n');
  const lineStartIndexes = computeLineStartIndexes(lines);
  let stepHeaderLineIndex = -1;
  let stepHeaderIndent = 0;
  const stepHeaderPattern = /^(\s*)-\s+name:\s+(.+?)\s*$/;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const headerMatch = stepHeaderPattern.exec(line);
    if (!headerMatch) {
      continue;
    }
    if (headerMatch[2].trim() === stepName) {
      stepHeaderLineIndex = index;
      stepHeaderIndent = headerMatch[1].length;
      break;
    }
  }
  if (stepHeaderLineIndex < 0) {
    return null;
  }

  let blockEndLineIndex = lines.length;
  for (let index = stepHeaderLineIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      continue;
    }
    const lineIndent = countLeadingSpaces(line);
    if (lineIndent < stepHeaderIndent) {
      blockEndLineIndex = index;
      break;
    }
    if (lineIndent === stepHeaderIndent && /^\s*-\s+name:\s+/.test(line)) {
      blockEndLineIndex = index;
      break;
    }
  }

  return {
    startIndex: lineStartIndexes[stepHeaderLineIndex],
    block: lines.slice(stepHeaderLineIndex, blockEndLineIndex).join('\n')
  };
}

export function extractStepBlock(workflowYaml, stepName) {
  return extractStepMetadata(workflowYaml, stepName)?.block ?? null;
}

export function extractScalarField(stepBlock, fieldName) {
  const line = stepBlock
    .split('\n')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${fieldName}:`));
  if (!line) {
    return null;
  }
  return line.replace(new RegExp(`^${escapeRegex(fieldName)}:\\s*`), '').trim();
}

export function extractRunCommand(stepBlock) {
  return extractScalarField(stepBlock, 'run');
}

export function extractEnvField(stepBlock, envKey) {
  return extractScalarField(stepBlock, envKey);
}

export function extractUsesField(stepBlock) {
  return extractScalarField(stepBlock, 'uses');
}

export function extractUploadArtifactPaths(stepBlock) {
  return extractNestedSectionListOrMultilineFieldValues(stepBlock, 'with', 'path');
}

export function extractNestedSectionListOrMultilineFieldValues(stepBlock, sectionName, fieldName) {
  const sectionContext = extractNestedSectionContext(stepBlock, sectionName);
  if (!sectionContext) {
    return null;
  }
  const fieldEntry = collectNestedSectionEntries(sectionContext)
    .find((entry) => entry.fieldName === fieldName);
  if (!fieldEntry) {
    return null;
  }
  if (fieldEntry.fieldValue && fieldEntry.fieldValue !== '|') {
    return [fieldEntry.fieldValue];
  }

  const {
    lines
  } = sectionContext;
  const fieldValues = [];
  for (let index = fieldEntry.lineIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      continue;
    }
    const lineIndent = countLeadingSpaces(line);
    if (lineIndent <= fieldEntry.lineIndent) {
      break;
    }
    fieldValues.push(trimmedLine.startsWith('- ') ? trimmedLine.slice(2).trim() : trimmedLine);
  }
  return fieldValues;
}

function buildJobContractSnapshot({
  workflowYaml,
  jobName,
  stepNames
}) {
  const normalizedStepNames = Array.isArray(stepNames) && stepNames.length > 0
    ? stepNames
    : [];
  const jobBlock = extractJobBlock(workflowYaml, jobName);
  const stepTopLevelFieldNamesByName = {};
  const stepWithFieldNamesByName = {};
  const stepEnvFieldNamesByName = {};
  for (const stepName of normalizedStepNames) {
    const stepBlock = jobBlock ? extractStepBlock(jobBlock, stepName) : null;
    stepTopLevelFieldNamesByName[stepName] = stepBlock ? extractStepFieldNames(stepBlock) : null;
    stepWithFieldNamesByName[stepName] = stepBlock ? extractNestedSectionFieldNames(stepBlock, 'with') : null;
    stepEnvFieldNamesByName[stepName] = stepBlock ? extractNestedSectionFieldNames(stepBlock, 'env') : null;
  }

  return {
    jobName,
    jobTopLevelFieldNames: jobBlock ? extractJobTopLevelFieldNames(jobBlock) : null,
    jobRunsOn: jobBlock ? extractScalarField(jobBlock, 'runs-on') : null,
    jobTimeoutMinutes: jobBlock ? extractScalarField(jobBlock, 'timeout-minutes') : null,
    stepNames: jobBlock ? extractStepNames(jobBlock) : null,
    stepTopLevelFieldNamesByName,
    stepWithFieldNamesByName,
    stepEnvFieldNamesByName
  };
}

export function buildWorkflowJobsContractSnapshot({
  workflowYaml,
  jobNames,
  stepNamesByJobName
}) {
  const discoveredJobNames = extractTopLevelJobNames(workflowYaml) ?? [];
  const normalizedJobNames = Array.isArray(jobNames) && jobNames.length > 0
    ? jobNames
    : discoveredJobNames;
  const normalizedStepNamesByJobName = stepNamesByJobName && typeof stepNamesByJobName === 'object'
    ? stepNamesByJobName
    : {};
  return Object.fromEntries(
    normalizedJobNames.map((jobName) => [
      jobName,
      buildJobContractSnapshot({
        workflowYaml,
        jobName,
        stepNames: normalizedStepNamesByJobName[jobName]
      })
    ])
  );
}

export function buildWorkflowContractSnapshot({
  workflowYaml,
  jobName,
  stepNames
}) {
  const triggerNames = extractOnTriggerNames(workflowYaml) ?? [];
  const triggerSectionFieldNamesByTrigger = Object.fromEntries(
    triggerNames.map((triggerName) => [
      triggerName,
      extractOnTriggerSectionFieldNames(workflowYaml, triggerName)
    ])
  );
  const jobsByName = buildWorkflowJobsContractSnapshot({
    workflowYaml,
    jobNames: jobName ? [jobName] : [],
    stepNamesByJobName: jobName ? { [jobName]: stepNames } : {}
  });
  const selectedJobSnapshot = jobName ? jobsByName[jobName] ?? null : null;

  return {
    workflowName: extractWorkflowName(workflowYaml),
    topLevelFieldNames: extractTopLevelFieldNames(workflowYaml),
    triggerNames,
    triggerSectionFieldNamesByTrigger,
    pushBranches: extractPushBranches(workflowYaml),
    pullRequestTrigger: hasPullRequestTrigger(workflowYaml),
    jobNames: extractTopLevelJobNames(workflowYaml),
    jobName,
    jobTopLevelFieldNames: selectedJobSnapshot?.jobTopLevelFieldNames ?? null,
    jobRunsOn: selectedJobSnapshot?.jobRunsOn ?? null,
    jobTimeoutMinutes: selectedJobSnapshot?.jobTimeoutMinutes ?? null,
    stepNames: selectedJobSnapshot?.stepNames ?? null,
    stepTopLevelFieldNamesByName: selectedJobSnapshot?.stepTopLevelFieldNamesByName ?? {},
    stepWithFieldNamesByName: selectedJobSnapshot?.stepWithFieldNamesByName ?? {},
    stepEnvFieldNamesByName: selectedJobSnapshot?.stepEnvFieldNamesByName ?? {}
  };
}
