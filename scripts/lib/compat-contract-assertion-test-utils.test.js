import { describe, expect, it } from 'vitest';
import {
  expectEachDomainValueOccursExactlyOnce,
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
});
