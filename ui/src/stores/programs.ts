import { create } from 'zustand';
import { listPrograms } from '../ipc';

interface ProgramsState {
  /**
   * The programs each shell can run, by shell id, in lower case. A shell is
   * missing until its first check and `null` when its programs cannot be
   * known (WSL). Either way the command guide then assumes a program exists.
   */
  byShell: Record<string, ReadonlySet<string> | null>;
  /**
   * Checks the machine again for the shell `shellId`. Called when a terminal
   * opens: that is when a program installed a moment ago starts to work.
   */
  refresh: (shellId: string) => Promise<void>;
}

export const usePrograms = create<ProgramsState>((set) => ({
  byShell: {},

  refresh: async (shellId) => {
    try {
      const names = await listPrograms(shellId);
      const programs = names && new Set(names.map((name) => name.toLowerCase()));
      set((state) => ({ byShell: { ...state.byShell, [shellId]: programs } }));
    } catch {
      // Hints are a convenience: without the list they only say less.
    }
  },
}));
