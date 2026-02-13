import { describe, expect, it } from 'vitest';
import { registerAllCommandModules } from './test-helpers/cli-command-fixtures.js';

describe('CLI help contract', () => {
  it('includes expected high-level command surface', () => {
    const help = registerAllCommandModules().helpInformation();
    expect(help).toContain('init');
    expect(help).toContain('context');
    expect(help).toContain('compat');
    expect(help).toContain('graph');
    expect(help).toContain('repair-session');
    expect(help).toContain('template');
  });

  it('documents context auto profile and compat strict options', () => {
    const program = registerAllCommandModules();
    const contextHelp = program.commands.find((command) => command.name() === 'context')?.helpInformation() ?? '';
    const compatHelp = program.commands.find((command) => command.name() === 'compat')?.helpInformation() ?? '';
    expect(contextHelp).toContain('--profile <profile>');
    expect(contextHelp).toContain('auto');
    expect(compatHelp).toContain('--strict');
  });
});
