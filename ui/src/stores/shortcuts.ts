/**
 * The keyboard shortcuts of the app, in one place: what the keys are, what
 * they do and how a key press is recognised. The list is what the help panel
 * shows, so a shortcut cannot exist without being listed.
 *
 * Almost all of them are Ctrl+Shift+letter. A terminal cannot send those
 * combinations to a shell, so none takes a key away from a program.
 */

/** What a shortcut asks the app to do. */
export type ShortcutId =
  | 'new-tab'
  | 'close-tab'
  | 'next-tab'
  | 'previous-tab'
  | 'go-to-tab'
  | 'new-tab-menu'
  | 'next-project'
  | 'previous-project'
  | 'new-project'
  | 'toggle-sidebar'
  | 'toggle-split'
  | 'other-half'
  | 'grow-left'
  | 'grow-right'
  | 'fullscreen'
  | 'zoom-in'
  | 'zoom-out'
  | 'zoom-reset'
  | 'templates-menu'
  | 'open-config'
  | 'folders-menu'
  | 'open-folder'
  | 'remote-menu'
  | 'help';

/** A recognised key press. `index` is the tab asked for by `go-to-tab`, from 0. */
export interface ShortcutHit {
  id: ShortcutId;
  index?: number;
}

/** The parts of a keyboard event this module reads. */
export interface KeyLike {
  key: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}

/** One line of the help panel. */
export interface ShortcutHelp {
  keys: string;
  what: string;
}

/**
 * Every shortcut, grouped the way the help panel shows them. The last group
 * lists keys handled by the terminal itself, so that the panel is the one
 * place to look.
 */
export const SHORTCUT_GROUPS: readonly { title: string; shortcuts: readonly ShortcutHelp[] }[] = [
  {
    title: 'Terminales y proyectos',
    shortcuts: [
      { keys: 'Ctrl+Shift+T', what: 'Nueva terminal' },
      { keys: 'Ctrl+Shift+M', what: 'Menú de terminal nueva: elegir shell o agente de IA' },
      { keys: 'Ctrl+Shift+W', what: 'Cerrar la terminal' },
      { keys: 'Ctrl+Tab', what: 'Terminal siguiente (con Shift, la anterior)' },
      { keys: 'Ctrl+1 … Ctrl+9', what: 'Ir a la terminal 1 a 9 del proyecto' },
      { keys: 'Ctrl+Shift+↓ / ↑', what: 'Proyecto siguiente / anterior' },
      { keys: 'Ctrl+Shift+N', what: 'Nuevo proyecto' },
    ],
  },
  {
    title: 'Vista',
    shortcuts: [
      { keys: 'Ctrl+Shift+B', what: 'Mostrar u ocultar la barra de proyectos' },
      { keys: 'Ctrl+Shift+D', what: 'Vista dividida: dos terminales lado a lado, o volver a una' },
      { keys: 'Ctrl+Shift+E', what: 'Pasar el teclado a la otra mitad' },
      { keys: 'Ctrl+Shift+← / →', what: 'Dar más sitio a la mitad derecha / izquierda' },
      { keys: 'F11', what: 'Pantalla completa' },
      { keys: 'Ctrl++ / Ctrl+- / Ctrl+0', what: 'Texto más grande / más pequeño / normal' },
    ],
  },
  {
    title: 'Aspecto, archivos y otros equipos',
    shortcuts: [
      { keys: 'Ctrl+Shift+P', what: 'Menú de plantillas de aspecto' },
      { keys: 'Ctrl+Shift+S', what: 'Abrir el archivo de configuración' },
      { keys: 'Ctrl+Shift+F', what: 'Menú de carpetas de la terminal' },
      { keys: 'Ctrl+Shift+O', what: 'Abrir la carpeta actual en el explorador de archivos' },
      { keys: 'Ctrl+Shift+R', what: 'Menú de control remoto (SSH)' },
      { keys: 'F1', what: 'Mostrar u ocultar esta lista' },
    ],
  },
  {
    title: 'Al escribir',
    shortcuts: [
      { keys: '→', what: 'Aceptar el comando sugerido en gris' },
      { keys: 'Ctrl+.', what: 'Aplicar el cambio que propone la línea de ayuda' },
      { keys: 'Ctrl+C', what: 'Copiar si hay texto seleccionado; si no, interrumpir' },
      { keys: 'Ctrl+V', what: 'Pegar texto, archivos o una imagen' },
      { keys: 'Ctrl+clic', what: 'Abrir un enlace o mostrar una ruta en el explorador' },
      { keys: 'Shift+Enter', what: 'Línea nueva sin enviar, en agentes de IA' },
    ],
  },
];

/** Ctrl+Shift+letter shortcuts, by the letter in lower case. */
const WITH_SHIFT: Readonly<Record<string, ShortcutId>> = {
  t: 'new-tab',
  m: 'new-tab-menu',
  w: 'close-tab',
  n: 'new-project',
  b: 'toggle-sidebar',
  d: 'toggle-split',
  e: 'other-half',
  p: 'templates-menu',
  s: 'open-config',
  f: 'folders-menu',
  o: 'open-folder',
  r: 'remote-menu',
  arrowdown: 'next-project',
  arrowup: 'previous-project',
  arrowleft: 'grow-right',
  arrowright: 'grow-left',
};

/**
 * The shortcut a key press asks for, or `null` when the key belongs to the
 * terminal. Alt and the Windows or Command key never take part: those
 * combinations are left to the system and to the shell.
 */
export function matchShortcut(event: KeyLike): ShortcutHit | null {
  if (event.altKey || event.metaKey) return null;
  const key = event.key.toLowerCase();

  if (!event.ctrlKey) {
    if (event.shiftKey) return null;
    if (key === 'f1') return { id: 'help' };
    if (key === 'f11') return { id: 'fullscreen' };
    return null;
  }

  // "+" needs Shift on most layouts, so "=" (the same key) zooms in too.
  if (key === '+' || key === '=') return { id: 'zoom-in' };
  if (key === 'tab') return { id: event.shiftKey ? 'previous-tab' : 'next-tab' };

  if (event.shiftKey) {
    const id = WITH_SHIFT[key];
    return id ? { id } : null;
  }
  if (key === '-') return { id: 'zoom-out' };
  if (key === '0') return { id: 'zoom-reset' };
  if (/^[1-9]$/.test(key)) return { id: 'go-to-tab', index: Number(key) - 1 };
  return null;
}
