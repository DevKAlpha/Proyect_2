import { create } from 'zustand';
import type { ShellProfile } from '../ipc';

/** One open tab. Its shell process belongs to the `TerminalPane` that shows it. */
export interface Tab {
  id: number;
  title: string;
  shellId: string;
  /** Typed and run in the shell as soon as it starts. */
  initialCommand?: string;
}

/** What a new tab can override. */
export type TabOptions = Partial<Pick<Tab, 'title' | 'initialCommand'>>;

interface TabsState {
  tabs: Tab[];
  activeId: number | null;
  /** Opens a tab for `shell` and makes it the active one. */
  open: (shell: ShellProfile, options?: TabOptions) => void;
  /** Closes a tab. If it was active, the tab that takes its place becomes active. */
  close: (id: number) => void;
  activate: (id: number) => void;
  /** Moves the active tab `step` places, wrapping around the ends. */
  cycle: (step: 1 | -1) => void;
}

// Ids are never reused, so a closing tab cannot be confused with a new one.
let nextId = 1;

export const useTabs = create<TabsState>((set) => ({
  tabs: [],
  activeId: null,

  open: (shell, options) =>
    set((state) => {
      const tab: Tab = { id: nextId++, title: shell.name, shellId: shell.id, ...options };
      return { tabs: [...state.tabs, tab], activeId: tab.id };
    }),

  close: (id) =>
    set((state) => {
      const index = state.tabs.findIndex((tab) => tab.id === id);
      if (index === -1) return state;
      const tabs = state.tabs.filter((tab) => tab.id !== id);
      if (state.activeId !== id) return { tabs };
      // Same position, or the new last tab when the last one was closed.
      const neighbour = tabs[index] ?? tabs[index - 1];
      return { tabs, activeId: neighbour?.id ?? null };
    }),

  activate: (id) => set({ activeId: id }),

  cycle: (step) =>
    set((state) => {
      const index = state.tabs.findIndex((tab) => tab.id === state.activeId);
      if (index === -1) return state;
      const count = state.tabs.length;
      return { activeId: state.tabs[(index + step + count) % count]!.id };
    }),
}));
