import { expect } from 'vitest';
import {
  buildUnitCountMap,
  buildUnitCountMapByKey
} from './compat-contract-test-utils.js';

export function expectUnitCountMapParity(values, actualCountMap, label) {
  const expectedCountMap = buildUnitCountMap(values);
  expect(actualCountMap, `${label} count-map parity mismatch`).toEqual(expectedCountMap);
}

export function expectUnitCountMapByKeyParity(valuesByKey, actualCountMapByKey, label) {
  const expectedCountMapByKey = buildUnitCountMapByKey(valuesByKey);
  expect(actualCountMapByKey, `${label} keyed count-map parity mismatch`).toEqual(expectedCountMapByKey);
}

export function expectEachDomainValueOccursExactlyOnce(values, resolveCount, label) {
  expect(Array.isArray(values), `${label} must receive array values`).toBe(true);
  for (const value of values) {
    expect(
      resolveCount(value),
      `${label} expected value to appear exactly once: ${value}`
    ).toBe(1);
  }
}
