import { describe, expect, it } from 'vitest';
import { findPaths } from './pathLinks';

/** The paths found in a line, and the text each one covers on screen. */
const paths = (line: string) => findPaths(line).map((found) => found.path);
const shown = (line: string) => findPaths(line).map((found) => line.slice(found.start, found.end));

describe('findPaths', () => {
  it('finds absolute paths of every system', () => {
    expect(paths('open C:\\Users\\ana\\notas.txt now')).toEqual(['C:\\Users\\ana\\notas.txt']);
    expect(paths('see /etc/hosts and ~/web/app')).toEqual(['/etc/hosts', '~/web/app']);
    expect(paths('D:/datos/2024/informe.pdf')).toEqual(['D:/datos/2024/informe.pdf']);
  });

  it('finds relative paths and file names by themselves', () => {
    expect(paths('modified:   src/app.ts')).toEqual(['src/app.ts']);
    expect(paths('./run.sh ../shared/lib.rs crates\\shell\\src')).toEqual([
      './run.sh',
      '../shared/lib.rs',
      'crates\\shell\\src',
    ]);
    expect(paths('README.md  package.json  .gitignore')).toEqual(['README.md', 'package.json']);
  });

  it('keeps the line number on screen and out of the path', () => {
    const line = 'error at src/app.ts:12:5: unexpected token';

    expect(paths(line)).toEqual(['src/app.ts']);
    expect(shown(line)).toEqual(['src/app.ts:12:5']);
    expect(paths('--> crates/shell/src/cwd.rs:236')).toEqual(['crates/shell/src/cwd.rs']);
  });

  it('takes the punctuation of a sentence off', () => {
    expect(paths('(see docs/guia.md).')).toEqual(['docs/guia.md']);
    expect(paths('PS C:\\Users\\ana> ')).toEqual(['C:\\Users\\ana']);
    expect(paths('saved to <out/report.html>, done')).toEqual(['out/report.html']);
  });

  it('reads a path with spaces when it is in quotes', () => {
    const line = 'copied "C:\\Mis cosas\\foto 1.png" to \'/tmp/mis fotos/a.png\'';

    expect(paths(line)).toEqual(['C:\\Mis cosas\\foto 1.png', '/tmp/mis fotos/a.png']);
    expect(shown(line)).toEqual(['C:\\Mis cosas\\foto 1.png', '/tmp/mis fotos/a.png']);
  });

  it('leaves web addresses to their own links, except file addresses', () => {
    expect(paths('visit https://example.com/docs/index.html today')).toEqual([]);
    expect(paths('clone ssh://host/ana/repo.git')).toEqual([]);
    expect(paths('file:///C:/Users/ana/a.txt')).toEqual(['file:///C:/Users/ana/a.txt']);
  });

  it('does not take numbers, options or plain words for paths', () => {
    expect(paths('version 1.2.3 on 12/05/2024 at 10:30, ratio 3/4')).toEqual([]);
    expect(paths('npm install --save-dev and then run it')).toEqual([]);
    expect(paths('grep -r "a*b" | wc')).toEqual([]);
  });

  it('gives words that only look like paths too: the disk decides', () => {
    expect(paths('and/or example.com')).toEqual(['and/or', 'example.com']);
  });

  it('is nothing for an empty line', () => {
    expect(findPaths('')).toEqual([]);
    expect(findPaths('     ')).toEqual([]);
  });
});
