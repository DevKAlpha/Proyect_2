import { useEffect, useRef } from 'react';
import { SHORTCUT_GROUPS } from '../stores/shortcuts';

interface ShortcutsPanelProps {
  onClose: () => void;
}

/**
 * The list of keyboard shortcuts, over the window. It closes with Escape,
 * with F1 (the key that opened it) or with a click outside. Presentational
 * only: the list comes from `stores/shortcuts`.
 */
export function ShortcutsPanel({ onClose }: ShortcutsPanelProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  // The keyboard goes into the panel, so that Escape and Tab work in it.
  useEffect(() => closeRef.current?.focus(), []);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-bg/80 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        className="flex max-h-full w-full max-w-3xl flex-col rounded border border-fg/20 bg-bg text-sm shadow-lg"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-fg/10 py-2 pr-2 pl-4">
          <h2 id="shortcuts-title" className="font-semibold">
            Atajos de teclado
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-fg/70 outline-none hover:bg-fg/10 hover:text-fg focus-visible:ring-2 focus-visible:ring-accent"
          >
            Cerrar (Esc)
          </button>
        </header>

        <div className="grid min-h-0 gap-x-8 gap-y-4 overflow-y-auto p-4 sm:grid-cols-2">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="mb-1.5 text-xs tracking-wide text-fg/60 uppercase">{group.title}</h3>
              <dl className="space-y-1">
                {group.shortcuts.map((shortcut) => (
                  <div key={shortcut.keys} className="flex items-baseline gap-3">
                    <dt className="w-40 shrink-0">
                      <kbd className="rounded border border-fg/20 bg-fg/5 px-1.5 py-0.5 font-mono text-xs whitespace-nowrap">
                        {shortcut.keys}
                      </kbd>
                    </dt>
                    <dd className="text-fg/80">{shortcut.what}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
