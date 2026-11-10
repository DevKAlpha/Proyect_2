import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShellProfile, Workspace } from '../ipc';
import { persistWorkspace, tabsOf, toWorkspace, useTabs } from './tabs';

const shell = (id: string): ShellProfile => ({ id, name: id.toUpperCase(), program: id, args: [] });

const store = () => useTabs.getState();

/** Opens one terminal per shell id in the active project; returns their ids. */
function openTabs(...shellIds: string[]) {
  const before = new Set(store().tabs.map((tab) => tab.id));
  for (const id of shellIds) store().open(shell(id));
  return store()
    .tabs.filter((tab) => !before.has(tab.id))
    .map((tab) => tab.id);
}

/** Adds a project and returns its id. It becomes the active project. */
function addProject(name: string) {
  store().addProject(name, `/work/${name}`);
  return store().activeProjectId!;
}

beforeEach(() =>
  useTabs.setState({
    projects: [],
    tabs: [],
    activeProjectId: null,
    activeId: null,
    lastActive: {},
  }),
);

describe('terminals', () => {
  it('opens a terminal named after its shell and shows it', () => {
    const [first, second] = openTabs('pwsh', 'bash');

    expect(store().tabs.map((tab) => tab.title)).toEqual(['PWSH', 'BASH']);
    expect(first).not.toBe(second);
    expect(store().activeId).toBe(second);
  });

  it('lets a terminal carry its own title and a command to run', () => {
    store().open(shell('pwsh'), { title: 'Install', initialCommand: 'winget list' });

    expect(store().tabs[0]).toMatchObject({
      title: 'Install',
      shellId: 'pwsh',
      initialCommand: 'winget list',
    });
  });

  it('keeps the terminal on screen when another one closes', () => {
    const [first, , third] = openTabs('a', 'b', 'c');

    store().close(first!);

    expect(store().activeId).toBe(third);
  });

  it('shows the terminal that takes the place of a closed one', () => {
    const [, second, third] = openTabs('a', 'b', 'c');
    store().activate(second!);

    store().close(second!);

    expect(store().activeId).toBe(third);
  });

  it('shows the previous terminal when the last one closes', () => {
    const [, second, third] = openTabs('a', 'b', 'c');

    store().close(third!);

    expect(store().activeId).toBe(second);
  });

  it('shows nothing after the only terminal closes', () => {
    const [only] = openTabs('a');

    store().close(only!);

    expect(store()).toMatchObject({ tabs: [], activeId: null });
  });

  it('cycles through terminals and wraps around', () => {
    const [first, , third] = openTabs('a', 'b', 'c');

    store().cycle(1);
    expect(store().activeId).toBe(first);

    store().cycle(-1);
    expect(store().activeId).toBe(third);
  });

  it('renames a terminal', () => {
    const [id] = openTabs('a');

    store().rename(id!, 'Servidor');

    expect(store().tabs[0]!.title).toBe('Servidor');
  });
});

describe('projects', () => {
  it('opens new terminals inside the project on screen', () => {
    const [general] = openTabs('a');
    const web = addProject('web');
    const [inWeb] = openTabs('b');

    expect(tabsOf(store().tabs, null).map((tab) => tab.id)).toEqual([general]);
    expect(tabsOf(store().tabs, web).map((tab) => tab.id)).toEqual([inWeb]);
  });

  it('remembers which terminal each project showed', () => {
    const [general] = openTabs('a');
    const web = addProject('web');
    const [first] = openTabs('b', 'c');
    store().activate(first!);

    store().selectProject(null);
    expect(store().activeId).toBe(general);

    store().selectProject(web);
    expect(store().activeId).toBe(first);
  });

  it('cycles only within the project on screen', () => {
    openTabs('a');
    addProject('web');
    const [first, second] = openTabs('b', 'c');

    store().cycle(1);
    expect(store().activeId).toBe(first);
    store().cycle(1);
    expect(store().activeId).toBe(second);
  });

  it('switches project when a terminal of another one is opened from the list', () => {
    const [general] = openTabs('a');
    addProject('web');

    store().activate(general!);

    expect(store().activeProjectId).toBeNull();
  });

  it('closing a terminal picks a neighbour from the same project only', () => {
    openTabs('a');
    addProject('web');
    const [only] = openTabs('b');

    store().close(only!);

    expect(store().activeId).toBeNull();
    expect(store().tabs).toHaveLength(1);
  });

  it('removing a project closes its terminals and returns to the general group', () => {
    const [general] = openTabs('a');
    const web = addProject('web');
    openTabs('b', 'c');

    store().removeProject(web);

    expect(store().projects).toEqual([]);
    expect(store().tabs.map((tab) => tab.id)).toEqual([general]);
    expect(store()).toMatchObject({ activeProjectId: null, activeId: general });
  });

  it('renames a project', () => {
    const web = addProject('web');

    store().renameProject(web, 'Tienda');

    expect(store().projects[0]).toMatchObject({ name: 'Tienda', path: '/work/web' });
  });
});

describe('saved layout', () => {
  const saved: Workspace = {
    projects: [
      {
        id: 'p1',
        name: 'Web',
        path: '/work/web',
        terminals: [
          { title: 'Servidor', shell_id: 'pwsh', command: null },
          { title: 'Claude Code', shell_id: 'pwsh', command: 'claude' },
        ],
      },
    ],
  };

  it('restores projects without starting their terminals', () => {
    const [general] = openTabs('a');

    store().restore(saved);

    expect(store().projects).toEqual([{ id: 'p1', name: 'Web', path: '/work/web' }]);
    expect(tabsOf(store().tabs, 'p1').map((tab) => [tab.title, tab.started])).toEqual([
      ['Servidor', false],
      ['Claude Code', false],
    ]);
    expect(store().activeId).toBe(general);
  });

  it('starts a restored terminal only when the user opens it', () => {
    store().restore(saved);

    store().selectProject('p1');

    const [first, second] = tabsOf(store().tabs, 'p1');
    expect(first!.started).toBe(true);
    expect(second!.started).toBe(false);

    store().activate(second!.id);
    expect(tabsOf(store().tabs, 'p1')[1]!.started).toBe(true);
  });

  it('saves projects with their terminals, and what it restored comes back equal', () => {
    store().restore(saved);

    expect(toWorkspace(store())).toEqual(saved);
  });

  it('leaves out the general group and one-off terminals', () => {
    openTabs('a');
    addProject('web');
    store().open(shell('pwsh'), {
      title: 'Instalar',
      initialCommand: 'npm i -g x',
      transient: true,
    });

    expect(toWorkspace(store()).projects[0]!.terminals).toEqual([]);
  });

  it('saves when the layout changes and not when the user only switches terminals', () => {
    const save = vi.fn();
    addProject('web');
    const [first] = openTabs('a', 'b');
    const stop = persistWorkspace(save);

    store().activate(first!);
    store().cycle(1);
    store().selectProject(null);
    expect(save).not.toHaveBeenCalled();

    store().rename(first!, 'Servidor');
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]![0].projects[0].terminals[0].title).toBe('Servidor');

    stop();
    store().removeProject(store().projects[0]!.id);
    expect(save).toHaveBeenCalledTimes(1);
  });
});
