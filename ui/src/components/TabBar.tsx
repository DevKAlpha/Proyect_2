import type { MenuGroup, MenuItem } from '../stores/menu';
import type { Split, Tab } from '../stores/tabs';

interface TabBarProps {
  tabs: Tab[];
  activeId: number | null;
  /** What a new tab can be: shells, agents, installs. */
  menu: MenuGroup[];
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onSelect: (id: number) => void;
  onClose: (id: number) => void;
  /** Opens a tab with the default shell. */
  onNew: () => void;
  /** Opens the tab the user chose in the menu. */
  onPick: (item: MenuItem) => void;
  /** The two terminals shown side by side, or `null` with one on screen. */
  split: Split | null;
  /** Shows two terminals side by side, or goes back to one. */
  onToggleSplit: () => void;
}

const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-accent';

/** The strip of tabs plus the controls that open new ones. Presentational only. */
export function TabBar(props: TabBarProps) {
  const { tabs, activeId, menu, sidebarOpen, onToggleSidebar, onSelect, onClose, onNew, onPick } =
    props;
  const { split, onToggleSplit } = props;
  const items = menu.flatMap((group) => group.items);

  return (
    <header className="flex h-9 shrink-0 items-stretch border-b border-fg/10 text-sm">
      <button
        type="button"
        aria-label="Proyectos"
        aria-pressed={sidebarOpen}
        title="Mostrar u ocultar los proyectos (Ctrl+Shift+B)"
        onClick={onToggleSidebar}
        className={`w-9 border-r border-fg/10 text-fg/60 hover:bg-fg/10 hover:text-fg ${focusRing}`}
      >
        ☰
      </button>

      <div role="tablist" aria-label="Pestañas" className="flex min-w-0 items-stretch">
        {tabs.map((tab) => {
          const selected = tab.id === activeId;
          // The other half of a split: on screen, without the keyboard.
          const beside = !selected && (tab.id === split?.left || tab.id === split?.right);
          return (
            <div
              key={tab.id}
              className={`flex min-w-0 items-center border-r border-fg/10 ${
                selected
                  ? 'bg-fg/10 shadow-[inset_0_-2px_0_var(--term-accent)]'
                  : beside
                    ? 'bg-fg/5 shadow-[inset_0_-2px_0_color-mix(in_srgb,var(--term-fg)_35%,transparent)]'
                    : 'text-fg/60'
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
        onClick={onNew}
        className={`w-9 text-lg text-fg/60 hover:bg-fg/10 hover:text-fg ${focusRing}`}
      >
        +
      </button>

      {items.length > 1 && (
        // A native select: keyboard and screen-reader support for free.
        <select
          aria-label="Nueva pestaña con un shell o un agente"
          title="Nueva pestaña con un shell o un agente"
          value=""
          onChange={(event) => {
            const item = items.find((candidate) => candidate.key === event.target.value);
            if (item) onPick(item);
          }}
          className={`w-6 cursor-pointer appearance-none bg-transparent text-center text-fg/60 hover:bg-fg/10 hover:text-fg ${focusRing}`}
        >
          <option value="" disabled hidden>
            ▾
          </option>
          {menu.map((group) => (
            <optgroup key={group.label} label={group.label} className="bg-bg text-fg">
              {group.items.map((item) => (
                <option key={item.key} value={item.key} className="bg-bg text-fg">
                  {item.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      )}

      <button
        type="button"
        aria-label="Vista dividida"
        aria-pressed={split !== null}
        title={
          split
            ? 'Volver a una sola terminal (Ctrl+Shift+D)'
            : 'Ver dos terminales lado a lado (Ctrl+Shift+D)'
        }
        onClick={onToggleSplit}
        className={`ml-auto grid w-9 place-items-center border-l border-fg/10 hover:bg-fg/10 hover:text-fg ${
          split ? 'text-accent' : 'text-fg/60'
        } ${focusRing}`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <rect x="1.5" y="2.5" width="13" height="11" rx="1" />
          <path d="M8 2.5v11" />
        </svg>
      </button>
    </header>
  );
}
