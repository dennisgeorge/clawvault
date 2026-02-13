export function collectNpmRunTargets(scriptCommand) {
  if (typeof scriptCommand !== 'string') {
    return [];
  }
  const matches = scriptCommand.matchAll(/npm run\s+([^\s&]+)/g);
  return [...matches].map((match) => match[1]);
}

export function buildReachableNpmRunGraph({ scripts, sourceScripts }) {
  const unresolvedScripts = new Set();
  const adjacencyByScript = new Map();
  const queuedScripts = [...sourceScripts];
  const visitedScripts = new Set();
  while (queuedScripts.length > 0) {
    const scriptName = queuedScripts.shift();
    if (visitedScripts.has(scriptName)) {
      continue;
    }
    visitedScripts.add(scriptName);
    const scriptCommand = scripts[scriptName];
    if (typeof scriptCommand !== 'string') {
      unresolvedScripts.add(scriptName);
      adjacencyByScript.set(scriptName, []);
      continue;
    }
    const targetScripts = collectNpmRunTargets(scriptCommand);
    adjacencyByScript.set(scriptName, targetScripts);
    for (const targetScriptName of targetScripts) {
      if (!visitedScripts.has(targetScriptName)) {
        queuedScripts.push(targetScriptName);
      }
    }
  }
  return { unresolvedScripts, adjacencyByScript, visitedScripts };
}

function hasCycleFromNode(node, adjacencyByNode, visiting, visited) {
  if (visiting.has(node)) {
    return true;
  }
  if (visited.has(node)) {
    return false;
  }
  visiting.add(node);
  for (const neighbor of adjacencyByNode.get(node) ?? []) {
    if (hasCycleFromNode(neighbor, adjacencyByNode, visiting, visited)) {
      return true;
    }
  }
  visiting.delete(node);
  visited.add(node);
  return false;
}

export function hasReachableNpmRunCycle(adjacencyByScript, nodes) {
  const visiting = new Set();
  const visited = new Set();
  for (const node of nodes) {
    if (hasCycleFromNode(node, adjacencyByScript, visiting, visited)) {
      return true;
    }
  }
  return false;
}
