import { describe, expect, it } from 'vitest';
import { parseValidatorCliArgs } from './validator-cli-parser.mjs';

describe('parseValidatorCliArgs', () => {
  it('parses common and custom options with positional args', () => {
    const { parsed, positional } = parseValidatorCliArgs(
      ['--json', '--out', 'result.json', '--summary', 'summary.json', '--allow-missing-case-reports', 'summary-positional.json'],
      {
        allowPositional: true,
        initialValues: {
          summaryPath: '',
          allowMissingCaseReports: false
        },
        valueOptions: [
          { name: '--summary', key: 'summaryPath' }
        ],
        booleanOptions: [
          { name: '--allow-missing-case-reports', key: 'allowMissingCaseReports' }
        ]
      }
    );

    expect(parsed).toEqual({
      help: false,
      json: true,
      outPath: 'result.json',
      summaryPath: 'summary.json',
      allowMissingCaseReports: true
    });
    expect(positional).toEqual(['summary-positional.json']);
  });

  it('throws unknown option errors', () => {
    expect(() => parseValidatorCliArgs(['--unknown'])).toThrow('Unknown option: --unknown');
  });

  it('throws on positional args when disallowed', () => {
    expect(() => parseValidatorCliArgs(['summary.json'])).toThrow('Unexpected positional argument: summary.json');
  });

  it('throws when value option is missing a value', () => {
    expect(() => parseValidatorCliArgs(['--summary'], {
      valueOptions: [{ name: '--summary', key: 'summaryPath' }]
    })).toThrow('Missing value for --summary');
  });

  it('throws when common --out option is missing a value', () => {
    expect(() => parseValidatorCliArgs(['--out'])).toThrow('Missing value for --out');
  });

  it('marks --help and -h as help mode', () => {
    expect(parseValidatorCliArgs(['--help']).parsed.help).toBe(true);
    expect(parseValidatorCliArgs(['-h']).parsed.help).toBe(true);
  });

  it('guards duplicate custom option declarations', () => {
    expect(() => parseValidatorCliArgs([], {
      valueOptions: [
        { name: '--summary', key: 'summaryPath' },
        { name: '--summary', key: 'summaryPath2' }
      ]
    })).toThrow('validator cli parser received duplicate option: --summary');
  });
});
