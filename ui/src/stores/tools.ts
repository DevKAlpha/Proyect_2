import { create } from 'zustand';
import { listTools, type ToolStatus } from '../ipc';

/** Where the "do not show again" choice is kept. A view preference, not configuration. */
const HIDDEN_KEY = 'terminal:tools-hidden';

function readHidden(): boolean {
  try {
    return localStorage.getItem(HIDDEN_KEY) === '1';
  } catch {
    // Storage can be blocked; the bar then shows again on the next start.
    return false;
  }
}

interface ToolsState {
  tools: ToolStatus[];
  /** The user asked not to see the missing-tools bar again. */
  hidden: boolean;
  /** Checks the machine again, for example after an install finished. */
  refresh: () => Promise<void>;
  hide: () => void;
}

export const useTools = create<ToolsState>((set) => ({
  tools: [],
  hidden: readHidden(),

  refresh: async () => {
    try {
      set({ tools: await listTools() });
    } catch {
      // The bar is a convenience: a failed check must not disturb the terminal.
    }
  },

  hide: () => {
    try {
      localStorage.setItem(HIDDEN_KEY, '1');
    } catch {
      // Hidden for this run only.
    }
    set({ hidden: true });
  },
}));

/** The tools worth telling the user about. */
export function missingTools(tools: ToolStatus[]): ToolStatus[] {
  return tools.filter((tool) => !tool.installed);
}
