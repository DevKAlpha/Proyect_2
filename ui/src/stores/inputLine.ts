/**
 * The command line the user is typing, read from the terminal screen.
 *
 * The shell owns the line: it echoes, wraps and redraws it. The terminal
 * only knows where the line starts (the shell marks the end of its prompt)
 * and where the cursor is. Everything here is worked out from the characters
 * on screen between those two points. Pure functions, no terminal needed.
 */

/** A position on the terminal screen: column and absolute row, both from 0. */
export interface Cell {
  x: number;
  y: number;
}

/** The parts of the xterm.js buffer this module reads. */
export interface CellLike {
  getChars(): string;
  getWidth(): number;
  isDim(): number;
}
export interface LineLike {
  readonly isWrapped: boolean;
  getCell(x: number): CellLike | undefined;
}
export interface BufferLike {
  getLine(y: number): LineLike | undefined;
}

export interface InputLine {
  /** One entry per character on screen. A character can be several code units (emoji). */
  chars: string[];
  /** `chars` joined. */
  text: string;
  /** Index in `chars` of the character under the cursor; `chars.length` at the end. */
  cursor: number;
  /**
   * Where each character is drawn, plus one last entry: the position right
   * after the text. Always `chars.length + 1` entries.
   */
  cells: Cell[];
}

/** A stretch of the line, as indexes into `chars`: from `from` up to, not including, `to`. */
export interface Range {
  from: number;
  to: number;
}

/** Reading order: negative when `a` comes before `b`. */
const compare = (a: Cell, b: Cell) => a.y - b.y || a.x - b.x;

/**
 * Reads the line that starts at `start` (where the prompt ended).
 *
 * The line covers its first row and the rows it wrapped onto. Returns `null`
 * when the cursor is not on those rows: the shell is then showing something
 * else (a continuation prompt, a completion menu) and the line cannot be
 * trusted.
 */
export function readInputLine(
  buffer: BufferLike,
  start: Cell,
  cursor: Cell,
  cols: number,
): InputLine | null {
  const drawn: (Cell & { char: string; dim: boolean })[] = [];
  let lastRow = start.y;
  for (let y = start.y; ; y++) {
    const line = buffer.getLine(y);
    // Rows after the first belong to the line only if it wrapped onto them.
    if (!line || (y > start.y && !line.isWrapped)) break;
    lastRow = y;
    for (let x = y === start.y ? start.x : 0; x < cols; x++) {
      const cell = line.getCell(x);
      if (!cell) break;
      // Second half of a wide character: the character sits in the cell before.
      if (cell.getWidth() === 0) continue;
      drawn.push({ x, y, char: cell.getChars() || ' ', dim: cell.isDim() !== 0 });
    }
  }
  if (compare(cursor, start) < 0 || cursor.y > lastRow) return null;

  const atCursor = drawn.findIndex((cell) => compare(cell, cursor) >= 0);
  const cursorIndex = atCursor === -1 ? drawn.length : atCursor;

  // The text ends at its last real character. Blanks after it are empty
  // screen. Dim text after the cursor is a hint drawn by the shell itself
  // (PowerShell predictions), not something the user typed.
  let end = cursorIndex;
  for (let index = drawn.length - 1; index >= cursorIndex; index--) {
    const cell = drawn[index]!;
    if (cell.char !== ' ' && !cell.dim) {
      end = index + 1;
      break;
    }
  }

  const typed = drawn.slice(0, end);
  const after = drawn[end] ?? positionAfter(typed[typed.length - 1], start, cols);
  const chars = typed.map((cell) => cell.char);
  return {
    chars,
    text: chars.join(''),
    cursor: cursorIndex,
    cells: [...typed.map(({ x, y }) => ({ x, y })), { x: after.x, y: after.y }],
  };
}

/** The cell that follows `last`, on the next row when the row is full. */
function positionAfter(last: Cell | undefined, start: Cell, cols: number): Cell {
  if (!last) return start;
  return last.x + 1 >= cols ? { x: 0, y: last.y + 1 } : { x: last.x + 1, y: last.y };
}

/**
 * The part of the line covered by a selection on screen, from `start` up to,
 * not including, `end`. A selection that also covers output above or space
 * below is cut to the line. Returns `null` when it does not touch the line.
 */
export function rangeOfSelection(line: InputLine, start: Cell, end: Cell): Range | null {
  const indexOf = (position: Cell) => {
    const index = line.cells.findIndex((cell) => compare(cell, position) >= 0);
    return index === -1 ? line.chars.length : index;
  };
  const from = indexOf(start);
  const to = indexOf(end);
  return from < to ? { from, to } : null;
}

export type Move = 'left' | 'right' | 'up' | 'down' | 'home' | 'end';

/**
 * Where the moving end of a keyboard selection goes. Left and right move one
 * character; up and down one row of a line that wraps; home and end jump to
 * the ends of the line.
 */
export function moveFocus(line: InputLine, focus: number, move: Move): number {
  const last = line.chars.length;
  if (move === 'left') return Math.max(0, focus - 1);
  if (move === 'right') return Math.min(last, focus + 1);
  if (move === 'home') return 0;
  if (move === 'end') return last;

  const from = line.cells[focus]!;
  const row = from.y + (move === 'up' ? -1 : 1);
  if (row < line.cells[0]!.y) return 0;
  if (row > line.cells[last]!.y) return last;
  // Same column on the other row, or the nearest character that row has.
  const sameColumn = line.cells.findIndex((cell) => cell.y === row && cell.x >= from.x);
  if (sameColumn !== -1) return sameColumn;
  return move === 'up' ? 0 : last;
}

/** The screen area of a range, in the shape xterm.js selects text with. */
export function spanOf(line: InputLine, range: Range, cols: number) {
  const first = line.cells[range.from]!;
  const afterLast = line.cells[range.to]!;
  return {
    x: first.x,
    y: first.y,
    length: (afterLast.y - first.y) * cols + (afterLast.x - first.x),
  };
}

/**
 * The keys that delete `range` in the shell: arrows to put the shell's
 * cursor right after the range, then one backspace per character. Every
 * shell understands these, so no shell has to know about selections.
 *
 * `applicationCursor` is the terminal mode in which arrow keys are sent in
 * their other form.
 */
export function deleteKeys(cursor: number, range: Range, applicationCursor: boolean): string {
  const arrow = (letter: string) => (applicationCursor ? `\x1bO${letter}` : `\x1b[${letter}`);
  const distance = range.to - cursor;
  const moves = (distance >= 0 ? arrow('C') : arrow('D')).repeat(Math.abs(distance));
  return moves + '\x7f'.repeat(range.to - range.from);
}

/**
 * What to add to `typed` to complete the most recent earlier command that
 * starts with it. `history` is oldest first. Returns `null` when nothing
 * fits or nothing meaningful has been typed.
 */
export function suggest(history: string[], typed: string): string | null {
  if (!typed.trim()) return null;
  for (let index = history.length - 1; index >= 0; index--) {
    const command = history[index]!;
    if (command.length > typed.length && command.startsWith(typed)) {
      return command.slice(typed.length);
    }
  }
  return null;
}
