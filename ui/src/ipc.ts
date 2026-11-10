/**
 * Typed bridge to the Rust side. This is the only file that knows command and
 * event names; the rest of the UI calls these functions.
 *
 * The types mirror the Rust structs in `crates/`.
 */
import { Channel, invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { openUrl } from '@tauri-apps/plugin-opener';

/** A shell the terminal can open in a tab. */
export interface ShellProfile {
  /** Stable key, also used as `default_shell` in the configuration file. */
  id: string;
  name: string;
  program: string;
  args: string[];
}

/** The user's configuration file, with defaults filled in. */
export interface Config {
  version: number;
  default_shell: string | null;
  scrollback: number;
  /** Space between the text and the edge of the window, in pixels. */
  padding: number;
  font: { family: string; size: number; line_height: number };
  cursor: { style: 'block' | 'bar' | 'underline'; blink: boolean };
  theme: {
    preset: string;
    background: string;
    foreground: string;
    cursor: string;
    selection: string;
    accent: string;
    /** The 16 numbered colours: black to white, then the bright ones. */
    ansi: string[];
  };
  /** `image` is a path, empty for none. `dim` goes from 0 (image) to 1 (colour). */
  background: { image: string; dim: number };
  browser: { port: number };
  /** Agents or tools the user added to the new-tab menu. */
  agents: { name: string; command: string }[];
}

/** A known AI agent (Claude Code, Codex...) and whether this machine has it. */
export interface AgentStatus {
  id: string;
  name: string;
  /** What to type in a shell to start it. */
  command: string;
  installed: boolean;
  /** Command that installs it, or `null` when npm is missing. */
  install_command: string | null;
  website: string;
}

/** A developer tool (Node.js, Docker) and whether this machine has it. */
export interface ToolStatus {
  id: string;
  name: string;
  /** The commands the user gains, for example "node, npm, npx". */
  provides: string;
  installed: boolean;
  /** Command that installs it here, or `null` when only `website` can help. */
  install_command: string | null;
  website: string;
}

/** The saved projects, as the Rust side stores them. */
export interface Workspace {
  projects: {
    id: string;
    name: string;
    path: string;
    terminals: { title: string; shell_id: string; command: string | null }[];
  }[];
}

/** The browser AI agents drive to test web apps. */
export interface BrowserStatus {
  /** Name of the browser found on this machine, or `null` when there is none. */
  browser: string | null;
  running: boolean;
  /** Address agents connect to while it runs. */
  endpoint: string;
  /** One-time commands that register the browser with each agent. */
  connectors: { agent_id: string; command: string }[];
}

export const listShells = () => invoke<ShellProfile[]>('list_shells');

/** Checks the machine again on every call. */
export const listTools = () => invoke<ToolStatus[]>('list_tools');

/** Checks the machine again on every call. */
export const listAgents = () => invoke<AgentStatus[]>('list_agents');

export const getConfig = () => invoke<Config>('get_config');

/** Opens the configuration file in the user's editor. */
export const openConfigFile = () => invoke<void>('open_config_file');

/** The background picture named in the configuration, as raw bytes. */
export const readBackground = () => invoke<ArrayBuffer>('read_background');

export const loadWorkspace = () => invoke<Workspace>('load_workspace');

export const saveWorkspace = (workspace: Workspace) =>
  invoke<void>('save_workspace', { workspace });

/** Asks the user for a folder. Resolves with `null` when they cancel. */
export const pickFolder = () => invoke<string | null>('pick_folder');

export const browserStatus = () => invoke<BrowserStatus>('browser_status');

/** Starts the test browser. Rejects with the reason when it cannot start. */
export const browserOpen = () => invoke<BrowserStatus>('browser_open');

export const browserClose = () => invoke<BrowserStatus>('browser_close');

/**
 * Opens a link printed in the terminal in the system browser. Program output
 * is not trusted: only web links are opened, never files or other schemes.
 */
export async function openExternal(url: string): Promise<void> {
  const scheme = url.slice(0, url.indexOf(':')).toLowerCase();
  if (scheme === 'http' || scheme === 'https') await openUrl(url);
}

/** Runs `handler` with the new configuration after each valid edit of the file. */
export const onConfigChanged = (handler: (config: Config) => void): Promise<UnlistenFn> =>
  listen<Config>('config-changed', (event) => handler(event.payload));

/** Runs `handler` with a message when the edited file has an error. */
export const onConfigError = (handler: (message: string) => void): Promise<UnlistenFn> =>
  listen<string>('config-error', (event) => handler(event.payload));

export interface SpawnPtyOptions {
  shellId: string;
  /** Project whose folder the shell starts in. `null` means the home folder. */
  projectId: string | null;
  cols: number;
  rows: number;
  /** Raw output. A chunk can end in the middle of a character. */
  onData: (bytes: Uint8Array) => void;
  /** Exit code, or `null` if it could not be read. */
  onExit: (code: number | null) => void;
}

/** Starts a shell and resolves with the id of its session. */
export function spawnPty({ shellId, projectId, cols, rows, onData, onExit }: SpawnPtyOptions) {
  // Output arrives as binary; small chunks may come as a plain number array.
  const dataChannel = new Channel<ArrayBuffer | number[]>((chunk) => onData(new Uint8Array(chunk)));
  const exitChannel = new Channel<number | null>(onExit);
  return invoke<number>('pty_spawn', {
    shellId,
    projectId,
    cols,
    rows,
    onData: dataChannel,
    onExit: exitChannel,
  });
}

export const writePty = (id: number, data: string) => invoke<void>('pty_write', { id, data });

export const resizePty = (id: number, cols: number, rows: number) =>
  invoke<void>('pty_resize', { id, cols, rows });

/** Ends a session and frees it. Safe to call after the shell exited. */
export const killPty = (id: number) => invoke<void>('pty_kill', { id });
