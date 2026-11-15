import { create } from 'zustand';
import type { ShellProfile, Workspace } from '../ipc';

/** A named folder that groups terminals, like a folder of chats. */
export interface Project {
  id: string;
  name: string;
  /** Folder the project's terminals start in. */
  path: string;
}

/** One terminal. Its shell process belongs to the `TerminalPane` that shows it. */
export interface Tab {
  id: number;
  title: string;
  shellId: string;
  /** Typed and run in the shell as soon as it starts. */
  initialCommand?: string;
  /** Project it belongs to. `null` is the general group, outside any project. */
  projectId: string | null;
  /**
   * Whether its shell has been started. Terminals restored from the last run
   * wait until the user opens them: a saved agent must not start, and use the
   * machine, just because the app opened.
   */
  started: boolean;
  /** One-off work (an install) that is not saved with the project. */
  transient?: boolean;
}

/** Two terminals side by side, by tab id. */
export interface Split {
  left: number;
  right: number;
}

/** What a new tab can override. */
export type TabOptions = Partial<Pick<Tab, 'title' | 'initialCommand' | 'transient'>>;

interface TabsState {
  projects: Project[];
  tabs: Tab[];
  /** The project on screen. `null` is the general group. */
  activeProjectId: string | null;
  /** The terminal on screen. Always one of the active project, or `null`. */
  activeId: number | null;
  /** The terminal each project showed last, by project key. */
  lastActive: Record<string, number>;
  /**
   * Two terminals of the active project shown side by side, or `null` for
   * one terminal filling the window. `activeId` is always one of the two:
   * the one that has the keyboard.
   */
  split: Split | null;

  /** Opens a terminal for `shell` in the active project and shows it. */
  open: (shell: ShellProfile, options?: TabOptions) => void;
  /** Closes a terminal. If it was on screen, its neighbour takes its place. */
  close: (id: number) => void;
  /** Shows a terminal, switching to its project if needed. */
  activate: (id: number) => void;
  /** Moves `step` terminals within the active project, wrapping around. */
  cycle: (step: 1 | -1) => void;
  rename: (id: number, title: string) => void;
  /** Shows a project with the terminal it showed last. */
  selectProject: (id: string | null) => void;
  /** Creates a project for the folder `path` and shows it. */
  addProject: (name: string, path: string) => void;
  renameProject: (id: string, name: string) => void;
  /**
   * Shows the active terminal next to the following one of its project, or
   * goes back to one terminal. Does nothing with a single terminal.
   */
  toggleSplit: () => void;
  /** Shows two terminals of the active project side by side; `right` gets the keyboard. */
  setSplit: (left: number, right: number) => void;
  /** Removes a project and closes its terminals. The folder is not touched. */
  removeProject: (id: string) => void;
  /** Loads the projects of the last run. Their terminals are not started. */
  restore: (workspace: Workspace) => void;
}

// Ids are never reused, so a closing tab cannot be confused with a new one.
let nextId = 1;

const keyOf = (projectId: string | null) => projectId ?? '';

/** The terminals of one project, in order. */
export function tabsOf(tabs: Tab[], projectId: string | null): Tab[] {
  return tabs.filter((tab) => tab.projectId === projectId);
}

/**
 * The split after the terminal `next` takes the keyboard from `previous`.
 * One of the two shown only gets the keyboard. Any other terminal takes the
 * place of the one that had it: the other half stays where it is.
 */
function splitAfter(split: Split | null, previous: number | null, next: number): Split | null {
  if (!split || next === split.left || next === split.right) return split;
  return previous === split.right ? { ...split, right: next } : { ...split, left: next };
}

/** A copy of `tabs` where the terminal `id` is marked as started. */
const start = (tabs: Tab[], id: number | null) =>
  tabs.map((tab) => (tab.id === id && !tab.started ? { ...tab, started: true } : tab));

export const useTabs = create<TabsState>((set) => ({
  projects: [],
  tabs: [],
  activeProjectId: null,
  activeId: null,
  lastActive: {},
  split: null,

  open: (shell, options) =>
    set((state) => {
      const tab: Tab = {
        id: nextId++,
        title: shell.name,
        shellId: shell.id,
        projectId: state.activeProjectId,
        started: true,
        ...options,
      };
      return {
        tabs: [...state.tabs, tab],
        activeId: tab.id,
        lastActive: { ...state.lastActive, [keyOf(tab.projectId)]: tab.id },
        split: splitAfter(state.split, state.activeId, tab.id),
      };
    }),

  close: (id) =>
    set((state) => {
      const closing = state.tabs.find((tab) => tab.id === id);
      if (!closing) return state;
      const tabs = state.tabs.filter((tab) => tab.id !== id);
      // Closing one half of a split leaves the other one filling the window.
      const { split } = state;
      const other = split?.left === id ? split.right : split?.right === id ? split.left : null;
      if (state.activeId !== id) return { tabs, split: other === null ? split : null };
      if (other !== null) {
        return {
          tabs,
          activeId: other,
          split: null,
          lastActive: { ...state.lastActive, [keyOf(closing.projectId)]: other },
        };
      }

      // Same position within the project, or the new last one.
      const index = tabsOf(state.tabs, closing.projectId).indexOf(closing);
      const siblings = tabsOf(tabs, closing.projectId);
      const neighbour = siblings[index] ?? siblings[index - 1];
      const lastActive = { ...state.lastActive };
      if (neighbour) lastActive[keyOf(closing.projectId)] = neighbour.id;
      else delete lastActive[keyOf(closing.projectId)];
      return {
        tabs: start(tabs, neighbour?.id ?? null),
        activeId: neighbour?.id ?? null,
        lastActive,
      };
    }),

  activate: (id) =>
    set((state) => {
      const tab = state.tabs.find((candidate) => candidate.id === id);
      if (!tab) return state;
      return {
        tabs: start(state.tabs, id),
        activeProjectId: tab.projectId,
        activeId: id,
        lastActive: { ...state.lastActive, [keyOf(tab.projectId)]: id },
        // A split belongs to the project on screen.
        split:
          tab.projectId === state.activeProjectId
            ? splitAfter(state.split, state.activeId, id)
            : null,
      };
    }),

  cycle: (step) =>
    set((state) => {
      const visible = tabsOf(state.tabs, state.activeProjectId);
      const index = visible.findIndex((tab) => tab.id === state.activeId);
      if (index === -1) return state;
      const next = visible[(index + step + visible.length) % visible.length]!;
      return {
        tabs: start(state.tabs, next.id),
        activeId: next.id,
        lastActive: { ...state.lastActive, [keyOf(next.projectId)]: next.id },
        split: splitAfter(state.split, state.activeId, next.id),
      };
    }),

  rename: (id, title) =>
    set((state) => ({
      tabs: state.tabs.map((tab) => (tab.id === id ? { ...tab, title } : tab)),
    })),

  selectProject: (id) =>
    set((state) => {
      const own = tabsOf(state.tabs, id);
      const target = own.find((tab) => tab.id === state.lastActive[keyOf(id)]) ?? own[0];
      return {
        tabs: start(state.tabs, target?.id ?? null),
        activeProjectId: id,
        activeId: target?.id ?? null,
        split: id === state.activeProjectId ? state.split : null,
      };
    }),

  toggleSplit: () =>
    set((state) => {
      if (state.split) return { split: null };
      const visible = tabsOf(state.tabs, state.activeProjectId);
      const index = visible.findIndex((tab) => tab.id === state.activeId);
      if (index === -1 || visible.length < 2) return state;
      const companion = visible[(index + 1) % visible.length]!;
      return {
        tabs: start(state.tabs, companion.id),
        split: { left: visible[index]!.id, right: companion.id },
      };
    }),

  setSplit: (left, right) =>
    set((state) => {
      const visible = tabsOf(state.tabs, state.activeProjectId).map((tab) => tab.id);
      if (left === right || !visible.includes(left) || !visible.includes(right)) return state;
      return {
        tabs: start(start(state.tabs, left), right),
        activeId: right,
        lastActive: { ...state.lastActive, [keyOf(state.activeProjectId)]: right },
        split: { left, right },
      };
    }),

  addProject: (name, path) =>
    set((state) => {
      const project: Project = { id: crypto.randomUUID(), name, path };
      return {
        projects: [...state.projects, project],
        activeProjectId: project.id,
        activeId: null,
        split: null,
      };
    }),

  renameProject: (id, name) =>
    set((state) => ({
      projects: state.projects.map((project) =>
        project.id === id ? { ...project, name } : project,
      ),
    })),

  removeProject: (id) =>
    set((state) => {
      const projects = state.projects.filter((project) => project.id !== id);
      const tabs = state.tabs.filter((tab) => tab.projectId !== id);
      if (state.activeProjectId !== id) return { projects, tabs };
      // Back to the general group, on the terminal it showed last.
      const general = tabsOf(tabs, null);
      const target = general.find((tab) => tab.id === state.lastActive['']) ?? general[0];
      return {
        projects,
        tabs: start(tabs, target?.id ?? null),
        activeProjectId: null,
        activeId: target?.id ?? null,
        split: null,
      };
    }),

  restore: (workspace) =>
    set((state) => ({
      projects: workspace.projects.map(({ id, name, path }) => ({ id, name, path })),
      tabs: [
        ...tabsOf(state.tabs, null),
        ...workspace.projects.flatMap((project) =>
          project.terminals.map((terminal): Tab => ({
            id: nextId++,
            title: terminal.title,
            shellId: terminal.shell_id,
            initialCommand: terminal.command ?? undefined,
            projectId: project.id,
            started: false,
          })),
        ),
      ],
    })),
}));

/**
 * What is saved between runs: the projects and the terminals kept in each.
 * The general group and one-off terminals are left out.
 */
export function toWorkspace(state: Pick<TabsState, 'projects' | 'tabs'>): Workspace {
  return {
    projects: state.projects.map((project) => ({
      ...project,
      terminals: tabsOf(state.tabs, project.id)
        .filter((tab) => !tab.transient)
        .map((tab) => ({
          title: tab.title,
          shell_id: tab.shellId,
          command: tab.initialCommand ?? null,
        })),
    })),
  };
}

/**
 * Calls `save` each time the saved layout changes, and only then: switching
 * terminals changes the state all the time without changing what is saved.
 * Returns a function that stops it.
 */
export function persistWorkspace(save: (workspace: Workspace) => void): () => void {
  let last = JSON.stringify(toWorkspace(useTabs.getState()));
  return useTabs.subscribe((state) => {
    const workspace = toWorkspace(state);
    const next = JSON.stringify(workspace);
    if (next === last) return;
    last = next;
    save(workspace);
  });
}
