import { describe, expect, it } from 'vitest';
import { DUCK, halfBlocks, marksOf, wordDots } from './banner';

describe('wordDots', () => {
  it('puts the letters side by side with one empty column between them', () => {
    const dots = wordDots('DUCK');

    expect(dots).toHaveLength(8);
    // Four letters of 6 dots and three gaps.
    expect(dots.every((row) => row.length === 27)).toBe(true);
    expect(dots[0]).toBe('#####..##..##..#####.##..##');
  });

  it('has every letter of the name', () => {
    expect(() => wordDots('TERMINAL')).not.toThrow();
    expect(() => wordDots('DUCK')).not.toThrow();
    expect(() => wordDots('X')).toThrow();
  });
});

describe('halfBlocks', () => {
  it('draws two rows of dots in one line of text', () => {
    expect(halfBlocks(['##..', '#.#.'], '#')).toEqual(['█▀▄ ']);
  });

  it('only draws the dots of the mark asked for', () => {
    expect(halfBlocks(['WY', 'YY'], 'W')).toEqual(['▀ ']);
    expect(halfBlocks(['WY', 'YY'], 'Y')).toEqual(['▄█']);
  });

  it('a grid with an odd number of rows still ends', () => {
    expect(halfBlocks(['#', '#', '#'], '#')).toEqual(['█', '▀']);
  });
});

describe('the duck', () => {
  it('is a rectangle: every colour layer lines up with the others', () => {
    expect(new Set(DUCK.map((row) => row.length)).size).toBe(1);
    expect(DUCK.length % 2).toBe(0);
  });

  it('has a hat, a band, a body, a wing, a beak and an eye', () => {
    expect(marksOf(DUCK).sort()).toEqual(['B', 'D', 'K', 'O', 'W', 'Y']);
  });
});
