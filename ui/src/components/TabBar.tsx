import type { ShellProfile } from '../ipc';
import type { Tab } from '../stores/tabs';

interface TabBarProps {
  tabs: Tab[];
  activeId: number | null;
  shells: ShellProfile[];
  onSelect: (id: number) => void;
  onClose: (id: number) => void;
  /** Opens a tab with `shell`, or with the default shell when omitted. */
  onNew: (shell?: ShellProfile) => void;
}

const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-accent';

/** The strip of tabs plus the controls that open new ones. Presentational only. */
export function TabBar({ tabs, activeId, shells, onSelect, onClose, onNew }: TabBarProps) {
  return (
    <header className="flex h-9 shrink-0 items-stretch border-b border-fg/10 text-sm">
      <div role="tablist" aria-label="Pestañas" className="flex min-w-0 items-stretch">
        {tabs.map((tab) => {
          const selected = tab.id === activeId;
          return (
            <div
              key={tab.id}
              className={`flex min-w-0 items-center border-r border-fg/10 ${
                selected ? 'bg-fg/10 shadow-[inset_0_-2px_0_var(--term-accent)]' : 'text-fg/60'
              }`}
            >
              <button
                type="button"
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={selected}
                aria-controls={`panel-${tab.id}`}
                onClick={() => onSelect(tab.id)}
                className={`h-full truncate pr-1 pl-3 hover:text-fg ${focusRing}`}
              >
                {tab.title}
              </button>
              <button
                type="button"
                aria-label={`Cerrar ${tab.title}`}
                title="Cerrar pestaña (Ctrl+Shift+W)"
                onClick={() => onClose(tab.id)}
                className={`mr-1 grid size-5 place-items-center rounded text-fg/50 hover:bg-fg/15 hover:text-fg ${focusRing}`}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        aria-label="Nueva pestaña"
        title="Nueva pestaña (Ctrl+Shift+T)"
        onClick={() => onNew()}
        className={`w-9 text-lg text-fg/60 hover:bg-fg/10 hover:text-fg ${focusRing}`}
      >
        +
      </button>

      {shells.length > 1 && (
        // A native select: keyboard and screen-reader support for free.
        <select
          aria-label="Nueva pestaña con otro shell"
          title="Nueva pestaña con otro shell"
          value=""
          onChange={(event) => {
            const shell = shells.find((candidate) => candidate.id === event.target.value);
            if (shell) onNew(shell);
          }}
          className={`w-6 cursor-pointer appearance-none bg-transparent text-center text-fg/60 hover:bg-fg/10 hover:text-fg ${focusRing}`}
        >
          <option value="" disabled hidden>
            ▾
          </option>
          {shells.map((shell) => (
            <option key={shell.id} value={shell.id} className="bg-bg text-fg">
              {shell.name}
            </option>
          ))}
        </select>
      )}
    </header>
  );
}
