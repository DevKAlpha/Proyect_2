import duck from '../assets/duck.svg';

interface WelcomeProps {
  /** Font of the terminal, so the greeting reads as part of it. */
  fontFamily: string;
  onClose: () => void;
}

/**
 * The greeting shown when the app opens: the logo on the left, the name
 * next to it, and the terminal right under it.
 *
 * It is drawn by the window, not written into the terminal: on Windows the
 * shell clears the screen when it starts, and text written before that
 * would be wiped or would leave the cursor in the wrong row.
 */
export function Welcome({ fontFamily, onClose }: WelcomeProps) {
  return (
    <section
      aria-label="Bienvenida"
      className="mx-2 mt-2 flex items-center gap-4 rounded border border-accent/50 px-4 py-3 text-sm"
      style={{ fontFamily }}
    >
      <img src={duck} alt="" className="size-16 shrink-0" />
      <div className="min-w-0 flex-1">
        <h1 className="text-xl font-bold">Terminal_Duck</h1>
        <p className="text-fg/70">Te damos la bienvenida. Escribe un comando para empezar.</p>
        <p className="truncate text-fg/70">
          F1 atajos · Ctrl+Shift+T terminal nueva · Ctrl+Shift+P plantillas de aspecto
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar la bienvenida"
        title="Cerrar"
        className="shrink-0 self-start rounded px-2 text-lg leading-none text-fg/60 outline-none hover:bg-fg/10 hover:text-fg focus-visible:ring-2 focus-visible:ring-accent"
      >
        ×
      </button>
    </section>
  );
}
