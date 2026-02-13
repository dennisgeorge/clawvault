import { describe, expect, it } from 'vitest';
import {
  expectArrayOfRecordsWithRequiredStringFields,
  expectDistinctStringFieldsPerRecord,
  expectEachDomainValueOccursExactlyOnce,
  expectNonEmptyStringRecord,
  expectNonEmptyUniqueStringArray,
  expectObjectKeyDomainParity,
  expectUniqueStringFieldAcrossRecords,
  expectUniqueDomainCountMapByKeyParity,
  expectUniqueDomainCountMapParity,
  expectUnitCountMapByKeyParity,
  expectUnitCountMapParity
} from './compat-contract-assertion-test-utils.js';

describe('compat contract assertion test utils', () => {
  it('asserts unit count-map parity for array domains', () => {
    expectUnitCountMapParity(
      ['a', 'b', 'a'],
      {
        a: 2,
        b: 1
      },
      'array domain'
    );
  });

  it('asserts keyed unit count-map parity for nested array domains', () => {
    expectUnitCountMapByKeyParity(
      {
        jobs: ['test', 'build', 'test'],
        steps: ['checkout']
      },
      {
        jobs: {
          test: 2,
          build: 1
        },
        steps: {
          checkout: 1
        }
      },
      'nested array domain'
    );
  });

  it('throws when unit count-map parity does not match expected counts', () => {
    expect(() => {
      expectUnitCountMapParity(
        ['a', 'b'],
        {
          a: 2,
          b: 1
        },
        'mismatched array domain'
      );
    }).toThrow();
  });

  it('throws when keyed unit count-map parity does not match expected counts', () => {
    expect(() => {
      expectUnitCountMapByKeyParity(
        {
          jobs: ['test']
        },
        {
          jobs: {
            test: 2
          }
        },
        'mismatched nested array domain'
      );
    }).toThrow();
  });

  it('asserts each domain value occurs exactly once via resolver', () => {
    const counts = {
      alpha: 1,
      beta: 1
    };
    expectEachDomainValueOccursExactlyOnce(
      ['alpha', 'beta'],
      (value) => counts[value] ?? 0,
      'unit-domain occurrence check'
    );
  });

  it('throws when a domain value does not occur exactly once', () => {
    const counts = {
      alpha: 2
    };
    expect(() => {
      expectEachDomainValueOccursExactlyOnce(
        ['alpha'],
        (value) => counts[value] ?? 0,
        'mismatched domain occurrence check'
      );
    }).toThrow();
  });

  it('asserts unique domain count-map parity', () => {
    expectUniqueDomainCountMapParity(
      ['alpha', 'beta'],
      {
        alpha: 1,
        beta: 1
      },
      'unique domain parity'
    );
  });

  it('asserts unique keyed domain count-map parity', () => {
    expectUniqueDomainCountMapByKeyParity(
      {
        jobs: ['test', 'build'],
        steps: ['checkout']
      },
      {
        jobs: {
          test: 1,
          build: 1
        },
        steps: {
          checkout: 1
        }
      },
      'unique keyed domain parity'
    );
  });

  it('throws when unique domain parity receives duplicate values', () => {
    expect(() => {
      expectUniqueDomainCountMapParity(
        ['alpha', 'alpha'],
        {
          alpha: 1
        },
        'duplicate unique domain parity'
      );
    }).toThrow();
  });

  it('throws when unique keyed domain parity receives duplicate values', () => {
    expect(() => {
      expectUniqueDomainCountMapByKeyParity(
        {
          jobs: ['test', 'test']
        },
        {
          jobs: {
            test: 1
          }
        },
        'duplicate unique keyed domain parity'
      );
    }).toThrow();
  });

  it('asserts non-empty unique string arrays', () => {
    expectNonEmptyUniqueStringArray(['alpha', 'beta'], 'string-array domain');
    expectNonEmptyUniqueStringArray([], 'empty-allowed string-array domain', { requireNonEmpty: false });
  });

  it('throws when non-empty unique string arrays are invalid', () => {
    expect(() => {
      expectNonEmptyUniqueStringArray(['alpha', 'alpha'], 'duplicate string-array domain');
    }).toThrow();
    expect(() => {
      expectNonEmptyUniqueStringArray(['alpha', ''], 'empty-entry string-array domain');
    }).toThrow();
    expect(() => {
      expectNonEmptyUniqueStringArray([], 'empty string-array domain');
    }).toThrow();
  });

  it('asserts non-empty string records', () => {
    expectNonEmptyStringRecord(
      {
        alpha: 'one',
        beta: 'two'
      },
      'string-record domain',
      { requireNonEmpty: true }
    );
    expectNonEmptyStringRecord({}, 'optional-empty string-record domain');
  });

  it('throws when non-empty string records are invalid', () => {
    expect(() => {
      expectNonEmptyStringRecord([], 'array string-record domain');
    }).toThrow();
    expect(() => {
      expectNonEmptyStringRecord(
        {
          alpha: ''
        },
        'empty-value string-record domain'
      );
    }).toThrow();
    expect(() => {
      expectNonEmptyStringRecord({}, 'empty-required string-record domain', { requireNonEmpty: true });
    }).toThrow();
  });

  it('asserts object key-domain parity', () => {
    expectObjectKeyDomainParity(
      {
        alpha: 1,
        beta: 2
      },
      ['alpha', 'beta'],
      'object key-domain parity'
    );
  });

  it('throws when object key-domain parity mismatches expected keys', () => {
    expect(() => {
      expectObjectKeyDomainParity(
        {
          alpha: 1
        },
        ['alpha', 'beta'],
        'mismatched object key-domain parity'
      );
    }).toThrow();
  });

  it('asserts array-of-records required string fields', () => {
    expectArrayOfRecordsWithRequiredStringFields(
      [
        { name: 'alpha', value: 'one' },
        { name: 'beta', value: 'two' }
      ],
      ['name', 'value'],
      'array-of-records string-field domain'
    );
    expectArrayOfRecordsWithRequiredStringFields(
      [],
      ['name'],
      'empty-allowed array-of-records string-field domain',
      { requireNonEmpty: false }
    );
  });

  it('throws when array-of-records required string fields are invalid', () => {
    expect(() => {
      expectArrayOfRecordsWithRequiredStringFields(
        [{ name: '' }],
        ['name'],
        'empty-field array-of-records string-field domain'
      );
    }).toThrow();
    expect(() => {
      expectArrayOfRecordsWithRequiredStringFields(
        [{ name: 'alpha' }],
        ['name', 'value'],
        'missing-field array-of-records string-field domain'
      );
    }).toThrow();
    expect(() => {
      expectArrayOfRecordsWithRequiredStringFields(
        [],
        ['name'],
        'empty-required array-of-records string-field domain'
      );
    }).toThrow();
  });

  it('asserts unique string field domains across records', () => {
    expectUniqueStringFieldAcrossRecords(
      [
        { name: 'alpha' },
        { name: 'beta' }
      ],
      'name',
      'unique string field domain'
    );
  });

  it('throws when unique string field domains across records are invalid', () => {
    expect(() => {
      expectUniqueStringFieldAcrossRecords(
        [
          { name: 'alpha' },
          { name: 'alpha' }
        ],
        'name',
        'duplicate unique string field domain'
      );
    }).toThrow();
    expect(() => {
      expectUniqueStringFieldAcrossRecords(
        [{ notName: 'alpha' }],
        'name',
        'missing field unique string field domain'
      );
    }).toThrow();
  });

  it('asserts distinct string field pairs per record', () => {
    expectDistinctStringFieldsPerRecord(
      [
        { left: 'alpha', right: 'beta' },
        { left: 'one', right: 'two' }
      ],
      'left',
      'right',
      'distinct string field-pair domain'
    );
  });

  it('throws when distinct string field pairs per record are invalid', () => {
    expect(() => {
      expectDistinctStringFieldsPerRecord(
        [{ left: 'same', right: 'same' }],
        'left',
        'right',
        'equal string field-pair domain'
      );
    }).toThrow();
    expect(() => {
      expectDistinctStringFieldsPerRecord(
        [{ left: 'present' }],
        'left',
        'right',
        'missing right field-pair domain'
      );
    }).toThrow();
  });
});
