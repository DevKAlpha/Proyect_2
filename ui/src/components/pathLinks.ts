import type { IBufferLine, IDisposable, ILink, Terminal } from '@xterm/xterm';
import { findPaths } from '../stores/pathLinks';

export interface PathLinksOptions {
  /** Asks which of these pieces of text are paths that exist. */
  exist: (paths: string[]) => Promise<boolean[]>;
  /** Shows a path in the file manager of the system. */
  reveal: (path: string) => void;
}

/**
 * The text of a row and, for each of its characters, the column it is drawn
 * in. They differ as soon as the row has a wide character or an emoji.
 */
function rowText(line: IBufferLine, cols: number) {
  let text = '';
  /** `[first column, last column]` of the cell each character belongs to. */
  const columns: [number, number][] = [];
  for (let x = 0; x < cols; x++) {
    const cell = line.getCell(x);
    if (!cell) break;
    // Second half of a wide character: the character sits in the cell before.
    if (cell.getWidth() === 0) continue;
    const chars = cell.getChars() || ' ';
    text += chars;
    for (let unit = 0; unit < chars.length; unit++) {
      columns.push([x, x + cell.getWidth() - 1]);
    }
  }
  return { text, columns };
}

/**
 * Makes the paths printed in a terminal clickable: Ctrl+click shows the file
 * or folder in the file manager. Only paths that exist become links, so the
 * disk is asked once per row the pointer rests on.
 *
 * A path is looked for within one row: one that wraps onto the next row is
 * not found.
 */
export function attachPathLinks(term: Terminal, options: PathLinksOptions): IDisposable {
  return term.registerLinkProvider({
    provideLinks(y, callback) {
      const line = term.buffer.active.getLine(y - 1);
      if (!line) return callback(undefined);
      const { text, columns } = rowText(line, term.cols);
      const found = findPaths(text);
      if (found.length === 0) return callback(undefined);

      options
        .exist(found.map((candidate) => candidate.path))
        .then((exists) => {
          const links = found
            .filter((_, index) => exists[index])
            .map((candidate): ILink => ({
              // xterm.js counts columns and rows from 1, both ends included.
              range: {
                start: { x: columns[candidate.start]![0] + 1, y },
                end: { x: columns[candidate.end - 1]![1] + 1, y },
              },
              text: candidate.path,
              // Ctrl (or Cmd) must be held, as for web links: a plain click
              // is how text is selected.
              activate: (event, path) => {
                if (event.ctrlKey || event.metaKey) options.reveal(path);
              },
            }));
          callback(links.length > 0 ? links : undefined);
        })
        // No answer: the row has no links, and the terminal works the same.
        .catch(() => callback(undefined));
    },
  });
}
