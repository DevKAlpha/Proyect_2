import { beforeEach, describe, expect, it } from 'vitest';
import type { ShellProfile } from '../ipc';
import { useTabs } from './tabs';

const shell = (id: string): ShellProfile => ({ id, name: id.toUpperCase(), program: id, args: [] });

/** Opens one tab per shell id and returns the tab ids in order. */
function openTabs(...shellIds: string[]) {
  for (const id of shellIds) useTabs.getState().open(shell(id));
  return useTabs.getState().tabs.map((tab) => tab.id);
}

beforeEach(() => useTabs.setState({ tabs: [], activeId: null }));

describe('tabs store', () => {
  it('opens a tab named after its shell and activates it', () => {
    const [first, second] = openTabs('pwsh', 'bash');

    const { tabs, activeId } = useTabs.getState();
    expect(tabs.map((tab) => tab.title)).toEqual(['PWSH', 'BASH']);
    expect(first).not.toBe(second);
    expect(activeId).toBe(second);
  });

  it('lets a tab carry its own title and a command to run', () => {
    useTabs.getState().open(shell('pwsh'), { title: 'Install', initialCommand: 'winget list' });

    expect(useTabs.getState().tabs[0]).toMatchObject({
      title: 'Install',
      shellId: 'pwsh',
      initialCommand: 'winget list',
    });
  });

  it('keeps the active tab when another one closes', () => {
    const [first, , third] = openTabs('a', 'b', 'c');

    useTabs.getState().close(first!);

    expect(useTabs.getState().activeId).toBe(third);
  });

  it('activates the tab that takes the place of a closed active tab', () => {
    const [, second, third] = openTabs('a', 'b', 'c');
    useTabs.getState().activate(second!);

    useTabs.getState().close(second!);

    expect(useTabs.getState().activeId).toBe(third);
  });

  it('activates the previous tab when the last one closes', () => {
    const [, second, third] = openTabs('a', 'b', 'c');

    useTabs.getState().close(third!);

    expect(useTabs.getState().activeId).toBe(second);
  });

  it('has no active tab after the only one closes', () => {
    const [only] = openTabs('a');

    useTabs.getState().close(only!);

    expect(useTabs.getState()).toMatchObject({ tabs: [], activeId: null });
  });

  it('cycles through tabs and wraps around', () => {
    const [first, , third] = openTabs('a', 'b', 'c');

    useTabs.getState().cycle(1);
    expect(useTabs.getState().activeId).toBe(first);

    useTabs.getState().cycle(-1);
    expect(useTabs.getState().activeId).toBe(third);
  });
});
