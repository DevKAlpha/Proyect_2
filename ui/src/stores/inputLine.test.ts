import { describe, expect, it } from 'vitest';
import {
  deleteKeys,
  moveFocus,
  rangeOfSelection,
  readInputLine,
  replaceKeys,
  spanOf,
  suggest,
  type BufferLike,
  type Cell,
} from './inputLine';

const COLS = 10;

/**
 * A fake screen. Each row is a string padded to the width; a row starting
 * with `~` is a continuation of the row above (the text wrapped onto it).
 * Characters listed in `dim` are drawn dim; those in `grey`, in the grey
 * numbered 8.
 */
function screen(rows: string[], dim: Cell[] = [], grey: Cell[] = []): BufferLike {
  const among = (cells: Cell[], x: number, y: number) =>
    cells.some((cell) => cell.x === x && cell.y === y);
  return {
    getLine(y) {
      const raw = rows[y];
      if (raw === undefined) return undefined;
      const isWrapped = raw.startsWith('~');
      const chars = [...(isWrapped ? raw.slice(1) : raw).padEnd(COLS, ' ')];
      return {
        isWrapped,
        getCell: (x) =>
          x < chars.length
            ? {
                getChars: () => (chars[x] === ' ' ? '' : chars[x]!),
                getWidth: () => 1,
                isDim: () => (among(dim, x, y) ? 1 : 0),
                isFgPalette: () => among(grey, x, y),
                getFgColor: () => (among(grey, x, y) ? 8 : 0),
              }
            : undefined,
      };
    },
  };
}

const at = (x: number, y: number): Cell => ({ x, y });

describe('readInputLine', () => {
  it('reads what was typed after the prompt', () => {
    const line = readInputLine(screen(['$ git st']), at(2, 0), at(8, 0), COLS)!;

    expect(line.text).toBe('git st');
    expect(line.cursor).toBe(6);
    expect(line.cells[0]).toEqual(at(2, 0));
    expect(line.cells[6]).toEqual(at(8, 0));
  });

  it('is empty right after the prompt', () => {
    const line = readInputLine(screen(['$ ']), at(2, 0), at(2, 0), COLS)!;

    expect(line).toMatchObject({ text: '', cursor: 0, cells: [at(2, 0)] });
  });

  it('knows where the cursor is inside the text', () => {
    const line = readInputLine(screen(['$ abcdef']), at(2, 0), at(4, 0), COLS)!;

    expect(line.text).toBe('abcdef');
    expect(line.cursor).toBe(2);
  });

  it('keeps a space typed at the end, which is not empty screen', () => {
    const line = readInputLine(screen(['$ git ']), at(2, 0), at(6, 0), COLS)!;

    expect(line.text).toBe('git ');
  });

  it('follows the text onto the rows it wraps to', () => {
    const line = readInputLine(screen(['$ 12345678', '~abcd']), at(2, 0), at(4, 1), COLS)!;

    expect(line.text).toBe('12345678abcd');
    expect(line.cursor).toBe(12);
    expect(line.cells[8]).toEqual(at(0, 1));
  });

  it('stops at a row that is not a continuation', () => {
    const line = readInputLine(screen(['$ ab', 'output']), at(2, 0), at(4, 0), COLS)!;

    expect(line.text).toBe('ab');
  });

  it('leaves out a dim hint the shell draws after the cursor', () => {
    const dim = [at(5, 0), at(6, 0), at(7, 0)];
    const line = readInputLine(screen(['$ gitlog', '']), at(2, 0), at(5, 0), COLS)!;
    const hinted = readInputLine(screen(['$ gitlog', ''], dim), at(2, 0), at(5, 0), COLS)!;

    expect(line.text).toBe('gitlog');
    expect(hinted.text).toBe('git');
    expect(hinted.cursor).toBe(3);
    expect(hinted.shellHint).toBe(true);
    expect(line.shellHint).toBe(false);
  });

  it('leaves out a grey hint the shell draws after the cursor', () => {
    // zsh with its suggestions plugin draws them in grey, not dim.
    const grey = [at(5, 0), at(6, 0), at(7, 0)];
    const hinted = readInputLine(screen(['$ gitlog', ''], [], grey), at(2, 0), at(5, 0), COLS)!;

    expect(hinted.text).toBe('git');
  });

  it('keeps grey text the user typed before the cursor', () => {
    const grey = [at(2, 0), at(3, 0), at(4, 0)];
    const line = readInputLine(screen(['$ # ok', ''], [], grey), at(2, 0), at(6, 0), COLS)!;

    expect(line.text).toBe('# ok');
  });

  it('cannot be trusted when the cursor is on a row that is not part of it', () => {
    expect(readInputLine(screen(['$ ab', '>> c']), at(2, 0), at(4, 1), COLS)).toBeNull();
    expect(readInputLine(screen(['out', '$ ab']), at(2, 1), at(1, 0), COLS)).toBeNull();
  });

  it('counts an emoji as one character', () => {
    const line = readInputLine(screen(['$ a🚀b']), at(2, 0), at(5, 0), COLS)!;

    expect(line.chars).toEqual(['a', '🚀', 'b']);
    expect(line.cursor).toBe(3);
  });
});

describe('rangeOfSelection', () => {
  const line = readInputLine(screen(['$ abcdef']), at(2, 0), at(8, 0), COLS)!;

  it('maps a selection inside the line to its characters', () => {
    expect(rangeOfSelection(line, at(4, 0), at(7, 0))).toEqual({ from: 2, to: 5 });
  });

  it('cuts a selection that starts in the prompt or above', () => {
    expect(rangeOfSelection(line, at(0, 0), at(4, 0))).toEqual({ from: 0, to: 2 });
  });

  it('cuts a selection that runs past the end of the text', () => {
    expect(rangeOfSelection(line, at(6, 0), at(3, 4))).toEqual({ from: 4, to: 6 });
  });

  it('is nothing when the selection does not touch the line', () => {
    const below = readInputLine(screen(['output', '$ abcdef']), at(2, 1), at(8, 1), COLS)!;

    expect(rangeOfSelection(below, at(0, 0), at(6, 0))).toBeNull();
    expect(rangeOfSelection(line, at(8, 0), at(9, 3))).toBeNull();
  });

  it('covers several rows of a wrapped line', () => {
    const wrapped = readInputLine(screen(['$ 12345678', '~abcd']), at(2, 0), at(4, 1), COLS)!;

    expect(rangeOfSelection(wrapped, at(8, 0), at(2, 1))).toEqual({ from: 6, to: 10 });
  });
});

describe('moveFocus', () => {
  const line = readInputLine(screen(['$ 12345678', '~abcd']), at(2, 0), at(4, 1), COLS)!;

  it('moves by one character and stops at the ends', () => {
    expect(moveFocus(line, 5, 'left')).toBe(4);
    expect(moveFocus(line, 5, 'right')).toBe(6);
    expect(moveFocus(line, 0, 'left')).toBe(0);
    expect(moveFocus(line, 12, 'right')).toBe(12);
  });

  it('jumps to the ends of the line', () => {
    expect(moveFocus(line, 5, 'home')).toBe(0);
    expect(moveFocus(line, 5, 'end')).toBe(12);
  });

  it('moves by rows on a line that wraps, keeping the column', () => {
    // Index 10 is "c", column 2 of the second row. Above it is "1", column 2.
    expect(moveFocus(line, 10, 'up')).toBe(0);
    // Index 1 is "2", column 3. Below it is "d", column 3.
    expect(moveFocus(line, 1, 'down')).toBe(11);
  });

  it('goes to the end of the line when there is no row to move to', () => {
    expect(moveFocus(line, 3, 'up')).toBe(0);
    expect(moveFocus(line, 9, 'down')).toBe(12);
    // Column 8 does not exist on the second row: nearest is the end.
    expect(moveFocus(line, 6, 'down')).toBe(12);
  });
});

describe('spanOf', () => {
  it('describes a range on one row', () => {
    const line = readInputLine(screen(['$ abcdef']), at(2, 0), at(8, 0), COLS)!;

    expect(spanOf(line, { from: 2, to: 5 }, COLS)).toEqual({ x: 4, y: 0, length: 3 });
  });

  it('counts across rows of a wrapped line', () => {
    const line = readInputLine(screen(['$ 12345678', '~abcd']), at(2, 0), at(4, 1), COLS)!;

    expect(spanOf(line, { from: 6, to: 10 }, COLS)).toEqual({ x: 8, y: 0, length: 4 });
  });
});

describe('deleteKeys', () => {
  const right = '\x1b[C';
  const left = '\x1b[D';
  const backspace = '\x7f';

  it('walks right to the end of the range, then backspaces over it', () => {
    expect(deleteKeys(1, { from: 2, to: 5 }, false)).toBe(right.repeat(4) + backspace.repeat(3));
  });

  it('walks left when the cursor is beyond the range', () => {
    expect(deleteKeys(6, { from: 2, to: 5 }, false)).toBe(left + backspace.repeat(3));
  });

  it('only backspaces when the cursor already ends the range', () => {
    expect(deleteKeys(5, { from: 2, to: 5 }, false)).toBe(backspace.repeat(3));
  });

  it('uses the other form of the arrows when the terminal is in that mode', () => {
    expect(deleteKeys(4, { from: 2, to: 5 }, true)).toBe('\x1bOC' + backspace.repeat(3));
  });
});

describe('replaceKeys', () => {
  const right = '\x1b[C';
  const left = '\x1b[D';
  const backspace = '\x7f';

  it('takes a cursor that was after the range back to the same character', () => {
    // `gti --version` with the cursor at the end: fix the first word, return to the end.
    expect(replaceKeys(13, { from: 0, to: 3 }, 'git', false)).toBe(
      left.repeat(10) + backspace.repeat(3) + 'git' + right.repeat(10),
    );
  });

  it('counts the change of length when it goes back', () => {
    expect(replaceKeys(6, { from: 0, to: 2 }, 'dir', false)).toBe(
      left.repeat(4) + backspace.repeat(2) + 'dir' + right.repeat(4),
    );
  });

  it('stays after the new text when the range ended at the cursor', () => {
    expect(replaceKeys(6, { from: 0, to: 6 }, 'ls -Force', false)).toBe(
      backspace.repeat(6) + 'ls -Force',
    );
  });

  it('returns to a cursor that was before the range', () => {
    expect(replaceKeys(0, { from: 2, to: 4 }, 'abc', false)).toBe(
      right.repeat(4) + backspace.repeat(2) + 'abc' + left.repeat(5),
    );
  });
});

describe('suggest', () => {
  const history = ['git status', 'npm test', 'git stash', 'git push'];

  it('completes with the most recent command that starts the same', () => {
    expect(suggest(history, 'git st')).toBe('ash');
    expect(suggest(history, 'git')).toBe(' push');
    expect(suggest(history, 'n')).toBe('pm test');
  });

  it('has nothing for a command typed in full or never used', () => {
    expect(suggest(history, 'npm test')).toBeNull();
    expect(suggest(history, 'docker')).toBeNull();
  });

  it('has nothing before the user types', () => {
    expect(suggest(history, '')).toBeNull();
    expect(suggest(history, '   ')).toBeNull();
  });

  it('respects upper and lower case, because the rest is typed as it is', () => {
    expect(suggest(history, 'GIT')).toBeNull();
  });
});
