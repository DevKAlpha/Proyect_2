import { describe, expect, it } from 'vitest';
import { DUCK, dotsPath, marksOf, textDots } from './banner';

describe('textDots', () => {
  it('puts the letters side by side with one empty column between them', () => {
    const dots = textDots('DUCK');

    expect(dots).toHaveLength(8);
    // Four letters of 6 dots and three gaps.
    expect(dots.every((row) => row.length === 27)).toBe(true);
    expect(dots[0]).toBe('#####..##..##..#####.##..##');
  });

  it('writes the whole name in one row', () => {
    const dots = textDots('TERMINAL_DUCK');

    // Thirteen characters of 6 dots and twelve gaps.
    expect(dots.every((row) => row.length === 90)).toBe(true);
    // The underscore of the name is on the last two rows only.
    expect(dots[5]!.slice(56, 62)).toBe('......');
    expect(dots[7]!.slice(56, 62)).toBe('######');
    expect(() => textDots('X')).toThrow();
  });
});

describe('dotsPath', () => {
  it('joins the dots that touch in a row into one rectangle', () => {
    expect(dotsPath(['##.#'], '#')).toBe('M0 0h2v1h-2zM3 0h1v1h-1z');
  });

  it('only draws the dots of the mark asked for, row by row', () => {
    expect(dotsPath(['WY', 'YY'], 'W')).toBe('M0 0h1v1h-1z');
    expect(dotsPath(['WY', 'YY'], 'Y')).toBe('M1 0h1v1h-1zM0 1h2v1h-2z');
  });

  it('nothing to draw is an empty path', () => {
    expect(dotsPath(['..'], '#')).toBe('');
  });
});

describe('the duck', () => {
  it('is a rectangle', () => {
    expect(new Set(DUCK.map((row) => row.length)).size).toBe(1);
  });

  it('has a hat with its band, a body, a beak and an eye', () => {
    expect(marksOf(DUCK).sort()).toEqual(['B', 'D', 'E', 'H', 'K', 'O', 'P', 'S', 'W', 'Y']);
  });
});
