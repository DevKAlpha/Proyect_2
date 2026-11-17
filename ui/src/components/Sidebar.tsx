import { useState, type KeyboardEvent, type ReactNode } from 'react';
import type { AppFolder, BrowserStatus, Template } from '../ipc';
import { tabsOf, type Project, type Tab } from '../stores/tabs';
import { SidebarIcon, type SidebarIconName } from './SidebarIcon';

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
  /** How many commands are remembered for suggestions. */
  rememberedCommands: number;
  /** Forgets every remembered command. */
  onClearHistory: () => void;
  onToggleBrowser: () => void;
  onOpenConfig: () => void;
  /** Shows one of the folders of the app in the file manager. */
  onOpenAppFolder: (which: AppFolder) => void;
  /** Shows the list of keyboard shortcuts. */
  onShowShortcuts: () => void;
  /** Width in pixels, chosen by the user with the divider next to it. */
  width: number;
  /** Font of the look in use: the sidebar is written with it too. */
  fontFamily: string;
  fontSize: number;
  /** Ready-made looks: colours, font and cursor. */
  templates: Template[];
  /** Name of the template applied a moment ago, if any. */
  appliedTemplate: string | null;
  onApplyTemplate: (id: string) => void;
}

/** Sizes of the sidebar text, in pixels: readable with any font of a look. */
const TEXT_SIZE = { min: 13, max: 17 };

const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-accent';
const smallButton = `grid size-[1.6em] shrink-0 place-items-center rounded-full text-fg/55 transition-colors hover:bg-fg/15 hover:text-fg ${focusRing}`;
/** One row of the menu: an icon, a name and what goes at its end. */
const row =
  'flex w-full items-center gap-[0.7em] rounded-xl px-[0.7em] py-[0.5em] text-left transition-colors';
const quietRow = `${row} text-fg/60 hover:bg-fg/[0.07] hover:text-fg`;
const note = 'px-[0.7em] text-[0.85em] text-fg/55';

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
      className={`min-w-0 flex-1 rounded-md bg-fg/10 px-1 select-text ${focusRing}`}
    />
  );
}

/** F2 starts a rename, as in a file manager. Double click does the same. */
const onF2 = (start: () => void) => (event: KeyboardEvent) => {
  if (event.key === 'F2') start();
};

interface MenuProps {
  icon: SidebarIconName;
  label: string;
  /** Name the keyboard shortcuts find this menu by. */
  menu: string;
  title: string;
  onPick: (value: string) => void;
  children: ReactNode;
}

/**
 * A row that opens a list of choices. The list is a native select laid
 * over the row, invisible: keyboard and screen-reader support for free, and
 * the row looks like the others.
 */
function Menu({ icon, label, menu, title, onPick, children }: MenuProps) {
  return (
    <div className={`relative ${quietRow} focus-within:ring-2 focus-within:ring-accent`}>
      <SidebarIcon name={icon} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <SidebarIcon name="down" size={1} />
      <select
        data-menu={menu}
        aria-label={title.split('.')[0]}
        title={title}
        value=""
        onChange={(event) => onPick(event.target.value)}
        className="absolute inset-0 size-full cursor-pointer opacity-0"
      >
        <option value="" disabled hidden>
          {label}
        </option>
        {children}
      </select>
    </div>
  );
}

/**
 * Projects on the left, each with its terminals, like folders of chats, and
 * the options of the app under them. Terminals outside any project live in
 * the "General" group. Presentational: the only state here is which name is
 * being edited and which groups are folded.
 */
export function Sidebar(props: SidebarProps) {
  const { projects, tabs, activeProjectId, activeId, browser, browserError } = props;
  const [editing, setEditing] = useState<Editing>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  // Forgetting cannot be undone, so it takes a second click.
  const [confirmingForget, setConfirmingForget] = useState(false);
  // Groups whose terminals are folded away. `general` is the group without project.
  const [folded, setFolded] = useState<ReadonlySet<string>>(new Set());
  const toggleFold = (key: string) =>
    setFolded((before) => {
      const next = new Set(before);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  /** The terminals of one group, hanging from a line under its heading. */
  const terminals = (projectId: string | null) => {
    const own = tabsOf(tabs, projectId);
    if (own.length === 0 || folded.has(projectId ?? 'general')) return null;
    return (
      <ul className="mt-[0.15em] ml-[1.3em] border-l border-fg/15 pl-[0.6em]">
        {own.map((tab) => {
          const current = tab.id === activeId;
          return (
            <li
              key={tab.id}
              className={`group relative flex items-center gap-1 rounded-xl pr-[0.3em] pl-[0.7em] transition-colors before:absolute before:top-1/2 before:-left-[0.6em] before:w-[0.6em] before:border-t before:border-fg/15 ${
                current ? 'bg-fg/10' : 'hover:bg-fg/[0.07]'
              }`}
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
                  className={`min-w-0 flex-1 truncate rounded-lg py-[0.45em] text-left hover:text-fg ${
                    current ? 'text-fg' : tab.started ? 'text-fg/65' : 'text-fg/40'
                  } ${focusRing}`}
                >
                  {tab.title}
                </button>
              )}
              {current && (
                <span className="text-fg/70 group-focus-within:hidden group-hover:hidden">
                  <SidebarIcon name="right" size={1} />
                </span>
              )}
              <button
                type="button"
                aria-label={`Cerrar ${tab.title}`}
                onClick={() => props.onCloseTab(tab.id)}
                className={`${smallButton} hidden group-focus-within:grid group-hover:grid`}
              >
                <SidebarIcon name="close" size={0.9} />
              </button>
            </li>
          );
        })}
      </ul>
    );
  };

  /** The heading row of a group: its icon, its name and its actions. */
  const heading = (projectId: string | null, name: string, path?: string) => {
    const current = projectId === activeProjectId;
    const key = projectId ?? 'general';
    const count = tabsOf(tabs, projectId).length;
    return (
      <div
        className={`group ${row} ${current ? 'bg-fg/10 text-fg' : 'text-fg/60 hover:bg-fg/[0.07] hover:text-fg'}`}
      >
        <SidebarIcon name={projectId === null ? 'general' : 'project'} />
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
            className={`min-w-0 flex-1 truncate rounded-md text-left font-medium ${focusRing}`}
          >
            {name}
          </button>
        )}
        <button
          type="button"
          aria-label={`Nueva terminal en ${name}`}
          title="Nueva terminal aquí"
          onClick={() => props.onNewTab(projectId)}
          className={`${smallButton} hidden border border-fg/20 group-focus-within:grid group-hover:grid`}
        >
          <SidebarIcon name="plus" size={0.9} />
        </button>
        {projectId !== null && (
          <button
            type="button"
            aria-label={`Quitar el proyecto ${name}`}
            title="Quitar proyecto"
            onClick={() => setRemoving(projectId)}
            className={`${smallButton} hidden group-focus-within:grid group-hover:grid`}
          >
            <SidebarIcon name="close" size={0.9} />
          </button>
        )}
        {count > 0 && (
          <span
            title={count === 1 ? '1 terminal' : `${count} terminales`}
            className="grid min-w-[1.6em] place-items-center rounded-md bg-accent px-[0.35em] text-[0.85em] font-bold text-bg"
          >
            {count}
          </span>
        )}
        {count > 0 && (
          <button
            type="button"
            aria-expanded={!folded.has(key)}
            aria-label={`${folded.has(key) ? 'Mostrar' : 'Ocultar'} las terminales de ${name}`}
            onClick={() => toggleFold(key)}
            className={smallButton}
          >
            <SidebarIcon name={folded.has(key) ? 'down' : 'up'} size={1} />
          </button>
        )}
      </div>
    );
  };

  return (
    <nav
      aria-label="Proyectos"
      style={{
        width: props.width,
        fontFamily: props.fontFamily,
        fontSize: Math.min(TEXT_SIZE.max, Math.max(TEXT_SIZE.min, props.fontSize)),
      }}
      className="flex shrink-0 flex-col bg-fg/[0.04]"
    >
      <div className="flex shrink-0 items-center justify-between px-[1.1em] pt-[0.9em] pb-[0.4em]">
        <span className="text-[0.8em] font-bold tracking-[0.14em] text-fg/45 uppercase">
          Proyectos
        </span>
        <button
          type="button"
          aria-label="Nuevo proyecto"
          title="Nuevo proyecto: elige su carpeta"
          onClick={props.onAddProject}
          className={`${smallButton} border border-fg/20`}
        >
          <SidebarIcon name="plus" size={0.9} />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-[0.3em] overflow-y-auto px-[0.6em] py-[0.3em]">
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
                className="my-1 rounded-xl bg-fg/10 p-[0.7em] text-[0.85em]"
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
                    className={`rounded-lg border border-fg/25 px-2 py-0.5 hover:bg-fg/10 ${focusRing}`}
                  >
                    Quitar
                  </button>
                  <button
                    type="button"
                    onClick={() => setRemoving(null)}
                    className={`rounded-lg px-2 py-0.5 hover:bg-fg/10 ${focusRing}`}
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
          <p className={`${note} pt-[0.4em]`}>
            Un proyecto es una carpeta con sus terminales. Créalo con el botón + de arriba.
          </p>
        )}
      </div>

      <div className="shrink-0 space-y-[0.15em] border-t border-fg/10 px-[0.6em] py-[0.6em]">
        {browser?.browser ? (
          <>
            <button
              type="button"
              aria-pressed={browser.running}
              title={`${browser.browser}, con un perfil propio y vacío. Los agentes de IA lo controlan para probar aplicaciones web.`}
              onClick={props.onToggleBrowser}
              className={`${browser.running ? `${row} bg-fg/10 text-fg` : quietRow} ${focusRing}`}
            >
              <SidebarIcon name="browser" />
              <span className="min-w-0 flex-1 truncate">
                {browser.running ? 'Cerrar navegador de pruebas' : 'Navegador de pruebas'}
              </span>
              {browser.running && <span className="size-[0.55em] rounded-full bg-accent" />}
            </button>
            {browser.running && (
              <p className={`${note} select-text`}>Abierto en {browser.endpoint}</p>
            )}
          </>
        ) : (
          browser && <p className={note}>Navegador de pruebas: instala Chrome, Edge o Chromium.</p>
        )}
        {browserError && (
          <p role="alert" className={`${note} text-fg select-text`}>
            {browserError}
          </p>
        )}
        {props.templates.length > 0 && (
          <Menu
            icon="templates"
            label="Plantillas"
            menu="templates"
            title="Plantillas de aspecto. (Ctrl+Shift+P) Cambia colores, fuente y cursor por un aspecto ya hecho. Lo demás de tu configuración no cambia, y se guarda una copia de la anterior."
            onPick={props.onApplyTemplate}
          >
            {[false, true].map((detailed) => (
              <optgroup
                key={String(detailed)}
                label={
                  detailed ? 'Detalladas: todos los colores escritos' : 'Sencillas: pocas líneas'
                }
                className="bg-bg text-fg"
              >
                {props.templates
                  .filter((template) => template.detailed === detailed)
                  .map((template) => (
                    <option key={template.id} value={template.id} className="bg-bg text-fg">
                      {template.name}. {template.about}
                    </option>
                  ))}
              </optgroup>
            ))}
          </Menu>
        )}
        {props.appliedTemplate && (
          <p role="status" className={`${note} select-text`}>
            Plantilla «{props.appliedTemplate}» aplicada. Ábrela con «Personalizar» para ver cómo
            está hecha. Tu configuración anterior quedó en config.backup.toml.
          </p>
        )}
        <button
          type="button"
          title="Abre el archivo de configuración: colores, fuente, fondo, agentes (Ctrl+Shift+S)"
          onClick={props.onOpenConfig}
          className={`${quietRow} ${focusRing}`}
        >
          <SidebarIcon name="customise" />
          <span className="min-w-0 flex-1 truncate">Personalizar</span>
        </button>
        {/* Where the app keeps its files, one click away. */}
        <Menu
          icon="folders"
          label="Carpetas"
          menu="folders"
          title="Carpetas de la terminal. (Ctrl+Shift+F) Abre en el explorador de archivos una de las carpetas de la terminal. El archivo LEEME.txt de la carpeta del programa explica qué hay en cada una."
          onPick={(which) => props.onOpenAppFolder(which as AppFolder)}
        >
          <option value="program" className="bg-bg text-fg">
            Programa: la aplicación y LEEME.txt
          </option>
          <option value="config" className="bg-bg text-fg">
            Configuración: config.toml y tus proyectos
          </option>
          <option value="data" className="bg-bg text-fg">
            Datos: comandos recordados e imágenes pegadas
          </option>
        </Menu>
        <button
          type="button"
          title="Muestra todos los atajos de teclado (F1)"
          onClick={props.onShowShortcuts}
          className={`${quietRow} ${focusRing}`}
        >
          <SidebarIcon name="shortcuts" />
          <span className="min-w-0 flex-1 truncate">Atajos de teclado</span>
          <kbd className="rounded-md border border-fg/20 px-[0.4em] text-[0.8em] text-fg/55">
            F1
          </kbd>
        </button>
        {props.rememberedCommands > 0 && (
          <button
            type="button"
            title="Los comandos que ejecutas se recuerdan para sugerirlos mientras escribes. Esto los borra todos."
            onClick={() => {
              if (confirmingForget) props.onClearHistory();
              setConfirmingForget(!confirmingForget);
            }}
            onBlur={() => setConfirmingForget(false)}
            className={`${quietRow} ${focusRing}`}
          >
            <SidebarIcon name="forget" />
            <span className="min-w-0 flex-1 truncate">
              {confirmingForget ? 'Pulsa otra vez para olvidarlos' : 'Olvidar comandos'}
            </span>
            {!confirmingForget && (
              <span className="grid min-w-[1.6em] place-items-center rounded-md bg-fg/15 px-[0.35em] text-[0.85em] font-bold">
                {props.rememberedCommands}
              </span>
            )}
          </button>
        )}
      </div>
    </nav>
  );
}
