import { create } from 'zustand';
import { sshStatus, type SshHost } from '../ipc';

/**
 * A machine to connect to: `machine` or `user@machine`. Letters, digits,
 * dots, dashes and underscores only, and never a dash first: the text ends
 * up in a command line, where a space would start another argument and a
 * leading dash would be read by `ssh` as one of its options.
 */
const TARGET = /^(?:[A-Za-z0-9_][A-Za-z0-9._-]*@)?[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** Longer than any real name; a limit so that a paste by mistake is refused. */
const MAX_TARGET = 255;

/**
 * The command that opens a terminal on `target` over SSH, or `null` when
 * `target` is not a plain machine name. Every remote connection of the app
 * goes through here, also the hosts read from the user's SSH configuration.
 */
export function sshCommand(target: string): string | null {
  const wanted = target.trim();
  return wanted.length <= MAX_TARGET && TARGET.test(wanted) ? `ssh ${wanted}` : null;
}

interface RemoteState {
  /** Whether this machine has the `ssh` program. */
  available: boolean;
  /** The machines of the user's SSH configuration that can be offered. */
  hosts: SshHost[];
  /** Checks the machine again: the user may have edited their configuration. */
  refresh: () => Promise<void>;
}

export const useRemote = create<RemoteState>((set) => ({
  available: false,
  hosts: [],

  refresh: async () => {
    try {
      const status = await sshStatus();
      set({
        available: status.available,
        // A name the command would refuse is not worth offering.
        hosts: status.hosts.filter((host) => sshCommand(host.name) !== null),
      });
    } catch {
      // The menu is a shortcut: without it `ssh` can still be typed.
    }
  },
}));
