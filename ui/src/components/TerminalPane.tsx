import { useEffect, useRef } from 'react';
import { readText, writeText } from '@tauri-apps/plugin-clipboard-manager';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { Terminal, type ITerminalOptions } from '@xterm/xterm';
import { killPty, resizePty, spawnPty, writePty, type Config } from '../ipc';
import { useSettings } from '../stores/settings';
import { useTabs, type Tab } from '../stores/tabs';

/** The part of the user's configuration that xterm.js draws. */
function terminalOptions(config: Config): ITerminalOptions {
  return {
    fontFamily: config.font.family,
    fontSize: config.font.size,
    scrollback: config.scrollback,
    theme: {
      background: config.theme.background,
      foreground: config.theme.foreground,
      cursor: config.theme.cursor,
      selectionBackground: config.theme.selection,
    },
  };
}

/**
 * Copy and paste keys. Returns `false` for the keys it handles so xterm.js
 * does not also send them to the shell.
 *
 * Ctrl+C copies only when text is selected; otherwise it stays the interrupt
 * key. Ctrl+Shift+C and Ctrl+Shift+V always mean copy and paste.
 */
function clipboardKeys(term: Terminal) {
  return (event: KeyboardEvent): boolean => {
    if (event.type !== 'keydown' || !event.ctrlKey || event.altKey) return true;
    const key = event.key.toLowerCase();

    if (key === 'c' && (event.shiftKey || term.hasSelection())) {
      event.preventDefault();
      if (term.hasSelection()) {
        void writeText(term.getSelection());
        term.clearSelection();
      }
      return false;
    }
    if (key === 'v') {
      // Without this the webview would paste a second time by itself.
      event.preventDefault();
      void readText().then((text) => text && term.paste(text));
      return false;
    }
    return true;
  };
}

interface TerminalPaneProps {
  tab: Tab;
  active: boolean;
}

/**
 * One tab: an xterm.js screen bound to one shell session.
 *
 * Inactive panes stay mounted but hidden, so their screen and history survive
 * a tab switch. The shell lives exactly as long as the pane.
 */
export function TerminalPane({ tab, active }: TerminalPaneProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const config = useSettings((state) => state.config);

  // Create the screen and its shell once per tab.
  useEffect(() => {
    const host = hostRef.current;
    const initialConfig = useSettings.getState().config;
    if (!host || !initialConfig) return;

    const term = new Terminal({ ...terminalOptions(initialConfig), cursorBlink: true });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);
    try {
      const webgl = new WebglAddon();
      // The GPU can drop the context (sleep, driver update); xterm.js then
      // falls back to its DOM renderer.
      webgl.onContextLoss(() => webgl.dispose());
      term.loadAddon(webgl);
    } catch {
      // No WebGL2 on this machine: the DOM renderer is already active.
    }
    fit.fit();
    term.attachCustomKeyEventHandler(clipboardKeys(term));
    termRef.current = term;
    fitRef.current = fit;

    let disposed = false;
    let sessionId: number | null = null;
    // Input produced before the session id is known. It cannot be dropped:
    // on Windows the shell asks for the cursor position at start and waits
    // for the answer xterm.js sends back.
    let earlyInput = '';

    spawnPty({
      shellId: tab.shellId,
      cols: term.cols,
      rows: term.rows,
      onData: (bytes) => term.write(bytes),
      // A pane that is already gone killed its own shell (see the cleanup
      // below); that exit must not close the tab a second time.
      onExit: () => {
        if (!disposed) useTabs.getState().close(tab.id);
      },
    })
      .then((id) => {
        // The tab was closed while the shell was starting.
        if (disposed) return void killPty(id);
        sessionId = id;
        if (earlyInput) void writePty(id, earlyInput);
        earlyInput = '';
        // The window may have been resized in the meantime.
        void resizePty(id, term.cols, term.rows);
      })
      .catch((error: unknown) => {
        term.writeln(`\x1b[31mNo se pudo iniciar el shell: ${String(error)}\x1b[0m`);
      });

    const input = term.onData((data) => {
      if (sessionId === null) earlyInput += data;
      else void writePty(sessionId, data);
    });
    const resize = term.onResize(({ cols, rows }) => {
      if (sessionId !== null) void resizePty(sessionId, cols, rows);
    });
    // A hidden pane has no size; fitting it would shrink the grid to nothing.
    const observer = new ResizeObserver(() => {
      if (host.clientWidth > 0 && host.clientHeight > 0) fit.fit();
    });
    observer.observe(host);

    return () => {
      disposed = true;
      observer.disconnect();
      input.dispose();
      resize.dispose();
      if (sessionId !== null) void killPty(sessionId);
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [tab.id, tab.shellId]);

  // Apply configuration edits to the open screen.
  useEffect(() => {
    const term = termRef.current;
    if (!term || !config) return;
    Object.assign(term.options, terminalOptions(config));
    fitRef.current?.fit();
  }, [config]);

  useEffect(() => {
    if (active) termRef.current?.focus();
  }, [active]);

  return (
    <div
      role="tabpanel"
      id={`panel-${tab.id}`}
      aria-labelledby={`tab-${tab.id}`}
      className={active ? 'absolute inset-0 p-2' : 'hidden'}
    >
      <div ref={hostRef} className="h-full w-full" />
    </div>
  );
}
