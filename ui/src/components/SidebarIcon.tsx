/**
 * The icons of the sidebar, drawn for this app: one per option, all in the
 * same line style so they read as one family. Each is a few strokes on a
 * 24 by 24 grid and takes the colour of the text around it.
 */
const ICONS = {
  /** A window with a prompt: one terminal. */
  terminal: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="3.5" />
      <path d="M7.5 10l3 2.5-3 2.5M13 15.5h3.5" />
    </>
  ),
  /** Four tiles, one of them marked: the terminals that belong to no project. */
  general: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
      <path d="M15.5 17h3" />
    </>
  ),
  /** A folder with a prompt inside: a project. */
  project: (
    <>
      <path d="M3 8a2.5 2.5 0 0 1 2.5-2.5h3.6l2 2.2h7.4A2.5 2.5 0 0 1 21 10.2V17a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17z" />
      <path d="M8 12.2l2.2 1.8L8 15.8" />
    </>
  ),
  /** A browser window with a pointer on it: the test browser. */
  browser: (
    <>
      <rect x="3" y="4" width="18" height="14" rx="3" />
      <path d="M3 8.5h18M6 6.3h.01M8.5 6.3h.01" />
      <path d="M12.5 12l5.5 2.2-2.3 1 1.6 3-1.4.7-1.6-3-1.8 1.7z" />
    </>
  ),
  /** Three colour cards fanned out: ready-made looks. */
  templates: (
    <>
      <rect x="9.5" y="3.5" width="8" height="13" rx="2" transform="rotate(14 13.5 10)" />
      <rect x="6.5" y="4.5" width="8" height="13" rx="2" />
      <path d="M9 14.5h3M5 20.5h14" />
    </>
  ),
  /** Three sliders: the configuration file. */
  customise: (
    <>
      <path d="M4 7h7M15 7h5M4 12h3M11 12h9M4 17h10M18 17h2" />
      <circle cx="13" cy="7" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="16" cy="17" r="2" />
    </>
  ),
  /** An open folder with an arrow out: show a folder of the app. */
  folders: (
    <>
      <path d="M3 17.5V7.5A2.5 2.5 0 0 1 5.5 5h3.3l2 2.2H17a2.5 2.5 0 0 1 2.5 2.5" />
      <path d="M3.2 18.2l2-6.4a2 2 0 0 1 1.9-1.4h12.4a1.5 1.5 0 0 1 1.4 2l-1.7 5.3a2 2 0 0 1-1.9 1.4H4.6a1.5 1.5 0 0 1-1.4-.9z" />
    </>
  ),
  /** Two keycaps: keyboard shortcuts. */
  shortcuts: (
    <>
      <rect x="2.5" y="8" width="9" height="9" rx="2.5" />
      <rect x="12.5" y="8" width="9" height="9" rx="2.5" />
      <path d="M5.5 14v-3l1.5 1.8L8.5 11v3M15.5 12.5h3M17 11v3" />
    </>
  ),
  /** A clock running backwards: forget the remembered commands. */
  forget: (
    <>
      <path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5" />
      <path d="M4 4.5v3.8h3.8M12 8.5V12l2.5 1.8" />
    </>
  ),
  plus: <path d="M12 6v12M6 12h12" />,
  close: <path d="M7 7l10 10M17 7L7 17" />,
  down: <path d="M7 10l5 5 5-5" />,
  up: <path d="M7 14l5-5 5 5" />,
  right: <path d="M10 7l5 5-5 5" />,
};

export type SidebarIconName = keyof typeof ICONS;

interface SidebarIconProps {
  name: SidebarIconName;
  /** Side of the icon, in units of the font size. */
  size?: number;
}

export function SidebarIcon({ name, size = 1.25 }: SidebarIconProps) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      style={{ width: `${size}em`, height: `${size}em` }}
    >
      {ICONS[name]}
    </svg>
  );
}
