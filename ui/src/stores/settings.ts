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
  /** Points added to the configured font size with the zoom keys. Not saved. */
  zoom: number;
  /** Loads configuration and shells, then follows edits of the file. */
  load: () => Promise<void>;
  dismissConfigError: () => void;
  /** Makes the text one step larger (`1`) or smaller (`-1`). */
  zoomBy: (step: 1 | -1) => void;
  resetZoom: () => void;
}

const MIN_FONT_SIZE = 6;
const MAX_FONT_SIZE = 48;

/** The font size on screen: the configured size plus zoom, kept readable. */
export function effectiveFontSize(configured: number, zoom: number): number {
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, configured + zoom));
}

/**
 * Resolves when the font files for `family` are ready to draw. xterm.js
 * measures the font once when a screen opens; if the file arrives later the
 * grid keeps the wrong cell size.
 */
export async function loadFonts(family: string): Promise<void> {
  try {
    await Promise.all(
      ['400', '700', 'italic 400'].map((style) => document.fonts.load(`${style} 14px ${family}`)),
    );
  } catch {
    // An invalid family in the configuration: the browser falls back by itself.
  }
}

export const useSettings = create<SettingsState>((set) => ({
  config: null,
  shells: [],
  configError: null,
  zoom: 0,

  zoomBy: (step) =>
    set((state) => {
      const base = state.config?.font.size ?? 14;
      // Stop at the limits, so zooming back responds at the first key press.
      const size = effectiveFontSize(base, state.zoom + step);
      return { zoom: size - base };
    }),

  resetZoom: () => set({ zoom: 0 }),

  load: async () => {
    const [config, shells] = await Promise.all([getConfig(), listShells()]);
    await loadFonts(config.font.family);
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
