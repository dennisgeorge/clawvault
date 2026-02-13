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

export function expectNonEmptyUniqueStringArray(values, label, options = {}) {
  const { requireNonEmpty = true } = options;
  expect(Array.isArray(values), `${label} must be an array`).toBe(true);
  if (requireNonEmpty) {
    expect(values.length, `${label} must not be empty`).toBeGreaterThan(0);
  }
  expect(
    values.every((value) => typeof value === 'string' && value.length > 0),
    `${label} must contain non-empty strings`
  ).toBe(true);
  expect(new Set(values).size, `${label} must be unique`).toBe(values.length);
}

export function expectNonEmptyString(value, label) {
  expect(typeof value, `${label} must be a string`).toBe('string');
  expect(value.length, `${label} must be a non-empty string`).toBeGreaterThan(0);
}

export function expectNonEmptyStringRecord(valuesByKey, label, options = {}) {
  const { requireNonEmpty = false } = options;
  expect(valuesByKey && typeof valuesByKey === 'object', `${label} must be an object`).toBe(true);
  expect(Array.isArray(valuesByKey), `${label} must not be an array`).toBe(false);
  const entries = Object.entries(valuesByKey);
  if (requireNonEmpty) {
    expect(entries.length, `${label} must not be empty`).toBeGreaterThan(0);
  }
  for (const [key, value] of entries) {
    expect(typeof key, `${label} keys must be strings`).toBe('string');
    expect(key.length, `${label} keys must be non-empty strings`).toBeGreaterThan(0);
    expect(typeof value, `${label} values must be strings`).toBe('string');
    expect(value.length, `${label} values must be non-empty strings`).toBeGreaterThan(0);
  }
}

export function expectObjectKeyDomainParity(valuesByKey, expectedKeys, label) {
  expect(valuesByKey && typeof valuesByKey === 'object', `${label} must be an object`).toBe(true);
  expect(Array.isArray(valuesByKey), `${label} must not be an array`).toBe(false);
  expectNonEmptyUniqueStringArray(expectedKeys, `${label} expected key domain`);
  expect(Object.keys(valuesByKey).sort(), `${label} key-domain parity mismatch`).toEqual([...expectedKeys].sort());
}

export function expectKeyedStringArrayDomains(valuesByKey, keyDomain, label, options = {}) {
  const {
    requireExactKeyDomain = false,
    allowEmptyKeys = []
  } = options;
  expect(valuesByKey && typeof valuesByKey === 'object', `${label} must be an object`).toBe(true);
  expect(Array.isArray(valuesByKey), `${label} must not be an array`).toBe(false);
  expectNonEmptyUniqueStringArray(keyDomain, `${label} key domain`);
  expectNonEmptyUniqueStringArray(allowEmptyKeys, `${label} allow-empty key domain`, { requireNonEmpty: false });
  const keyDomainSet = new Set(keyDomain);
  for (const allowEmptyKey of allowEmptyKeys) {
    expect(keyDomainSet.has(allowEmptyKey), `${label} allow-empty key must belong to key domain: ${allowEmptyKey}`).toBe(true);
  }
  if (requireExactKeyDomain) {
    expectObjectKeyDomainParity(valuesByKey, keyDomain, `${label} exact key-domain`);
  }
  for (const [domainKey, values] of Object.entries(valuesByKey)) {
    expect(keyDomainSet.has(domainKey), `${label} key must belong to key domain: ${domainKey}`).toBe(true);
    expectNonEmptyUniqueStringArray(values, `${label}[${domainKey}]`, {
      requireNonEmpty: !allowEmptyKeys.includes(domainKey)
    });
  }
}

export function expectKeyedStringRecordDomains(valuesByKey, keyDomain, label, options = {}) {
  const {
    requireExactKeyDomain = false,
    allowEmptyKeys = []
  } = options;
  expect(valuesByKey && typeof valuesByKey === 'object', `${label} must be an object`).toBe(true);
  expect(Array.isArray(valuesByKey), `${label} must not be an array`).toBe(false);
  expectNonEmptyUniqueStringArray(keyDomain, `${label} key domain`);
  expectNonEmptyUniqueStringArray(allowEmptyKeys, `${label} allow-empty key domain`, { requireNonEmpty: false });
  const keyDomainSet = new Set(keyDomain);
  for (const allowEmptyKey of allowEmptyKeys) {
    expect(keyDomainSet.has(allowEmptyKey), `${label} allow-empty key must belong to key domain: ${allowEmptyKey}`).toBe(true);
  }
  if (requireExactKeyDomain) {
    expectObjectKeyDomainParity(valuesByKey, keyDomain, `${label} exact key-domain`);
  }
  for (const [domainKey, values] of Object.entries(valuesByKey)) {
    expect(keyDomainSet.has(domainKey), `${label} key must belong to key domain: ${domainKey}`).toBe(true);
    expectNonEmptyStringRecord(values, `${label}[${domainKey}]`, {
      requireNonEmpty: !allowEmptyKeys.includes(domainKey)
    });
  }
}

export function expectArrayOfRecordsWithRequiredStringFields(records, requiredFields, label, options = {}) {
  const { requireNonEmpty = true } = options;
  expect(Array.isArray(records), `${label} must be an array`).toBe(true);
  expectNonEmptyUniqueStringArray(requiredFields, `${label} required field domain`);
  if (requireNonEmpty) {
    expect(records.length, `${label} must not be empty`).toBeGreaterThan(0);
  }
  for (const record of records) {
    expect(record && typeof record === 'object', `${label} entries must be objects`).toBe(true);
    expect(Array.isArray(record), `${label} entries must not be arrays`).toBe(false);
    for (const fieldName of requiredFields) {
      expect(typeof record[fieldName], `${label} field=${fieldName} must be a string`).toBe('string');
      expect(record[fieldName].length, `${label} field=${fieldName} must be non-empty`).toBeGreaterThan(0);
    }
  }
}

export function expectUniqueStringFieldAcrossRecords(records, fieldName, label, options = {}) {
  const { requireNonEmpty = true } = options;
  expect(Array.isArray(records), `${label} must be an array`).toBe(true);
  expect(typeof fieldName, `${label} fieldName must be a string`).toBe('string');
  expect(fieldName.length, `${label} fieldName must be non-empty`).toBeGreaterThan(0);
  if (requireNonEmpty) {
    expect(records.length, `${label} must not be empty`).toBeGreaterThan(0);
  }
  const values = records.map((record) => record?.[fieldName]);
  expectNonEmptyUniqueStringArray(values, `${label} field=${fieldName}`, { requireNonEmpty });
}

export function expectDistinctStringFieldsPerRecord(records, leftFieldName, rightFieldName, label, options = {}) {
  const { requireNonEmpty = true } = options;
  expect(Array.isArray(records), `${label} must be an array`).toBe(true);
  expect(typeof leftFieldName, `${label} leftFieldName must be a string`).toBe('string');
  expect(leftFieldName.length, `${label} leftFieldName must be non-empty`).toBeGreaterThan(0);
  expect(typeof rightFieldName, `${label} rightFieldName must be a string`).toBe('string');
  expect(rightFieldName.length, `${label} rightFieldName must be non-empty`).toBeGreaterThan(0);
  if (requireNonEmpty) {
    expect(records.length, `${label} must not be empty`).toBeGreaterThan(0);
  }
  for (const record of records) {
    expect(record && typeof record === 'object', `${label} entries must be objects`).toBe(true);
    expect(Array.isArray(record), `${label} entries must not be arrays`).toBe(false);
    expect(typeof record[leftFieldName], `${label} field=${leftFieldName} must be a string`).toBe('string');
    expect(record[leftFieldName].length, `${label} field=${leftFieldName} must be non-empty`).toBeGreaterThan(0);
    expect(typeof record[rightFieldName], `${label} field=${rightFieldName} must be a string`).toBe('string');
    expect(record[rightFieldName].length, `${label} field=${rightFieldName} must be non-empty`).toBeGreaterThan(0);
    expect(record[leftFieldName], `${label} fields must differ (${leftFieldName} vs ${rightFieldName})`).not.toBe(
      record[rightFieldName]
    );
  }
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

export function expectUniqueDomainCountMapParity(values, actualCountMap, label) {
  expect(Array.isArray(values), `${label} must receive array values`).toBe(true);
  expect(new Set(values).size, `${label} must contain unique domain values`).toBe(values.length);
  const expectedCountMap = buildUnitCountMap(values);
  expect(actualCountMap, `${label} unique count-map parity mismatch`).toEqual(expectedCountMap);
}

export function expectUniqueDomainCountMapByKeyParity(valuesByKey, actualCountMapByKey, label) {
  expect(valuesByKey && typeof valuesByKey === 'object', `${label} must receive keyed domain values`).toBe(true);
  for (const [domainKey, values] of Object.entries(valuesByKey)) {
    expect(Array.isArray(values), `${label} must provide array domain values for key=${domainKey}`).toBe(true);
    expect(new Set(values).size, `${label} must provide unique domain values for key=${domainKey}`).toBe(values.length);
  }
  const expectedCountMapByKey = buildUnitCountMapByKey(valuesByKey);
  expect(actualCountMapByKey, `${label} unique keyed count-map parity mismatch`).toEqual(expectedCountMapByKey);
}
