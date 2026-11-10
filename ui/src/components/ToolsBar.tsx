import type { ToolStatus } from '../ipc';

interface ToolsBarProps {
  /** Tools that are not installed. The bar renders nothing when empty. */
  missing: ToolStatus[];
  /** Runs the install command of `tool` where the user can watch it. */
  onInstall: (tool: ToolStatus) => void;
  /** The user does not want to see this bar again. */
  onHide: () => void;
}

const action =
  'rounded border border-fg/25 px-2 py-0.5 outline-none hover:bg-fg/10 focus-visible:ring-2 focus-visible:ring-accent';

/**
 * Tells the user which common tools are missing and offers to install each
 * one. Nothing is installed without a click: the command is shown first and
 * then runs in a tab of its own. Presentational only.
 */
export function ToolsBar({ missing, onInstall, onHide }: ToolsBarProps) {
  if (missing.length === 0) return null;

  return (
    <section
      aria-label="Herramientas que faltan"
      className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-fg/10 bg-fg/5 px-3 py-1.5 text-xs"
    >
      <span className="text-fg/70">Faltan en este equipo:</span>

      {missing.map((tool) => (
        <span key={tool.id} className="flex items-center gap-2">
          <span>
            {tool.name} <span className="text-fg/60">({tool.provides})</span>
          </span>
          {tool.install_command ? (
            <button
              type="button"
              // The exact command, before anything runs.
              title={`Abre una pestaña y ejecuta: ${tool.install_command}`}
              onClick={() => onInstall(tool)}
              className={action}
            >
              Instalar
            </button>
          ) : (
            <span className="text-fg/60 select-text">Descarga: {tool.website}</span>
          )}
        </span>
      ))}

      <button type="button" onClick={onHide} className="ml-auto text-fg/60 underline hover:text-fg">
        No volver a mostrar
      </button>
    </section>
  );
}
