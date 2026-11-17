import { create } from 'zustand';
import {
  applyTemplate,
  getConfig,
  listShells,
  listTemplates,
  onConfigChanged,
  onConfigError,
  readBackground,
  type Config,
  type ShellProfile,
  type Template,
} from '../ipc';
import { imageType } from './theme';

/** Where the sizes of the parts of the window are kept. View preferences, not configuration. */
const SIDEBAR_WIDTH_KEY = 'terminal:sidebar-width';
const SPLIT_RATIO_KEY = 'terminal:split-ratio';

/** Limits of the sidebar, in pixels: wide enough to read, never most of the window. */
export const SIDEBAR_WIDTH = { min: 160, max: 480, initial: 264 };
/** Limits of the left half of a split, as a share of the room: neither half can vanish. */
export const SPLIT_RATIO = { min: 0.2, max: 0.8, initial: 0.5 };

/** `value` kept within `limits`; something that is not a number gives the initial value. */
export function withinLimits(
  value: number,
  limits: { min: number; max: number; initial: number },
): number {
  if (!Number.isFinite(value)) return limits.initial;
  return Math.min(limits.max, Math.max(limits.min, value));
}

/** A size the user chose in an earlier run, or the initial one. */
function readSize(key: string, limits: { min: number; max: number; initial: number }): number {
  try {
    const saved = localStorage.getItem(key);
    return saved === null ? limits.initial : withinLimits(Number(saved), limits);
  } catch {
    // Storage can be blocked, or missing outside a browser.
    return limits.initial;
  }
}

function saveSize(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Remembered for this run only.
  }
}

/** Where the "sidebar closed" choice is kept. A view preference, not configuration. */
const SIDEBAR_KEY = 'terminal:sidebar-closed';

function readSidebarOpen(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_KEY) !== '1';
  } catch {
    // Storage can be blocked, or missing outside a browser: start open.
    return true;
  }
}

interface SettingsState {
  /** `null` until the first load finishes. */
  config: Config | null;
  shells: ShellProfile[];
  /** What is wrong with the configuration file after a bad edit, if anything. */
  configError: string | null;
  /** Points added to the configured font size with the zoom keys. Not saved. */
  zoom: number;
  /** Object URL of the background picture, or `null` without one. */
  backgroundUrl: string | null;
  sidebarOpen: boolean;
  /** Width of the sidebar, in pixels. */
  sidebarWidth: number;
  /** Share of the room the left half of a split takes, from 0 to 1. */
  splitRatio: number;
  setSidebarWidth: (width: number) => void;
  setSplitRatio: (ratio: number) => void;
  /** Ready-made looks the user can apply. */
  templates: Template[];
  /** Name of the template applied a moment ago, to tell the user about the copy kept. */
  appliedTemplate: string | null;
  /**
   * Gives the configuration file the look of a template. The new look
   * arrives like any edit of the file; a failure is shown where
   * configuration errors are.
   */
  applyTemplate: (id: string) => Promise<void>;
  /** Loads configuration and shells, then follows edits of the file. */
  load: () => Promise<void>;
  dismissConfigError: () => void;
  /** Whether the list of keyboard shortcuts is on screen. */
  helpOpen: boolean;
  toggleHelp: () => void;
  /** Makes the text one step larger (`1`) or smaller (`-1`). */
  zoomBy: (step: 1 | -1) => void;
  resetZoom: () => void;
  toggleSidebar: () => void;
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

export const useSettings = create<SettingsState>((set, get) => {
  /** Loads the background picture named in `config`, or clears the old one. */
  async function applyBackground(config: Config) {
    const previous = get().backgroundUrl;
    let next: string | null = null;
    if (config.background.image) {
      try {
        const bytes = await readBackground();
        next = URL.createObjectURL(new Blob([bytes], { type: imageType(config.background.image) }));
      } catch (error) {
        // Wrong path or type: say so where configuration errors are shown.
        set({ configError: String(error) });
      }
    }
    set({ backgroundUrl: next });
    // The old picture is no longer on screen; free its memory.
    if (previous) URL.revokeObjectURL(previous);
  }

  return {
    config: null,
    shells: [],
    configError: null,
    zoom: 0,
    backgroundUrl: null,
    sidebarOpen: readSidebarOpen(),
    sidebarWidth: readSize(SIDEBAR_WIDTH_KEY, SIDEBAR_WIDTH),
    splitRatio: readSize(SPLIT_RATIO_KEY, SPLIT_RATIO),

    setSidebarWidth: (width) => {
      const sidebarWidth = Math.round(withinLimits(width, SIDEBAR_WIDTH));
      saveSize(SIDEBAR_WIDTH_KEY, sidebarWidth);
      set({ sidebarWidth });
    },

    setSplitRatio: (ratio) => {
      const splitRatio = withinLimits(ratio, SPLIT_RATIO);
      saveSize(SPLIT_RATIO_KEY, splitRatio);
      set({ splitRatio });
    },
    templates: [],
    appliedTemplate: null,

    applyTemplate: async (id) => {
      try {
        await applyTemplate(id);
        const template = get().templates.find((candidate) => candidate.id === id);
        set({ appliedTemplate: template?.name ?? id, configError: null });
      } catch (error) {
        set({ appliedTemplate: null, configError: String(error) });
      }
    },

    zoomBy: (step) =>
      set((state) => {
        const base = state.config?.font.size ?? 14;
        // Stop at the limits, so zooming back responds at the first key press.
        const size = effectiveFontSize(base, state.zoom + step);
        return { zoom: size - base };
      }),

    resetZoom: () => set({ zoom: 0 }),

    toggleSidebar: () =>
      set((state) => {
        const sidebarOpen = !state.sidebarOpen;
        try {
          localStorage.setItem(SIDEBAR_KEY, sidebarOpen ? '0' : '1');
        } catch {
          // Remembered for this run only.
        }
        return { sidebarOpen };
      }),

    load: async () => {
      const [config, shells] = await Promise.all([getConfig(), listShells()]);
      await loadFonts(config.font.family);
      // The picture goes first: a screen decides once, when it opens,
      // whether it can show a picture behind it.
      await applyBackground(config);
      set({ config, shells });
      // Looks are an extra: without the list the terminal works the same.
      void listTemplates()
        .then((templates) => set({ templates }))
        .catch(() => {});
      // These listeners live as long as the window, so they are never removed.
      await onConfigChanged((next) => {
        set({ config: next, configError: null });
        void applyBackground(next);
      });
      await onConfigError((message) => set({ configError: message }));
    },

    dismissConfigError: () => set({ configError: null }),

    helpOpen: false,
    toggleHelp: () => set((state) => ({ helpOpen: !state.helpOpen })),
  };
});

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
