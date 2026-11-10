import { describe, expect, it } from 'vitest';
import type { AgentStatus, ShellProfile } from '../ipc';
import { buildNewTabMenu } from './menu';

const shells: ShellProfile[] = [
  { id: 'powershell', name: 'Windows PowerShell', program: 'powershell.exe', args: [] },
  { id: 'git-bash', name: 'Git Bash', program: 'bash.exe', args: [] },
];

const agent = (id: string, installed: boolean, canInstall = true): AgentStatus => ({
  id,
  name: id.toUpperCase(),
  command: id,
  installed,
  install_command: canInstall ? `npm install -g ${id}` : null,
  website: `https://example.com/${id}`,
});

const labels = (menu: ReturnType<typeof buildNewTabMenu>) =>
  Object.fromEntries(menu.map((group) => [group.label, group.items.map((item) => item.label)]));

describe('buildNewTabMenu', () => {
  it('offers every shell, each with its own profile', () => {
    const menu = buildNewTabMenu(shells, [], []);

    expect(labels(menu)).toEqual({ Shells: ['Windows PowerShell', 'Git Bash'] });
    expect(menu[0]!.items[1]!.shell?.id).toBe('git-bash');
  });

  it('opens an installed agent by running its command in the default shell', () => {
    const [, agents] = buildNewTabMenu(shells, [agent('claude', true)], []);

    const item = agents!.items[0]!;
    expect(item.shell).toBeUndefined();
    expect(item).toMatchObject({
      label: 'CLAUDE',
      options: { title: 'CLAUDE', initialCommand: 'claude' },
    });
  });

  it('lists agents from the configuration next to the detected ones', () => {
    const menu = buildNewTabMenu(
      shells,
      [agent('claude', true)],
      [{ name: 'Aider', command: 'aider --model sonnet' }],
    );

    expect(labels(menu)['Agentes de IA']).toEqual(['CLAUDE', 'Aider']);
    expect(menu[1]!.items[1]!.options?.initialCommand).toBe('aider --model sonnet');
  });

  it('offers to install a missing agent instead of opening it', () => {
    const menu = buildNewTabMenu(shells, [agent('claude', true), agent('codex', false)], []);

    expect(labels(menu)['Agentes de IA']).toEqual(['CLAUDE']);
    expect(labels(menu)['Instalar agente']).toEqual(['Instalar CODEX']);
    expect(menu[2]!.items[0]!.options?.initialCommand).toBe('npm install -g codex');
  });

  it('hides a missing agent that cannot be installed from here', () => {
    const menu = buildNewTabMenu(shells, [agent('codex', false, false)], []);

    expect(Object.keys(labels(menu))).toEqual(['Shells']);
  });

  it('gives every item a different key', () => {
    const menu = buildNewTabMenu(
      shells,
      [agent('claude', true), agent('codex', false)],
      [
        { name: 'A', command: 'a' },
        { name: 'A', command: 'b' },
      ],
    );
    const keys = menu.flatMap((group) => group.items.map((item) => item.key));

    expect(new Set(keys).size).toBe(keys.length);
  });
});
