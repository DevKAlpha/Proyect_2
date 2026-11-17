/**
 * Files and pictures pasted or dropped into a terminal.
 *
 * A terminal only takes characters, so a file goes in as its path, written
 * the way the shell of that terminal reads it. Pure functions: the clipboard
 * itself is read on the Rust side.
 */
import { familyOf } from './guideData';

/** File endings of videos. They are left out of a paste for now. */
const VIDEO_ENDINGS = new Set([
  '3gp',
  'avi',
  'flv',
  'm2ts',
  'm4v',
  'mkv',
  'mov',
  'mp4',
  'mpeg',
  'mpg',
  'mts',
  'ogv',
  'webm',
  'wmv',
]);

/** Whether `path` names a video, going by its ending. */
export function isVideo(path: string): boolean {
  const name = path.slice(Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1);
  const dot = name.lastIndexOf('.');
  return dot > 0 && VIDEO_ENDINGS.has(name.slice(dot + 1).toLowerCase());
}

/**
 * Text from the clipboard as it may go into a terminal: without control
 * characters, except tab and line ends.
 *
 * A paste is wrapped in two marks so the shell takes it as text and waits
 * for Enter. Copied text that carried the closing mark itself (a web page
 * can put anything on the clipboard) would end the paste early, and the
 * rest would run as typed commands. No mark survives without its Escape.
 */
export function pastedText(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/g, '');
}

/**
 * What a paste of `text` does in a terminal, decided before it happens.
 *
 * `protectedPaste` says whether the program in the terminal asked for
 * pastes to arrive marked (bracketed paste): it then takes the whole text
 * as text and waits for Enter. Without that, every line end in the paste is
 * an Enter: each line runs the moment it lands, before the user has read
 * it. PowerShell and cmd on Windows are in that case.
 *
 * So, unprotected: the line ends at the end go away (a copied command must
 * not run by itself), and a text that still has several lines comes back
 * with `lines` above 1, for the user to confirm.
 */
export function planPaste(text: string, protectedPaste: boolean): { text: string; lines: number } {
  const clean = pastedText(text);
  if (protectedPaste) return { text: clean, lines: 1 };
  const trimmed = clean.replace(/[\r\n]+$/, '');
  return { text: trimmed, lines: trimmed.split(/\r\n|\r|\n/).length };
}

/** A Windows path as a shell inside WSL sees it: `C:\a\b` is `/mnt/c/a/b`. */
function insideWsl(path: string): string {
  const drive = /^([A-Za-z]):[\\/](.*)$/.exec(path);
  return drive ? `/mnt/${drive[1]!.toLowerCase()}/${drive[2]!.replaceAll('\\', '/')}` : path;
}

/**
 * `path` written so that the shell `shellId` reads it as one word. A path
 * of plain characters goes in bare; anything else is quoted the way that
 * shell quotes, because a space would cut the path in two and other
 * characters would be run as part of a command.
 */
export function quotePath(path: string, shellId: string): string {
  const family = familyOf(shellId);
  if (family === 'posix') {
    const local = shellId === 'wsl' ? insideWsl(path) : path;
    // A backslash is not plain here: the shell would eat it.
    if (/^[A-Za-z0-9_./][A-Za-z0-9_./-]*$/.test(local)) return local;
    return `'${local.replaceAll("'", "'\\''")}'`;
  }
  if (/^[A-Za-z0-9_./\\:][A-Za-z0-9_./\\:-]*$/.test(path)) return path;
  // Double quotes are what Windows programs expect around a path. PowerShell
  // would still read `$` and backticks inside them, and a double quote in
  // the name (possible outside Windows) would close them, so those paths
  // get its single quotes instead.
  if (family === 'powershell' && /[$`"]/.test(path)) return `'${path.replaceAll("'", "''")}'`;
  return `"${path}"`;
}

/**
 * What to type into the terminal for the files `paths`: each one quoted for
 * the shell, a space between them and one at the end, so the user can go on
 * typing. Videos are left out and counted in `skipped`.
 */
export function pathsToInput(paths: string[], shellId: string): { text: string; skipped: number } {
  const kept = paths.filter((path) => !isVideo(path));
  return {
    text: kept.map((path) => `${quotePath(path, shellId)} `).join(''),
    skipped: paths.length - kept.length,
  };
}
