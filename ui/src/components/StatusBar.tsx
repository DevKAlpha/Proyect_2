import type { ReactNode } from 'react';
import type { Place } from '../ipc';

interface StatusBarProps {
  /** Where the terminal is. `null` until its shell has started. */
  place: Place | null;
  /** Something the user should know about the last action, for example a folder that is gone. */
  notice: string | null;
  /** Shows the folder in the file manager of the system. */
  onOpenFolder: () => void;
}

const action =
  'flex shrink-0 items-center gap-1.5 rounded px-1.5 py-0.5 outline-none hover:bg-fg/10 hover:text-fg focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-40';

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

/**
 * The bar at the bottom of a terminal: the folder its shell is in, the Git
 * branch of that folder and what can be done from there. It follows the
 * shell: after every command the place is asked again. Presentational only.
 */
export function StatusBar({ place, notice, onOpenFolder }: StatusBarProps) {
  const branch = place?.branch;

  return (
    <footer
      aria-label="Carpeta y rama de esta terminal"
      className="mt-1 flex h-7 shrink-0 items-center gap-3 border-t border-fg/10 pt-1 text-xs text-fg/70"
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

      <button
        type="button"
        disabled={!place?.can_open}
        title={
          place?.can_open
            ? 'Abre esta carpeta en el explorador de archivos del sistema'
            : 'Esta carpeta no se puede abrir desde aquí'
        }
        // Keeps the keyboard in the terminal: the user goes on typing.
        onMouseDown={(event) => event.preventDefault()}
        onClick={onOpenFolder}
        className={`ml-auto ${action}`}
      >
        <OpenIcon />
        Explorador de archivos
      </button>
    </footer>
  );
}
