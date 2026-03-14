import { describe, expect, it } from 'vitest';
import { registerAllCommandModules } from './test-helpers/cli-command-fixtures.js';

describe('CLI help contract', () => {
  it('includes expected high-level command surface', () => {
    const help = registerAllCommandModules().helpInformation();
    expect(help).toContain('init');
    expect(help).toContain('context');
    expect(help).toContain('recall');
    expect(help).toContain('inject');
    expect(help).toContain('doctor');
    expect(help).toContain('benchmark');
    expect(help).toContain('maintain');
    expect(help).toContain('embed');
    expect(help).toContain('inbox');
    expect(help).toContain('patch');
    expect(help).toContain('compat');
    expect(help).toContain('graph');
    expect(help).toContain('reflect');
    expect(help).toContain('replay');
    expect(help).toContain('repair-session');
    expect(help).toContain('project');
    expect(help).toContain('template');
    expect(help).toContain('config');
    expect(help).toContain('route');
    expect(help).toContain('entity');
  });

  it('documents context/compat/inject/project help details', () => {
    const program = registerAllCommandModules();
    const contextHelp = program.commands.find((command) => command.name() === 'context')?.helpInformation() ?? '';
    const compatHelp = program.commands.find((command) => command.name() === 'compat')?.helpInformation() ?? '';
    const injectHelp = program.commands.find((command) => command.name() === 'inject')?.helpInformation() ?? '';
    const projectCommand = program.commands.find((command) => command.name() === 'project');
    const projectListHelp = projectCommand?.commands.find((command) => command.name() === 'list')?.helpInformation() ?? '';
    const projectBoardHelp = projectCommand?.commands.find((command) => command.name() === 'board')?.helpInformation() ?? '';
    expect(contextHelp).toContain('--profile <profile>');
    expect(contextHelp).toContain('auto');
    expect(compatHelp).toContain('--strict');
    expect(injectHelp).toContain('inject.maxResults');
    expect(injectHelp).toContain('inject.scope');
    expect(projectListHelp).toContain('archived projects are hidden');
    expect(projectBoardHelp).toContain('default: status');
  });

  it('does not advertise removed workgraph commands', () => {
    const program = registerAllCommandModules();
    const names = program.commands.map((command) => command.name());

    expect(names).not.toContain('wg');
    expect(names).not.toContain('thread');
    expect(names).not.toContain('primitive');
    expect(names).not.toContain('ledger');
  });
});
