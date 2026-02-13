import { describe, expect, it } from 'vitest';
import {
  buildUnitCountMap,
  buildUnitCountMapByKey
} from './compat-contract-test-utils.js';

describe('compat contract test utils', () => {
  it('builds unit count maps for array domains', () => {
    expect(buildUnitCountMap(['a', 'b', 'a'])).toEqual({
      a: 2,
      b: 1
    });
    expect(buildUnitCountMap([])).toEqual({});
    expect(buildUnitCountMap(null)).toEqual({});
  });

  it('builds unit count maps by key for nested array domains', () => {
    expect(buildUnitCountMapByKey({
      jobs: ['test', 'build', 'test'],
      steps: ['checkout', 'setup']
    })).toEqual({
      jobs: {
        test: 2,
        build: 1
      },
      steps: {
        checkout: 1,
        setup: 1
      }
    });
    expect(buildUnitCountMapByKey({
      invalid: null
    })).toEqual({
      invalid: {}
    });
    expect(buildUnitCountMapByKey(null)).toEqual({});
  });
});
