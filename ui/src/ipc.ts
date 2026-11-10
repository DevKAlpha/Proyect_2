/**
 * Typed bridge to the Rust side. This is the only file that knows command and
 * event names; the rest of the UI calls these functions.
 *
 * The types mirror the Rust structs in `crates/shell` and `crates/config`.
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
  font: { family: string; size: number; line_height: number };
  theme: {
    background: string;
    foreground: string;
    cursor: string;
    selection: string;
    accent: string;
  };
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

export const listShells = () => invoke<ShellProfile[]>('list_shells');

/** Checks the machine again on every call. */
export const listTools = () => invoke<ToolStatus[]>('list_tools');

/** Checks the machine again on every call. */
export const listAgents = () => invoke<AgentStatus[]>('list_agents');

export const getConfig = () => invoke<Config>('get_config');

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
  cols: number;
  rows: number;
  /** Raw output. A chunk can end in the middle of a character. */
  onData: (bytes: Uint8Array) => void;
  /** Exit code, or `null` if it could not be read. */
  onExit: (code: number | null) => void;
}

/** Starts a shell and resolves with the id of its session. */
export function spawnPty({ shellId, cols, rows, onData, onExit }: SpawnPtyOptions) {
  // Output arrives as binary; small chunks may come as a plain number array.
  const dataChannel = new Channel<ArrayBuffer | number[]>((chunk) => onData(new Uint8Array(chunk)));
  const exitChannel = new Channel<number | null>(onExit);
  return invoke<number>('pty_spawn', {
    shellId,
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
