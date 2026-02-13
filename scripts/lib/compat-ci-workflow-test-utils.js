export function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extractWorkflowName(workflowYaml) {
  const match = workflowYaml.match(/^name:\s*(.+)\s*$/m);
  return match ? match[1].trim() : null;
}

export function extractOnTriggerNames(workflowYaml) {
  const lines = workflowYaml.split('\n');
  const onLineIndex = lines.findIndex((line) => /^on:\s*$/.test(line.trim()));
  if (onLineIndex < 0) {
    return null;
  }
  const triggerNames = [];
  for (let index = onLineIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^[^\s].*:\s*$/.test(line)) {
      break;
    }
    const triggerMatch = /^  ([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (triggerMatch) {
      triggerNames.push(triggerMatch[1]);
    }
  }
  return triggerNames;
}

export function extractTopLevelJobNames(workflowYaml) {
  const lines = workflowYaml.split('\n');
  const jobsLineIndex = lines.findIndex((line) => /^jobs:\s*$/.test(line.trim()));
  if (jobsLineIndex < 0) {
    return null;
  }
  const jobNames = [];
  for (let index = jobsLineIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^[^\s].*:\s*$/.test(line)) {
      break;
    }
    const jobMatch = /^  ([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (jobMatch) {
      jobNames.push(jobMatch[1]);
    }
  }
  return jobNames;
}

export function countTopLevelFieldOccurrences(workflowYaml, fieldName) {
  const pattern = new RegExp(`^${escapeRegex(fieldName)}:\\s*`, 'gm');
  return [...workflowYaml.matchAll(pattern)].length;
}

export function extractPushBranches(workflowYaml) {
  const branchesBlockMatch = workflowYaml.match(/\n\s{2}push:\s*\n\s{4}branches:\s*\n((?:\s{6}- .*\n)+)/);
  if (!branchesBlockMatch) {
    return null;
  }
  return branchesBlockMatch[1]
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim());
}

export function hasPullRequestTrigger(workflowYaml) {
  return /\n\s{2}pull_request:\s*(?:\n|$)/.test(workflowYaml);
}

export function extractJobMetadata(workflowYaml, jobName) {
  const jobHeaderPattern = new RegExp(`\\n\\s{2}${escapeRegex(jobName)}:\\s*\\n`);
  const headerMatch = jobHeaderPattern.exec(workflowYaml);
  if (!headerMatch) {
    return null;
  }
  const startIndex = headerMatch.index;
  const remainder = workflowYaml.slice(startIndex + headerMatch[0].length);
  const nextJobMatch = /\n  [A-Za-z0-9_-]+:\s*\n/.exec(remainder);
  return {
    startIndex,
    block: nextJobMatch
      ? workflowYaml.slice(startIndex, startIndex + headerMatch[0].length + nextJobMatch.index)
      : workflowYaml.slice(startIndex)
  };
}

export function extractJobBlock(workflowYaml, jobName) {
  return extractJobMetadata(workflowYaml, jobName)?.block ?? null;
}

export function countJobNameOccurrences(workflowYaml, jobName) {
  const jobHeaderPattern = new RegExp(`\\n\\s{2}${escapeRegex(jobName)}:\\s*\\n`, 'g');
  return [...workflowYaml.matchAll(jobHeaderPattern)].length;
}

export function countStepNameOccurrences(workflowYamlOrJobBlock, stepName) {
  const stepHeaderPattern = new RegExp(`\\n\\s+- name:\\s+${escapeRegex(stepName)}\\s*\\n`, 'g');
  return [...workflowYamlOrJobBlock.matchAll(stepHeaderPattern)].length;
}

export function extractStepNames(workflowYamlOrJobBlock) {
  const stepHeaderPattern = /\n\s+- name:\s+(.+)\s*\n/g;
  return [...workflowYamlOrJobBlock.matchAll(stepHeaderPattern)].map((match) => match[1].trim());
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

export function countScalarFieldOccurrences(block, fieldName) {
  const fieldPattern = new RegExp(`\\n\\s*${escapeRegex(fieldName)}:\\s*`, 'g');
  return [...block.matchAll(fieldPattern)].length;
}

export function extractStepMetadata(workflowYaml, stepName) {
  const stepHeaderPattern = new RegExp(`\\n\\s+- name:\\s+${escapeRegex(stepName)}\\s*\\n`);
  const headerMatch = stepHeaderPattern.exec(workflowYaml);
  if (!headerMatch) {
    return null;
  }
  const startIndex = headerMatch.index;
  const nextStepIndex = workflowYaml.indexOf('\n      - name:', startIndex + headerMatch[0].length);
  return {
    startIndex,
    block: nextStepIndex < 0 ? workflowYaml.slice(startIndex) : workflowYaml.slice(startIndex, nextStepIndex)
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
  const lines = stepBlock.split('\n').map((line) => line.trim());
  const pathLineIndex = lines.findIndex((line) => line === 'path:' || line === 'path: |');
  if (pathLineIndex < 0) {
    return null;
  }
  const pathLines = [];
  for (let index = pathLineIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) {
      continue;
    }
    if (line.startsWith('if-no-files-found:')) {
      break;
    }
    if (line.includes(':') && !line.startsWith('${{')) {
      break;
    }
    pathLines.push(line);
  }
  return pathLines;
}
