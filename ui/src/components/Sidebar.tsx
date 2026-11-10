import { useState, type KeyboardEvent } from 'react';
import type { BrowserStatus } from '../ipc';
import { tabsOf, type Project, type Tab } from '../stores/tabs';

interface SidebarProps {
  projects: Project[];
  tabs: Tab[];
  activeProjectId: string | null;
  activeId: number | null;
  /** The test browser. `null` until it has been checked. */
  browser: BrowserStatus | null;
  browserError: string | null;
  onSelectProject: (id: string | null) => void;
  /** Asks the user for a folder and creates a project for it. */
  onAddProject: () => void;
  onRenameProject: (id: string, name: string) => void;
  onRemoveProject: (id: string) => void;
  /** Opens a new terminal in the given project. */
  onNewTab: (projectId: string | null) => void;
  onActivateTab: (id: number) => void;
  onRenameTab: (id: number, title: string) => void;
  onCloseTab: (id: number) => void;
  onToggleBrowser: () => void;
  onOpenConfig: () => void;
}

const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-accent';
const iconButton = `grid size-5 shrink-0 place-items-center rounded text-fg/50 hover:bg-fg/15 hover:text-fg ${focusRing}`;
const footerButton = `w-full rounded px-2 py-1 text-left hover:bg-fg/10 ${focusRing}`;

/** What is being renamed in place: `project:<id>` or `tab:<id>`. */
type Editing = string | null;

interface NameInputProps {
  initial: string;
  label: string;
  onDone: (name: string | null) => void;
}

/** A text box that replaces a name while the user edits it. */
function NameInput({ initial, label, onDone }: NameInputProps) {
  const [value, setValue] = useState(initial);
  const commit = () => onDone(value.trim() || null);
  return (
    <input
      autoFocus
      aria-label={label}
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onFocus={(event) => event.target.select()}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit();
        if (event.key === 'Escape') onDone(null);
        // Keep app shortcuts and the terminal out of the typing.
        event.stopPropagation();
      }}
      className={`min-w-0 flex-1 rounded bg-fg/10 px-1 select-text ${focusRing}`}
    />
  );
}

/** F2 starts a rename, as in a file manager. Double click does the same. */
const onF2 = (start: () => void) => (event: KeyboardEvent) => {
  if (event.key === 'F2') start();
};

/**
 * Projects on the left, each with its terminals, like folders of chats.
 * Terminals outside any project live in the "General" group. Presentational:
 * the only state here is which name is being edited.
 */
export function Sidebar(props: SidebarProps) {
  const { projects, tabs, activeProjectId, activeId, browser, browserError } = props;
  const [editing, setEditing] = useState<Editing>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  /** The terminals of one group, as a list under its heading. */
  const terminals = (projectId: string | null) => (
    <ul>
      {tabsOf(tabs, projectId).map((tab) => {
        const current = tab.id === activeId;
        return (
          <li
            key={tab.id}
            className={`group flex items-center gap-1 rounded pr-1 pl-5 ${current ? 'bg-fg/10' : ''}`}
          >
            {editing === `tab:${tab.id}` ? (
              <NameInput
                initial={tab.title}
                label={`Nombre de la terminal ${tab.title}`}
                onDone={(title) => {
                  if (title) props.onRenameTab(tab.id, title);
                  setEditing(null);
                }}
              />
            ) : (
              <button
                type="button"
                aria-current={current ? 'true' : undefined}
                title="Doble clic o F2 para cambiar el nombre"
                onClick={() => props.onActivateTab(tab.id)}
                onDoubleClick={() => setEditing(`tab:${tab.id}`)}
                onKeyDown={onF2(() => setEditing(`tab:${tab.id}`))}
                // A terminal that has not been started yet reads as dimmer.
                className={`min-w-0 flex-1 truncate py-0.5 text-left hover:text-fg ${
                  current ? '' : tab.started ? 'text-fg/75' : 'text-fg/45'
                } ${focusRing}`}
              >
                {tab.title}
              </button>
            )}
            <button
              type="button"
              aria-label={`Cerrar ${tab.title}`}
              onClick={() => props.onCloseTab(tab.id)}
              className={`${iconButton} opacity-0 group-focus-within:opacity-100 group-hover:opacity-100`}
            >
              ×
            </button>
          </li>
        );
      })}
    </ul>
  );

  /** The heading row of a group: its name and its actions. */
  const heading = (projectId: string | null, name: string, path?: string) => {
    const current = projectId === activeProjectId;
    return (
      <div className="group flex items-center gap-1 pr-1">
        {projectId !== null && editing === `project:${projectId}` ? (
          <NameInput
            initial={name}
            label={`Nombre del proyecto ${name}`}
            onDone={(next) => {
              if (next) props.onRenameProject(projectId, next);
              setEditing(null);
            }}
          />
        ) : (
          <button
            type="button"
            aria-current={current ? 'true' : undefined}
            title={path ?? 'Terminales fuera de un proyecto'}
            onClick={() => props.onSelectProject(projectId)}
            onDoubleClick={() => projectId !== null && setEditing(`project:${projectId}`)}
            onKeyDown={onF2(() => projectId !== null && setEditing(`project:${projectId}`))}
            className={`min-w-0 flex-1 truncate rounded px-1 py-0.5 text-left font-medium hover:text-fg ${
              current ? 'text-accent' : 'text-fg/85'
            } ${focusRing}`}
          >
            {name}
          </button>
        )}
        <button
          type="button"
          aria-label={`Nueva terminal en ${name}`}
          title="Nueva terminal aquí"
          onClick={() => props.onNewTab(projectId)}
          className={iconButton}
        >
          +
        </button>
        {projectId !== null && (
          <button
            type="button"
            aria-label={`Quitar el proyecto ${name}`}
            title="Quitar proyecto"
            onClick={() => setRemoving(projectId)}
            className={`${iconButton} opacity-0 group-focus-within:opacity-100 group-hover:opacity-100`}
          >
            ×
          </button>
        )}
      </div>
    );
  };

  return (
    <nav
      aria-label="Proyectos"
      className="flex w-56 shrink-0 flex-col border-r border-fg/10 text-sm"
    >
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-fg/10 pr-1 pl-3">
        <span className="text-xs tracking-wide text-fg/60 uppercase">Proyectos</span>
        <button
          type="button"
          aria-label="Nuevo proyecto"
          title="Nuevo proyecto: elige su carpeta"
          onClick={props.onAddProject}
          className={iconButton}
        >
          +
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
        <section>
          {heading(null, 'General')}
          {terminals(null)}
        </section>

        {projects.map((project) => (
          <section key={project.id}>
            {heading(project.id, project.name, project.path)}
            {removing === project.id && (
              <div
                role="alertdialog"
                aria-label="Quitar proyecto"
                className="my-1 rounded bg-fg/10 p-2 text-xs"
              >
                <p>¿Quitar «{project.name}»? Se cierran sus terminales. La carpeta no se borra.</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    autoFocus
                    onClick={() => {
                      props.onRemoveProject(project.id);
                      setRemoving(null);
                    }}
                    className={`rounded border border-fg/25 px-2 py-0.5 hover:bg-fg/10 ${focusRing}`}
                  >
                    Quitar
                  </button>
                  <button
                    type="button"
                    onClick={() => setRemoving(null)}
                    className={`rounded px-2 py-0.5 hover:bg-fg/10 ${focusRing}`}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
            {terminals(project.id)}
          </section>
        ))}

        {projects.length === 0 && (
          <p className="px-1 text-xs text-fg/50">
            Un proyecto es una carpeta con sus terminales. Créalo con el botón + de arriba.
          </p>
        )}
      </div>

      <div className="shrink-0 space-y-0.5 border-t border-fg/10 p-2 text-xs">
        {browser?.browser ? (
          <>
            <button
              type="button"
              aria-pressed={browser.running}
              title={`${browser.browser}, con un perfil propio y vacío. Los agentes de IA lo controlan para probar aplicaciones web.`}
              onClick={props.onToggleBrowser}
              className={footerButton}
            >
              {browser.running ? 'Cerrar navegador de pruebas' : 'Abrir navegador de pruebas'}
            </button>
            {browser.running && (
              <p className="px-2 text-fg/55 select-text">Abierto en {browser.endpoint}</p>
            )}
          </>
        ) : (
          browser && (
            <p className="px-2 text-fg/50">
              Navegador de pruebas: instala Chrome, Edge o Chromium.
            </p>
          )
        )}
        {browserError && (
          <p role="alert" className="px-2 select-text">
            {browserError}
          </p>
        )}
        <button
          type="button"
          title="Abre el archivo de configuración: colores, fuente, fondo, agentes"
          onClick={props.onOpenConfig}
          className={footerButton}
        >
          Personalizar
        </button>
      </div>
    </nav>
  );
}
