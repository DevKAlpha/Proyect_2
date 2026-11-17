/**
 * Finding paths in a line of terminal output, so they can be clicked.
 *
 * This only picks out pieces of text that *could* be a path. Whether one
 * exists is asked of the Rust side, and only those become links: most words
 * with a dot or a slash in them (`v1.2`, `and/or`) are not files.
 */

/** A piece of a line that may be a path. */
export interface PathCandidate {
  /** Where it is in the line: from `start` up to, not including, `end`. */
  start: number;
  end: number;
  /** The path alone, without quotes or a line number after it. */
  path: string;
}

/** Longer than any real path; a longer word is not looked at. */
const MAX_PATH = 300;

/** Web addresses, which have their own links. `file://` is a path and stays. */
const WEB_ADDRESS = /\b(?!file:)[a-z][a-z0-9+.-]*:\/\/\S+/gi;

/** A path in quotes: the only way to write one with spaces in it. */
const QUOTED = /(["'])([^"']*[\\/][^"']*)\1/g;

/** Characters that wrap a path in a sentence without being part of it. */
const OPENING = /^[([{<"'`]+/;
const CLOSING = /[)\]}>"'`,;:.!?]+$/;

/** `:12` or `:12:5` after a file: the line and column compilers print. */
const POSITION = /:\d+(?::\d+)?$/;

/** Whether a word has the shape of a path. */
function looksLikePath(word: string): boolean {
  if (word.length < 2 || word.length > MAX_PATH) return false;
  // Never part of a file name on Windows, and almost never anywhere else.
  if (/[*?<>|"]/.test(word)) return false;
  // Numbers with dots and slashes: versions, dates, fractions.
  if (/^[\d./\\:-]+$/.test(word)) return false;
  if (/[\\/]/.test(word) || word.startsWith('~')) return true;
  // A file name by itself: `README.md`, `package.json`.
  return /^[\w@+-][\w@+.-]*\.[A-Za-z0-9]{1,8}$/.test(word);
}

/**
 * The pieces of `line` that may be paths, in the order they appear. A line
 * and column after a file (`src/app.ts:12:5`) is part of the piece on
 * screen, not of the path.
 */
export function findPaths(line: string): PathCandidate[] {
  // Same length as the line, so positions still match.
  let rest = line.replace(WEB_ADDRESS, (address) => ' '.repeat(address.length));
  const found: PathCandidate[] = [];

  for (const match of rest.matchAll(QUOTED)) {
    const path = match[2]!;
    if (path.trim() !== path || !looksLikePath(path.replaceAll(' ', '_'))) continue;
    const start = match.index + 1;
    found.push({ start, end: start + path.length, path });
  }
  // What was in quotes is settled: its words are not looked at again.
  for (const { start, end } of found) {
    rest = rest.slice(0, start - 1) + ' '.repeat(end - start + 2) + rest.slice(end + 1);
  }

  for (const match of rest.matchAll(/\S+/g)) {
    const opening = OPENING.exec(match[0])?.[0].length ?? 0;
    const word = match[0].slice(opening).replace(CLOSING, '');
    const path = word.replace(POSITION, '');
    if (!looksLikePath(path)) continue;
    const start = match.index + opening;
    found.push({ start, end: start + word.length, path });
  }
  return found.sort((a, b) => a.start - b.start);
}
