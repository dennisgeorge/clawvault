import { describe, expect, it } from 'vitest';
import {
  isFlagToken,
  readRequiredOptionValue
} from './validator-arg-utils.mjs';

describe('validator arg utility helpers', () => {
  it('reads required option values and advances the index', () => {
    const parsed = readRequiredOptionValue(['--summary', 'summary.json'], 0, '--summary');
    expect(parsed).toEqual({
      value: 'summary.json',
      nextIndex: 1
    });
  });

  it('throws clear errors when required option values are missing', () => {
    expect(() => readRequiredOptionValue(['--summary'], 0, '--summary')).toThrow('Missing value for --summary');
    expect(() => readRequiredOptionValue(['--summary', '--json'], 0, '--summary')).toThrow('Missing value for --summary');
  });

  it('identifies long-option flag tokens', () => {
    expect(isFlagToken('--summary')).toBe(true);
    expect(isFlagToken('summary.json')).toBe(false);
    expect(isFlagToken('')).toBe(false);
    expect(isFlagToken(undefined)).toBe(false);
  });
});
