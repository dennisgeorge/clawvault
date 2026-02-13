import { describe, expect, it } from 'vitest';
import {
  buildReachableNpmRunGraph,
  collectNpmRunTargets,
  hasReachableNpmRunCycle
} from './compat-npm-script-graph-utils.mjs';
import { expectArrayContainsAllValues } from './compat-contract-assertion-test-utils.js';

describe('compat npm script graph utils', () => {
  it('extracts npm run targets in order', () => {
    expect(
      collectNpmRunTargets('COMPAT_REPORT_DIR=.compat-reports npm run a && npm run b && echo done && npm run c')
    ).toEqual(['a', 'b', 'c']);
  });

  it('builds reachable graph and tracks unresolved scripts', () => {
    const { adjacencyByScript, unresolvedScripts, visitedScripts } = buildReachableNpmRunGraph({
      scripts: {
        a: 'npm run b && npm run c',
        b: 'echo b',
        c: 'npm run d'
      },
      sourceScripts: ['a']
    });
    expectArrayContainsAllValues([...visitedScripts], ['a', 'b', 'c', 'd'], 'visited script domain');
    expect([...unresolvedScripts]).toEqual(['d']);
    expect(adjacencyByScript.get('a')).toEqual(['b', 'c']);
    expect(adjacencyByScript.get('b')).toEqual([]);
    expect(adjacencyByScript.get('c')).toEqual(['d']);
    expect(adjacencyByScript.get('d')).toEqual([]);
  });

  it('detects and rejects reachable cycles', () => {
    const cycleGraph = buildReachableNpmRunGraph({
      scripts: {
        a: 'npm run b',
        b: 'npm run c',
        c: 'npm run a'
      },
      sourceScripts: ['a']
    });
    expect(hasReachableNpmRunCycle(cycleGraph.adjacencyByScript, cycleGraph.adjacencyByScript.keys())).toBe(true);

    const acyclicGraph = buildReachableNpmRunGraph({
      scripts: {
        a: 'npm run b',
        b: 'npm run c',
        c: 'echo done'
      },
      sourceScripts: ['a']
    });
    expect(hasReachableNpmRunCycle(acyclicGraph.adjacencyByScript, acyclicGraph.adjacencyByScript.keys())).toBe(false);
  });
});
