import { describe, expect, it } from 'vitest';
import type { Config } from '../ipc';
import { imageType, terminalTheme, withOpacity } from './theme';

const ansi = Array.from(
  { length: 16 },
  (_, index) => `#0000${index.toString(16).padStart(2, '0')}`,
);

const config = {
  theme: {
    preset: 'dark',
    background: '#102030',
    foreground: '#ffffff',
    cursor: '#ff0000',
    selection: '#00ff0080',
    accent: '#0000ff',
    ansi,
  },
  background: { image: '', dim: 0.5 },
} as Config;

describe('withOpacity', () => {
  it('adds the opacity as two hex digits', () => {
    expect(withOpacity('#102030', 1)).toBe('#102030ff');
    expect(withOpacity('#102030', 0.5)).toBe('#10203080');
    expect(withOpacity('#102030', 0)).toBe('#10203000');
  });

  it('keeps the value inside the valid range', () => {
    expect(withOpacity('#102030', 7)).toBe('#102030ff');
    expect(withOpacity('#102030', -1)).toBe('#10203000');
  });

  it('leaves a colour that already has its own alpha', () => {
    expect(withOpacity('#10203040', 0.5)).toBe('#10203040');
  });
});

describe('terminalTheme', () => {
  it('maps the 16 numbered colours to their xterm.js names in order', () => {
    const theme = terminalTheme(config, false);

    expect(theme.black).toBe(ansi[0]);
    expect(theme.red).toBe(ansi[1]);
    expect(theme.brightBlack).toBe(ansi[8]);
    expect(theme.brightWhite).toBe(ansi[15]);
  });

  it('is opaque without a picture behind it', () => {
    expect(terminalTheme(config, false).background).toBe('#102030');
  });

  it('lets the picture show through by the configured amount', () => {
    expect(terminalTheme(config, true).background).toBe('#10203080');
  });
});

describe('imageType', () => {
  it('names the MIME type from the extension', () => {
    expect(imageType('C:\\fondos\\Noche.PNG')).toBe('image/png');
    expect(imageType('/home/ana/fondo.jpg')).toBe('image/jpeg');
    expect(imageType('/home/ana/fondo.webp')).toBe('image/webp');
  });
});
