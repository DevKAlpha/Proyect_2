import { describe, expect, it } from 'vitest';
import { SHORTCUT_GROUPS, matchShortcut, type KeyLike } from './shortcuts';

/** A key press: `ctrl+shift+t`, `f1`, `ctrl+1`. */
function press(combo: string): KeyLike {
  const parts = combo.split('+');
  // "ctrl++" ends in an empty part: the key is the plus sign itself.
  const key = parts[parts.length - 1] === '' ? '+' : parts[parts.length - 1]!;
  const held = new Set(parts.slice(0, -1));
  return {
    key,
    ctrlKey: held.has('ctrl'),
    shiftKey: held.has('shift'),
    altKey: held.has('alt'),
    metaKey: held.has('meta'),
  };
}

const id = (combo: string) => matchShortcut(press(combo))?.id ?? null;

describe('matchShortcut', () => {
  it('recognises the Ctrl+Shift+letter shortcuts in any case', () => {
    expect(id('ctrl+shift+T')).toBe('new-tab');
    expect(id('ctrl+shift+t')).toBe('new-tab');
    expect(id('ctrl+shift+W')).toBe('close-tab');
    expect(id('ctrl+shift+B')).toBe('toggle-sidebar');
    expect(id('ctrl+shift+D')).toBe('toggle-split');
    expect(id('ctrl+shift+E')).toBe('other-half');
    expect(id('ctrl+shift+P')).toBe('templates-menu');
    expect(id('ctrl+shift+R')).toBe('remote-menu');
  });

  it('moves between terminals and projects', () => {
    expect(id('ctrl+Tab')).toBe('next-tab');
    expect(id('ctrl+shift+Tab')).toBe('previous-tab');
    expect(id('ctrl+shift+ArrowDown')).toBe('next-project');
    expect(id('ctrl+shift+ArrowUp')).toBe('previous-project');
  });

  it('goes to a terminal by its number, counted from 1', () => {
    expect(matchShortcut(press('ctrl+1'))).toEqual({ id: 'go-to-tab', index: 0 });
    expect(matchShortcut(press('ctrl+9'))).toEqual({ id: 'go-to-tab', index: 8 });
  });

  it('keeps the zoom keys as they were', () => {
    expect(id('ctrl++')).toBe('zoom-in');
    expect(id('ctrl+shift++')).toBe('zoom-in');
    expect(id('ctrl+=')).toBe('zoom-in');
    expect(id('ctrl+-')).toBe('zoom-out');
    expect(id('ctrl+0')).toBe('zoom-reset');
  });

  it('gives the arrows to the half that should grow', () => {
    expect(id('ctrl+shift+ArrowRight')).toBe('grow-left');
    expect(id('ctrl+shift+ArrowLeft')).toBe('grow-right');
  });

  it('has two keys that need nothing held', () => {
    expect(id('F1')).toBe('help');
    expect(id('F11')).toBe('fullscreen');
  });

  it('leaves to the shell every key that is its own', () => {
    for (const combo of [
      'a',
      'Enter',
      'Tab',
      'ArrowUp',
      'ctrl+c',
      'ctrl+r',
      'ctrl+d',
      'ctrl+ArrowLeft',
      'shift+ArrowLeft',
      'shift+F1',
      'ctrl+shift+c',
      'ctrl+shift+v',
      'ctrl+shift+1',
    ]) {
      expect(id(combo), combo).toBeNull();
    }
  });

  it('never uses Alt or the system key', () => {
    expect(id('ctrl+alt+shift+T')).toBeNull();
    expect(id('alt+F1')).toBeNull();
    expect(id('meta+ctrl+1')).toBeNull();
    expect(id('alt+ArrowLeft')).toBeNull();
  });
});

describe('the help panel', () => {
  it('lists every shortcut once', () => {
    const keys = SHORTCUT_GROUPS.flatMap((group) => group.shortcuts.map((one) => one.keys));

    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.length).toBeGreaterThan(20);
  });

  it('lists a key for every Ctrl+Shift+letter the app takes', () => {
    const listed = SHORTCUT_GROUPS.flatMap((group) => group.shortcuts.map((one) => one.keys)).join(
      ' ',
    );
    for (const letter of 'TMWNBDEPSFOR') {
      expect(id(`ctrl+shift+${letter}`), letter).not.toBeNull();
      expect(listed, letter).toContain(`Ctrl+Shift+${letter}`);
    }
  });
});
