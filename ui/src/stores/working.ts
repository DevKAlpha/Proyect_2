/**
 * The duck that swims while a command runs.
 *
 * A command that takes a while leaves the screen still, and a still screen
 * looks stuck. So the line under the terminal shows a small duck paddling
 * on moving water, a word for what it is doing and the time gone by, until
 * the shell shows its prompt again. Pure functions: the component only
 * draws and counts.
 */

/** A command that ends before this never shows the duck: it would only flash. */
export const WORKING_DELAY_MS = 1000;
/** Time between two frames of the duck. */
export const FRAME_MS = 140;

/**
 * Programs that talk with the user instead of working on their own: an
 * editor, a pager, an AI agent, a remote shell. While one of them runs, the
 * terminal is not waiting for anything, so the duck stays away.
 */
const INTERACTIVE = new Set([
  'aider',
  'btop',
  'claude',
  'codex',
  'copilot',
  'emacs',
  'gemini',
  'htop',
  'less',
  'man',
  'more',
  'mosh',
  'nano',
  'nvim',
  'opencode',
  'sftp',
  'ssh',
  'telnet',
  'top',
  'vi',
  'vim',
]);

/** Shells and language consoles: interactive when started without arguments. */
const CONSOLES = new Set([
  'bash',
  'cmd',
  'fish',
  'ghci',
  'irb',
  'mongosh',
  'mysql',
  'node',
  'powershell',
  'psql',
  'pwsh',
  'python',
  'python3',
  'redis-cli',
  'sh',
  'sqlite3',
  'wsl',
  'zsh',
]);

/** Whether the duck should swim while `command` runs. */
export function showsWorking(command: string): boolean {
  const words = command.trim().split(/\s+/);
  // `C:\Tools\vim.exe` and `./vim` are vim too.
  const program = (words[0] ?? '')
    .replace(/^.*[\\/]/, '')
    .replace(/\.(exe|cmd|bat|ps1)$/i, '')
    .toLowerCase();
  if (!program || INTERACTIVE.has(program)) return false;
  if (CONSOLES.has(program) && words.length === 1) return false;
  // `docker run -it`, `docker exec -it`: a shell inside a container.
  const flags = words.slice(1);
  const attached = flags.some(
    (flag) => /^-[a-z]*(it|ti)[a-z]*$/i.test(flag) || flag === '--interactive',
  );
  return !(program === 'docker' && attached);
}

/** What the duck is doing: one word per command, picked by when it started. */
export const VERBS = [
  'Remando',
  'Chapoteando',
  'Nadando',
  'Graznando',
  'Aleteando',
  'Buceando',
  'Flotando',
  'Contoneándose',
];

export function verbFor(since: number): string {
  return VERBS[Math.floor(since / 1000) % VERBS.length]!;
}

/** Time gone by, the way people say it: `12 s`, `1 min 05 s`, `1 h 02 min`. */
export function elapsedLabel(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ${String(seconds % 60).padStart(2, '0')} s`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;
}

/**
 * The duck, small enough for the line under the terminal: 8 rows of dots.
 * The marks are those of the banner duck (`stores/banner`), so it takes the
 * same colours.
 */
const SWIMMER = [
  '....WWW....',
  '....BBB....',
  '...WWWWW...',
  '....YYYY...',
  '....YKYYOO.',
  'Y..YYYYY...',
  'YYYYYYYYYY.',
  '.YYYDDYYY..',
];

/** Width of the picture, water included. */
export const WORKING_WIDTH = 15;
/** Height of the picture: the duck, one row it bobs down by, and the water. */
export const WORKING_HEIGHT = SWIMMER.length + 2;
/** The waves, repeated along the row and moved one dot per frame. */
const WAVE = 'AAAA..';
const CREST = '.A....';
/** Frames the duck stays up, then down: one bob. */
const BOB = 3;

/**
 * Frame `tick` of the swimming duck, as rows of marks. The water moves left
 * one dot each frame, so the duck seems to swim right, and the duck bobs
 * down into the water and up again.
 */
export function workingFrame(tick: number): string[] {
  const down = Math.floor(tick / BOB) % 2 === 1 ? 1 : 0;
  const rows = Array.from({ length: WORKING_HEIGHT }, () => '.'.repeat(WORKING_WIDTH).split(''));
  SWIMMER.forEach((line, y) => {
    [...line].forEach((mark, x) => {
      if (mark !== '.') rows[y + down]![x + 2] = mark;
    });
  });
  const wave = (pattern: string, row: number) => {
    for (let x = 0; x < WORKING_WIDTH; x++) {
      if (pattern[(x + tick) % pattern.length] === 'A') rows[row]![x] = 'A';
    }
  };
  // The crests go over the duck: that is what makes it look in the water.
  wave(CREST, WORKING_HEIGHT - 2);
  wave(WAVE, WORKING_HEIGHT - 1);
  return rows.map((row) => row.join(''));
}
