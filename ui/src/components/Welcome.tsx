import { DUCK, dotsPath, marksOf, textDots } from '../stores/banner';

/**
 * The version as people say it. Installers and package managers only take
 * three numbers, so the files of this version are numbered 0.1.0.
 */
const VERSION = '0.1A';

const TITLE = textDots('TERMINAL_DUCK');
const TITLE_PATH = dotsPath(TITLE, '#');
const TITLE_WIDTH = TITLE[0]!.length;
const DUCK_WIDTH = DUCK[0]!.length;
/** Size of one dot, in units of the font size. The duck and the name share it. */
const DOT = 0.25;
/** Width of the banner in units of the font size: duck, gap, name and margins. */
const WIDTH = (DUCK_WIDTH + TITLE_WIDTH + 1) * DOT + 3;

interface WelcomeProps {
  /** Font and size of the terminal, for the line under the name. */
  fontFamily: string;
  fontSize: number;
  /** The 16 numbered colours of the look in use. */
  ansi: string[];
  /** Whether the look is the plain console one: its name is white, not coloured. */
  plain: boolean;
}

/**
 * The banner of the app: the duck on the left, the name next to it in one
 * row, and the terminal right under it. It is always there.
 *
 * It takes the colours of the terminal, but it is drawn by the window,
 * above the terminal, not written into it: on Windows the shell clears the
 * screen when it starts, and a program that clears the screen later would
 * take the banner with it.
 */
export function Welcome({ fontFamily, fontSize, ansi, plain }: WelcomeProps) {
  const yellow = ansi[11] ?? '#ffd866';
  const amber = ansi[3] ?? '#f2c744';
  const red = ansi[1] ?? '#ff5f56';
  // Each part of the duck takes a colour of the look in use. The hat is
  // white, a little towards the text colour so it shows on a light look.
  const colours: Record<string, string> = {
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
  };
  const ink = plain ? 'var(--term-fg)' : 'var(--term-accent)';
  return (
    <section
      aria-label={`Terminal_Duck ${VERSION}`}
      className="px-3 pt-2 [container-type:inline-size]"
    >
      <div
        className="flex items-center gap-[1.5em] select-none"
        style={{
          fontFamily,
          // Whole in a narrow window: everything shrinks together.
          fontSize: `min(${fontSize}px, calc(100cqw / ${WIDTH}))`,
        }}
      >
        <svg
          aria-hidden
          viewBox={`0 0 ${DUCK_WIDTH} ${DUCK.length}`}
          shapeRendering="crispEdges"
          className="shrink-0"
          style={{ width: `${DUCK_WIDTH * DOT}em`, height: `${DUCK.length * DOT}em` }}
        >
          {marksOf(DUCK).map((mark) => (
            <path key={mark} d={dotsPath(DUCK, mark)} style={{ fill: colours[mark] }} />
          ))}
        </svg>
        <div className="min-w-0">
          <svg
            aria-hidden
            viewBox={`0 0 ${TITLE_WIDTH + 1} ${TITLE.length + 1}`}
            shapeRendering="crispEdges"
            className="block"
            style={{
              width: `${(TITLE_WIDTH + 1) * DOT}em`,
              height: `${(TITLE.length + 1) * DOT}em`,
            }}
          >
            <defs>
              <linearGradient id="banner-ink" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" style={{ stopColor: `color-mix(in srgb, ${ink} 60%, #ffffff)` }} />
                <stop
                  offset="1"
                  style={{ stopColor: `color-mix(in srgb, ${ink} 82%, var(--term-bg))` }}
                />
              </linearGradient>
            </defs>
            {/* The same letters behind, one dot down and right: their outline. */}
            <path d={TITLE_PATH} transform="translate(1 1)" style={{ fill: ink, opacity: 0.3 }} />
            <path d={TITLE_PATH} fill="url(#banner-ink)" />
          </svg>
          <p className="mt-[0.2em] leading-none whitespace-pre text-fg/70">
            <span style={{ color: ink }}>v{VERSION}</span> · F1 atajos
          </p>
        </div>
      </div>
    </section>
  );
}
