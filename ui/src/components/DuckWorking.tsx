import { useEffect, useState } from 'react';
import { dotsPath, duckColours, marksOf } from '../stores/banner';
import {
  elapsedLabel,
  FRAME_MS,
  verbFor,
  WORKING_DELAY_MS,
  WORKING_HEIGHT,
  WORKING_WIDTH,
  workingFrame,
} from '../stores/working';

/** Side of one dot, in pixels: whole pixels keep the dots sharp. */
const DOT = 2;

interface DuckWorkingProps {
  /** When the command started, as `Date.now()`. */
  since: number;
  /** The 16 numbered colours of the look in use. */
  ansi: string[];
  /** Whether the terminal is on screen. A hidden one does not animate. */
  visible: boolean;
}

/**
 * Whether the system asks for less movement. The duck then swims at a third
 * of its speed: it still has to show that something is going on, which is
 * the whole point of it.
 */
function prefersSlow(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * The small duck that swims while a command runs, with what it is doing and
 * the time gone by. Nothing shows during the first second: most commands
 * end before that, and the duck would only flash.
 */
export function DuckWorking({ since, ansi, visible }: DuckWorkingProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!visible) return;
    const timer = window.setInterval(() => setNow(Date.now()), FRAME_MS);
    return () => window.clearInterval(timer);
  }, [visible]);

  const elapsed = now - since;
  if (elapsed < WORKING_DELAY_MS) return null;
  const tick = Math.floor(elapsed / (prefersSlow() ? FRAME_MS * 3 : FRAME_MS));
  const frame = workingFrame(tick);
  const colours = duckColours(ansi);
  return (
    <>
      <svg
        aria-hidden
        viewBox={`0 0 ${WORKING_WIDTH} ${WORKING_HEIGHT}`}
        shapeRendering="crispEdges"
        width={WORKING_WIDTH * DOT}
        height={WORKING_HEIGHT * DOT}
        className="shrink-0"
      >
        {marksOf(frame).map((mark) => (
          <path key={mark} d={dotsPath(frame, mark)} style={{ fill: colours[mark] }} />
        ))}
      </svg>
      {/* The text changes once a second, so it is what a screen reader hears. */}
      <span className="shrink-0 text-fg">{verbFor(since)}…</span>
      <span className="shrink-0 tabular-nums">{elapsedLabel(elapsed)}</span>
      <span className="min-w-0 truncate text-fg/50">· Ctrl+C lo detiene</span>
    </>
  );
}
