import type { AgentStatus, Config, ShellProfile } from '../ipc';
import type { TabOptions } from './tabs';

/** One choice in the new-tab menu. */
export interface MenuItem {
  /** Unique within the menu. */
  key: string;
  label: string;
  /** Shell for the tab. Omitted means the default shell. */
  shell?: ShellProfile;
  /** Title and start-up command of the tab, when it is not a plain shell. */
  options?: TabOptions;
}

export interface MenuGroup {
  label: string;
  items: MenuItem[];
}

/**
 * Everything a new tab can be: a shell, an installed agent, an agent the
 * user added in the configuration, or the install of a known agent.
 *
 * An agent is not a kind of shell. Its tab is a normal shell tab that runs
 * the agent's command at start: the agent gets the user's environment, and
 * the shell is still there when the agent exits.
 */
export function buildNewTabMenu(
  shells: ShellProfile[],
  agents: AgentStatus[],
  custom: Config['agents'],
): MenuGroup[] {
  const groups: MenuGroup[] = [
    {
      label: 'Shells',
      items: shells.map((shell) => ({ key: `shell:${shell.id}`, label: shell.name, shell })),
    },
    {
      label: 'Agentes de IA',
      items: [
        ...agents
          .filter((agent) => agent.installed)
          .map((agent) => ({
            key: `agent:${agent.id}`,
            label: agent.name,
            options: { title: agent.name, initialCommand: agent.command },
          })),
        ...custom.map((agent, index) => ({
          key: `custom:${index}`,
          label: agent.name,
          options: { title: agent.name, initialCommand: agent.command },
        })),
      ],
    },
    {
      label: 'Instalar agente',
      items: agents.flatMap((agent) =>
        !agent.installed && agent.install_command
          ? [
              {
                key: `install:${agent.id}`,
                label: `Instalar ${agent.name}`,
                options: {
                  title: `Instalar ${agent.name}`,
                  initialCommand: agent.install_command,
                },
              },
            ]
          : [],
      ),
    },
  ];
  // An empty group would be a heading with nothing under it.
  return groups.filter((group) => group.items.length > 0);
}
