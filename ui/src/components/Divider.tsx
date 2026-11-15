import type { CSSProperties } from 'react';

interface DividerProps {
  /** What the divider resizes, for screen readers. */
  label: string;
  /** Where it is now, with its limits, in the unit the caller uses. */
  now: number;
  min: number;
  max: number;
  /** The pointer dragged the divider to this horizontal position of the window. */
  onDrag: (clientX: number) => void;
  /** An arrow key asked for one step: `-1` to the left, `1` to the right. */
  onStep: (direction: -1 | 1) => void;
  className?: string;
  style?: CSSProperties;
}

/**
 * A vertical line between two parts of the window that the user drags to
 * give one of them more room. Also moved with the arrow keys. Presentational
 * only: the caller turns positions into sizes.
 */
export function Divider({ label, now, min, max, onDrag, onStep, className, style }: DividerProps) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={Math.round(now)}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      title={`${label}: arrastra o usa las flechas`}
      onPointerDown={(event) => {
        // Capturing the pointer keeps the drag alive over the terminals,
        // which would otherwise take the movement as a text selection.
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) onDrag(event.clientX);
      }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') onStep(-1);
        else if (event.key === 'ArrowRight') onStep(1);
        else return;
        event.preventDefault();
      }}
      style={style}
      // Wider than the line it shows, so it is easy to grab.
      className={`group z-10 w-[7px] shrink-0 cursor-col-resize touch-none outline-none ${className ?? ''}`}
    >
      <div className="mx-auto h-full w-px bg-fg/10 group-hover:w-[3px] group-hover:bg-accent group-focus-visible:w-[3px] group-focus-visible:bg-accent group-active:w-[3px] group-active:bg-accent" />
    </div>
  );
}
