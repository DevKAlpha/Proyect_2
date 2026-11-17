import { create } from 'zustand';
import { historyAdd, historyClear, historyList } from '../ipc';

interface HistoryState {
  /** The commands the user ran, oldest first. Shared by every terminal. */
  entries: string[];
  load: () => Promise<void>;
  /**
   * Remembers a command the user just ran. The Rust side decides whether it
   * is worth keeping (it drops what looks like a credential) and answers
   * with the list as it is now.
   */
  record: (command: string) => Promise<void>;
  /** Forgets every command, also on disk. */
  clear: () => Promise<void>;
}

export const useHistory = create<HistoryState>((set) => ({
  entries: [],

  load: async () => {
    try {
      set({ entries: await historyList() });
    } catch {
      // Suggestions are a convenience: without them the terminal still works.
    }
  },

  record: async (command) => {
    try {
      set({ entries: await historyAdd(command) });
    } catch {
      // Same as above: a command that was not remembered is not an error.
    }
  },

  clear: async () => {
    await historyClear();
    set({ entries: [] });
  },
}));
