import type { CSSProperties } from 'react';
import { DUCK, halfBlocks, marksOf, wordDots } from '../stores/banner';

/**
 * The version as people say it. Installers and package managers only take
 * three numbers, so the files of this version are numbered 0.1.0.
 */
const VERSION = '0.1A';

const TERMINAL = halfBlocks(wordDots('TERMINAL'), '#').join('\n');
const DUCK_WORD = halfBlocks(wordDots('DUCK'), '#').join('\n');
/** Columns the banner needs: the duck, a gap and the longer word. */
const COLUMNS = DUCK[0]!.length + 3 + TERMINAL.indexOf('\n');
/** Width of a character of a monospace font, as a share of the font size. */
const CHARACTER_WIDTH = 0.6;

interface WelcomeProps {
  /** Font and size of the terminal, so the banner is made of its characters. */
  fontFamily: string;
  fontSize: number;
  /** The 16 numbered colours of the look in use. */
  ansi: string[];
}

/** One word of the name: letters with a light top, and their outline behind. */
function Word({ text }: { text: string }) {
  return (
    <div className="relative">
      <pre className="absolute inset-0 [font-family:inherit] translate-x-[0.35ch] translate-y-[0.2em] text-accent/35">
        {text}
      </pre>
      <pre
        className="relative bg-clip-text [font-family:inherit] text-transparent"
        style={{
          backgroundImage:
            'linear-gradient(to bottom, color-mix(in srgb, var(--term-accent) 45%, var(--term-fg)), var(--term-accent))',
        }}
      >
        {text}
      </pre>
    </div>
  );
}

/**
 * The banner of the app: the duck on the left, the name next to it, and the
 * terminal right under it. It is always there.
 *
 * It is made of the characters and the colours of the terminal, but drawn
 * by the window, above the terminal, not written into it: on Windows the
 * shell clears the screen when it starts, and a program that clears the
 * screen later would take the banner with it.
 */
export function Welcome({ fontFamily, fontSize, ansi }: WelcomeProps) {
  // Each part of the duck takes a colour of the look in use. The hat is
  // white, a little towards the text colour so it shows on a light look.
  const colours: Record<string, string> = {
    W: 'color-mix(in srgb, #ffffff 86%, var(--term-fg))',
    B: 'var(--term-accent)',
    Y: ansi[11] ?? '#ffd866',
    D: ansi[3] ?? '#f2c744',
    O: `color-mix(in srgb, ${ansi[3] ?? '#f2c744'} 45%, ${ansi[1] ?? '#ff5f56'})`,
    K: '#16161a',
  };
  const size: CSSProperties = {
    fontFamily,
    // Whole in a narrow window: the characters shrink, the picture stays.
    fontSize: `min(${fontSize}px, calc(100cqw / ${COLUMNS * CHARACTER_WIDTH}))`,
    // Measured on screen: at this height the half blocks of one line touch
    // the next, with no stripe of background between them.
    lineHeight: 1.2,
  };
  return (
    <section
      aria-label={`Terminal_Duck ${VERSION}`}
      className="px-3 pt-2 [container-type:inline-size]"
    >
      <div aria-hidden className="flex items-start gap-[3ch] select-none" style={size}>
        <div className="relative shrink-0">
          {marksOf(DUCK).map((mark, index) => (
            <pre
              key={mark}
              className={`[font-family:inherit] ${index === 0 ? 'relative' : 'absolute inset-0'}`}
              style={{ color: colours[mark] }}
            >
              {halfBlocks(DUCK, mark).join('\n')}
            </pre>
          ))}
        </div>
        <div className="min-w-0">
          <Word text={TERMINAL} />
          <div className="flex items-end gap-[3ch]">
            <Word text={DUCK_WORD} />
            <p className="pb-[0.3em] whitespace-pre text-fg/70">
              <span className="text-accent">v{VERSION}</span>
              {'\n'}F1 atajos
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
