/**
 * The banner of the app: pictures made of square dots, like the block
 * characters of a terminal.
 *
 * The dots are drawn as shapes, not as characters of a font. That is what
 * terminals do with block characters too: a font leaves hairlines between
 * its blocks, different in every font and at every screen scale, and a
 * picture made of them looks cut into pieces. Pure functions: the component
 * only colours what comes out of here.
 */

/** Letters of the name, 6 dots wide and 8 tall, with thick strokes. */
const LETTERS: Record<string, string[]> = {
  T: ['######', '######', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..'],
  E: ['######', '######', '##....', '#####.', '#####.', '##....', '######', '######'],
  R: ['#####.', '######', '##..##', '#####.', '####..', '##.##.', '##..##', '##..##'],
  M: ['#....#', '##..##', '######', '######', '##..##', '##..##', '##..##', '##..##'],
  I: ['######', '######', '..##..', '..##..', '..##..', '..##..', '######', '######'],
  N: ['##..##', '###.##', '###.##', '######', '##.###', '##.###', '##..##', '##..##'],
  A: ['.####.', '######', '##..##', '##..##', '######', '######', '##..##', '##..##'],
  L: ['##....', '##....', '##....', '##....', '##....', '##....', '######', '######'],
  D: ['#####.', '######', '##..##', '##..##', '##..##', '##..##', '######', '#####.'],
  U: ['##..##', '##..##', '##..##', '##..##', '##..##', '##..##', '######', '.####.'],
  C: ['.#####', '######', '##....', '##....', '##....', '##....', '######', '.#####'],
  K: ['##..##', '##.##.', '####..', '###...', '###...', '####..', '##.##.', '##..##'],
  _: ['......', '......', '......', '......', '......', '......', '######', '######'],
};

/**
 * The duck: a rubber duck that looks right, under a white top hat.
 * `W` hat, `S` its shaded side, `B` its band, `Y` body, `H` shine, `D`
 * shade, `O` beak, `P` its lower half, `K` eye, `E` the glint in it.
 */
export const DUCK = [
  '........WWWWWWW.......',
  '.......WWWWWWWWS......',
  '.......WWWWWWWWS......',
  '.......WWWWWWWWS......',
  '.......BBBBBBBBB......',
  '.....WWWWWWWWWWWWS....',
  '........YYYYYYY.......',
  '.......YHHYYYYYY......',
  '.......YHYYYKEYYOOOO..',
  '.......YYYYYKKYYOOOOO.',
  '.......YYYYYYYYYPPPP..',
  '..Y.....YYYYYYYY......',
  '..YY...YYYYYYYYYY.....',
  '..YYYYYYYYYYYYYYYY....',
  '..YYYHHYYYYYYYYYYYY...',
  '..YYYYDDDDDDYYYYYYY...',
  '...YYYYDDDDDYYYYYYY...',
  '...YYYYYYYYYYYYYYYD...',
  '....YYYYYYYYYYYYDD....',
  '.....DDDDDDDDDDD......',
];

/**
 * The CSS colour of each mark of the duck, taken from the look in use: its
 * 16 numbered colours `ansi`, its accent and its text colour. The hat is
 * white, a little towards the text colour so it shows on a light look. `A`
 * is the water the small duck swims in (`stores/working`).
 */
export function duckColours(ansi: string[]): Record<string, string> {
  const yellow = ansi[11] ?? '#ffd866';
  const amber = ansi[3] ?? '#f2c744';
  const red = ansi[1] ?? '#ff5f56';
  const cyan = ansi[6] ?? '#33c9dc';
  return {
    W: 'color-mix(in srgb, #ffffff 88%, var(--term-fg))',
    S: 'color-mix(in srgb, #b9c0cc 88%, var(--term-fg))',
    B: 'var(--term-accent)',
    Y: yellow,
    H: `color-mix(in srgb, ${yellow} 45%, #ffffff)`,
    D: `color-mix(in srgb, ${amber} 78%, #6b3d00)`,
    O: `color-mix(in srgb, ${amber} 45%, ${red})`,
    P: `color-mix(in srgb, ${amber} 25%, ${red})`,
    K: '#16161a',
    E: '#ffffff',
    A: `color-mix(in srgb, ${cyan} 75%, var(--term-bg))`,
  };
}

/** The dots of `text` in one row, one empty column between letters. */
export function textDots(text: string): string[] {
  const letters = [...text].map((letter) => LETTERS[letter]);
  if (letters.some((letter) => !letter)) throw new Error(`no letter for: ${text}`);
  return Array.from({ length: 8 }, (_, row) => letters.map((letter) => letter![row]).join('.'));
}

/**
 * The outline, as an SVG path, of the dots of `grid` marked with `mark`.
 * One unit is one dot. Dots that touch in a row become one rectangle, so no
 * line can show between them.
 */
export function dotsPath(grid: string[], mark: string): string {
  let path = '';
  grid.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (row[x] !== mark) {
        x++;
        continue;
      }
      const start = x;
      while (row[x] === mark) x++;
      path += `M${start} ${y}h${x - start}v1h${start - x}z`;
    }
  });
  return path;
}

/** The marks used in `grid`, without the empty dot. */
export function marksOf(grid: string[]): string[] {
  return [...new Set(grid.join(''))].filter((mark) => mark !== '.');
}
