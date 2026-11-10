import type { ITheme } from '@xterm/xterm';
import type { Config } from '../ipc';

/** xterm.js names for the 16 numbered colours, in the order the config uses. */
const ANSI_KEYS = [
  'black',
  'red',
  'green',
  'yellow',
  'blue',
  'magenta',
  'cyan',
  'white',
  'brightBlack',
  'brightRed',
  'brightGreen',
  'brightYellow',
  'brightBlue',
  'brightMagenta',
  'brightCyan',
  'brightWhite',
] as const;

/**
 * `colour` with the given opacity (0 to 1), as `#RRGGBBAA`. Colours that are
 * not plain `#RRGGBB` come back unchanged: the user already chose their alpha.
 */
export function withOpacity(colour: string, opacity: number): string {
  if (!/^#[0-9a-f]{6}$/i.test(colour)) return colour;
  const clamped = Math.min(1, Math.max(0, opacity));
  return (
    colour +
    Math.round(clamped * 255)
      .toString(16)
      .padStart(2, '0')
  );
}

/**
 * The colours xterm.js draws with.
 *
 * With `seeThrough`, the background lets the picture behind the terminal
 * show: `background.dim` is how much of the colour stays on top of it.
 */
export function terminalTheme(config: Config, seeThrough: boolean): ITheme {
  const { theme, background } = config;
  const colours: ITheme = {
    background: seeThrough ? withOpacity(theme.background, background.dim) : theme.background,
    foreground: theme.foreground,
    cursor: theme.cursor,
    selectionBackground: theme.selection,
  };
  ANSI_KEYS.forEach((key, index) => {
    const colour = theme.ansi[index];
    if (colour) colours[key] = colour;
  });
  return colours;
}

/** MIME type of a background image, from the extension of its path. */
export function imageType(path: string): string {
  const extension = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  if (extension === 'jpg') return 'image/jpeg';
  return `image/${extension}`;
}
