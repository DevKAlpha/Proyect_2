import { useState, type ReactNode } from 'react';
import type { Place, SshHost } from '../ipc';
import { sshCommand } from '../stores/remote';

interface StatusBarProps {
  /** Where the terminal is. `null` until its shell has started. */
  place: Place | null;
  /** Something the user should know about the last action, for example a folder that is gone. */
  notice: string | null;
  /** Whether this machine has `ssh`, the program remote control uses. */
  remoteAvailable: boolean;
  /** Machines of the user's SSH configuration, offered by name. */
  hosts: SshHost[];
  /** Shows the folder in the file manager of the system. */
  onOpenFolder: () => void;
  /** Opens a terminal on another machine: `machine` or `user@machine`. */
  onConnect: (target: string) => void;
  /** The user left the bar without choosing: the keyboard goes back to the terminal. */
  onCancel: () => void;
}

const action =
  'flex shrink-0 items-center gap-1.5 rounded px-1.5 py-0.5 outline-none hover:bg-fg/10 hover:text-fg focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-40';

/**
 * The words of a button. In a narrow bar (half of a split) they go away and
 * the icon stays; the name is still in the title and for screen readers.
 */
const label = '@max-[34rem]:sr-only';

/** Value of the menu entry that asks for a machine by hand. No host can be named like this. */
const OTHER = ' other';

/** Small line drawings in the colour of the text around them. */
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="size-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

const FolderIcon = () => (
  <Icon>
    <path d="M1.5 4.5v8h13v-6.5h-6l-1.5-1.5z" />
  </Icon>
);

const BranchIcon = () => (
  <Icon>
    <circle cx="4.5" cy="3.5" r="1.5" />
    <circle cx="4.5" cy="12.5" r="1.5" />
    <circle cx="11.5" cy="5.5" r="1.5" />
    <path d="M4.5 5v6M11.5 7c0 2.5-7 1.5-7 4" />
  </Icon>
);

const OpenIcon = () => (
  <Icon>
    <path d="M1.5 12.5v-8h4.5l1.5 1.5h5v2M1.5 12.5l2-4.5h11l-2 4.5z" />
  </Icon>
);

const RemoteIcon = () => (
  <Icon>
    <rect x="1.5" y="2.5" width="13" height="8.5" rx="1" />
    <path d="M5.5 13.5h5M5 5.5l2 1.5-2 1.5M8.5 8.5h2.5" />
  </Icon>
);

interface RemoteControlProps {
  available: boolean;
  hosts: SshHost[];
  onConnect: (target: string) => void;
  onCancel: () => void;
}

/**
 * Opens a terminal on another machine over SSH. The connection always goes
 * out from here, through the `ssh` program of the system; nothing in the
 * app listens for connections.
 */
function RemoteControl({ available, hosts, onConnect, onCancel }: RemoteControlProps) {
  // `null` while the menu is shown; the text being typed while asking for a machine.
  const [typed, setTyped] = useState<string | null>(null);

  if (!available) {
    return (
      <button
        type="button"
        disabled
        title="No se encontró el programa ssh en este equipo"
        className={action}
      >
        <RemoteIcon />
        <span className={label}>Control remoto</span>
      </button>
    );
  }

  if (typed !== null) {
    const valid = sshCommand(typed) !== null;
    return (
      <form
        className="flex shrink-0 items-center gap-1.5"
        onSubmit={(event) => {
          event.preventDefault();
          if (!valid) return;
          onConnect(typed.trim());
          setTyped(null);
        }}
      >
        <RemoteIcon />
        <input
          autoFocus
          aria-label="Equipo al que conectar por SSH"
          aria-invalid={typed.trim() !== '' && !valid}
          placeholder="usuario@equipo"
          title="Nombre o dirección del equipo, con el usuario delante si hace falta. Enter conecta, Esc cancela."
          spellCheck={false}
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return;
            setTyped(null);
            onCancel();
          }}
          onBlur={() => setTyped(null)}
          className="w-44 rounded border border-fg/25 bg-transparent px-1.5 py-0.5 text-fg outline-none select-text focus-visible:ring-2 focus-visible:ring-accent aria-[invalid=true]:border-dashed"
        />
        <button
          type="submit"
          disabled={!valid}
          // Without this the field would lose the focus, and close, before the click lands.
          onMouseDown={(event) => event.preventDefault()}
          className={action}
        >
          Conectar
        </button>
      </form>
    );
  }

  return (
    // A native select laid over the label: keyboard and screen-reader
    // support for free, as in the new-tab menu.
    <label
      title="Abre una terminal en otro equipo por SSH (Ctrl+Shift+R)"
      className={`relative focus-within:ring-2 focus-within:ring-accent ${action}`}
    >
      <RemoteIcon />
      <span className={label}>Control remoto</span>
      <select
        data-menu="remote"
        aria-label="Control remoto: conectar a otro equipo por SSH"
        value=""
        onChange={(event) => {
          if (event.target.value === OTHER) setTyped('');
          else onConnect(event.target.value);
        }}
        className="absolute inset-0 cursor-pointer appearance-none opacity-0"
      >
        <option value="" disabled hidden />
        {hosts.length > 0 && (
          <optgroup label="Tus equipos (configuración de SSH)" className="bg-bg text-fg">
            {hosts.map((host) => (
              <option key={host.name} value={host.name} className="bg-bg text-fg">
                {host.address ? `${host.name} (${host.address})` : host.name}
              </option>
            ))}
          </optgroup>
        )}
        <option value={OTHER} className="bg-bg text-fg">
          Otro equipo…
        </option>
      </select>
    </label>
  );
}

/**
 * The bar at the bottom of a terminal: the folder its shell is in, the Git
 * branch of that folder and what can be done from there. It follows the
 * shell: after every command the place is asked again.
 */
export function StatusBar(props: StatusBarProps) {
  const { place, notice, remoteAvailable, hosts, onOpenFolder, onConnect, onCancel } = props;
  const branch = place?.branch;

  return (
    <footer
      aria-label="Carpeta, rama y acciones de esta terminal"
      className="@container mt-1 flex h-7 shrink-0 items-center gap-3 border-t border-fg/10 pt-1 text-xs text-fg/70"
    >
      {place && (
        <span className="flex min-w-0 items-center gap-1.5" title={`Carpeta: ${place.path}`}>
          <FolderIcon />
          {/* Right to left only to cut a long path at its start: the end,
              the folder the user is in, is the part worth keeping. */}
          <span dir="rtl" className="min-w-0 truncate select-text">
            <bdi>{place.label}</bdi>
          </span>
        </span>
      )}

      {branch && (
        <span
          className="flex max-w-[40%] min-w-0 shrink-0 items-center gap-1.5"
          title={
            branch.detached
              ? `Sin rama: la carpeta está en el commit ${branch.name}`
              : `Rama de Git: ${branch.name}`
          }
        >
          <BranchIcon />
          <span className="truncate select-text">{branch.name}</span>
        </span>
      )}

      {notice && (
        <span role="alert" className="min-w-0 truncate select-text" title={notice}>
          {notice}
        </span>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <RemoteControl
          available={remoteAvailable}
          hosts={hosts}
          onConnect={onConnect}
          onCancel={onCancel}
        />
        <button
          type="button"
          data-action="open-folder"
          disabled={!place?.can_open}
          title={
            place?.can_open
              ? 'Abre esta carpeta en el explorador de archivos del sistema (Ctrl+Shift+O)'
              : 'Esta carpeta no se puede abrir desde aquí'
          }
          // Keeps the keyboard in the terminal: the user goes on typing.
          onMouseDown={(event) => event.preventDefault()}
          onClick={onOpenFolder}
          className={action}
        >
          <OpenIcon />
          <span className={label}>Explorador de archivos</span>
        </button>
      </div>
    </footer>
  );
}
