import { describe, expect, it } from 'vitest';
import {
  expectEachDomainValueOccursExactlyOnce,
  expectNonEmptyStringRecord,
  expectNonEmptyUniqueStringArray,
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
});
