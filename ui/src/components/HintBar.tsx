import type { Hint } from '../stores/guide';

interface HintBarProps {
  /** What to say about the command being typed. `null` leaves the line blank. */
  hint: Hint | null;
  /** Colour of the word that opens a warning: the theme's yellow. */
  warningColor: string;
  /** The user accepted the change the hint proposes. */
  onFix: () => void;
}

/**
 * The line under a terminal that talks about the command being typed: what
 * it does, a mistake it may hold, a warning. Presentational only.
 *
 * It keeps its row also when it has nothing to say. A line that came and
 * went would resize the terminal each time, and the shell redraws its
 * prompt on every resize.
 */
export function HintBar({ hint, warningColor, onFix }: HintBarProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex h-6 shrink-0 items-center gap-2 overflow-hidden pt-1 text-xs text-fg/70"
    >
      {hint && (
        <>
          {hint.tone === 'warning' && (
            <strong className="shrink-0" style={{ color: warningColor }}>
              Cuidado
            </strong>
          )}
          {hint.subject && (
            <code className="shrink-0 rounded bg-fg/10 px-1 font-mono text-fg">{hint.subject}</code>
          )}
          {/* The whole text stays reachable when the window is too narrow for it. */}
          <span className="min-w-0 truncate select-text" title={hint.text}>
            {hint.text}
          </span>
          {hint.fix && (
            <button
              type="button"
              title={`Cambia esa parte del comando por: ${hint.fix.text}`}
              // Keeps the keyboard in the terminal: the user goes on typing.
              onMouseDown={(event) => event.preventDefault()}
              onClick={onFix}
              className="shrink-0 rounded border border-fg/25 px-1.5 text-fg outline-none hover:bg-fg/10 focus-visible:ring-2 focus-visible:ring-accent"
            >
              Cambiar <span className="text-fg/60">Ctrl+.</span>
            </button>
          )}
        </>
      )}
    </div>
  );
}
