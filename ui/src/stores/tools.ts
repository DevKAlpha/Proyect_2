import { create } from 'zustand';
import {
  browserClose,
  browserOpen,
  browserStatus,
  listAgents,
  listTools,
  type AgentStatus,
  type BrowserStatus,
  type ToolStatus,
} from '../ipc';

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
  /** Known AI agents, installed or not. */
  agents: AgentStatus[];
  /** The test browser. `null` until the first check. */
  browser: BrowserStatus | null;
  /** Why the test browser could not start, if it could not. */
  browserError: string | null;
  /** The user asked not to see the missing-tools bar again. */
  hidden: boolean;
  /** Checks the machine again, for example after an install finished. */
  refresh: () => Promise<void>;
  hide: () => void;
  /** Opens the test browser, or closes it when it is open. */
  toggleBrowser: () => Promise<void>;
}

export const useTools = create<ToolsState>((set, get) => ({
  tools: [],
  agents: [],
  browser: null,
  browserError: null,
  hidden: readHidden(),

  refresh: async () => {
    try {
      const [tools, agents, browser] = await Promise.all([
        listTools(),
        listAgents(),
        browserStatus(),
      ]);
      set({ tools, agents, browser });
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

  toggleBrowser: async () => {
    try {
      const browser = await (get().browser?.running ? browserClose() : browserOpen());
      set({ browser, browserError: null });
    } catch (error) {
      set({ browserError: String(error) });
    }
  },
}));

/** The tools worth telling the user about. */
export function missingTools(tools: ToolStatus[]): ToolStatus[] {
  return tools.filter((tool) => !tool.installed);
}
