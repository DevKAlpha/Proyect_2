import { create } from 'zustand';
import {
  getConfig,
  listShells,
  onConfigChanged,
  onConfigError,
  type Config,
  type ShellProfile,
} from '../ipc';

interface SettingsState {
  /** `null` until the first load finishes. */
  config: Config | null;
  shells: ShellProfile[];
  /** What is wrong with the configuration file after a bad edit, if anything. */
  configError: string | null;
  /** Loads configuration and shells, then follows edits of the file. */
  load: () => Promise<void>;
  dismissConfigError: () => void;
}

export const useSettings = create<SettingsState>((set) => ({
  config: null,
  shells: [],
  configError: null,

  load: async () => {
    const [config, shells] = await Promise.all([getConfig(), listShells()]);
    set({ config, shells });
    // These listeners live as long as the window, so they are never removed.
    await onConfigChanged((next) => set({ config: next, configError: null }));
    await onConfigError((message) => set({ configError: message }));
  },

  dismissConfigError: () => set({ configError: null }),
}));

/**
 * The shell for a new tab: the one named in the configuration when it exists
 * on this machine, otherwise the first one detected.
 */
export function pickDefaultShell(
  config: Pick<Config, 'default_shell'>,
  shells: ShellProfile[],
): ShellProfile | undefined {
  return shells.find((shell) => shell.id === config.default_shell) ?? shells[0];
}
