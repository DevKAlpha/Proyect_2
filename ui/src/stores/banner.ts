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
