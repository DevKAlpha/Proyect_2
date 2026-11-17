/**
 * The banner of the app, drawn with terminal characters.
 *
 * Pictures are grids of square dots. A character cell is about twice as
 * tall as it is wide, so each cell shows two dots, one above the other,
 * with the half-block characters. Pure functions: the component only
 * colours what comes out of here.
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
};

/**
 * The duck: a rubber duck that looks right, under a white top hat.
 * `W` hat, `B` its band, `Y` body, `D` wing, `O` beak, `K` eye.
 */
export const DUCK = [
  '.....WWWWWW.......',
  '......WWWWWW......',
  '......WWWWWW......',
  '......BBBBBB......',
  '....WWWWWWWWWW....',
  '......YYYYYY......',
  '.....YYYYYYYY.....',
  '.....YYYYYKYYOOO..',
  '.....YYYYYYYYOOOO.',
  '.Y....YYYYYYY.....',
  '.YY..YYYYYYYY.....',
  '.YYYYYYYYYYYYYY...',
  '.YYYDDDDDYYYYYY...',
  '..YYYDDDDYYYYYY...',
  '..YYYYYYYYYYYY....',
  '...YYYYYYYYYY.....',
];

/** The dots of `word` side by side, one empty column between letters. */
export function wordDots(word: string): string[] {
  const letters = [...word].map((letter) => LETTERS[letter]);
  if (letters.some((letter) => !letter)) throw new Error(`no letter for: ${word}`);
  return Array.from({ length: 8 }, (_, row) => letters.map((letter) => letter![row]).join('.'));
}

/**
 * The lines of text that draw the dots of `grid` marked with `mark`: two
 * rows of dots per line. A grid with an odd number of rows gets an empty
 * one at the end.
 */
export function halfBlocks(grid: string[], mark: string): string[] {
  const lines: string[] = [];
  for (let row = 0; row < grid.length; row += 2) {
    const top = grid[row]!;
    const bottom = grid[row + 1] ?? '';
    let line = '';
    for (let column = 0; column < top.length; column++) {
      const up = top[column] === mark;
      const down = bottom[column] === mark;
      line += up && down ? '█' : up ? '▀' : down ? '▄' : ' ';
    }
    lines.push(line);
  }
  return lines;
}

/** The marks used in `grid`, without the empty dot. */
export function marksOf(grid: string[]): string[] {
  return [...new Set(grid.join(''))].filter((mark) => mark !== '.');
}
