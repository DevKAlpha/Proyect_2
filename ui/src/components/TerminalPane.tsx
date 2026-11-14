import { useEffect, useRef, useState } from 'react';
import { readText, writeText } from '@tauri-apps/plugin-clipboard-manager';
import { FitAddon } from '@xterm/addon-fit';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { WebglAddon } from '@xterm/addon-webgl';
import { Terminal, type ITerminalOptions } from '@xterm/xterm';
import {
  killPty,
  openExternal,
  openFolder,
  resizePty,
  sessionPlace,
  spawnPty,
  writePty,
  type Config,
  type Place,
} from '../ipc';
import type { Hint } from '../stores/guide';
import { useHistory } from '../stores/history';
import { usePrograms } from '../stores/programs';
import { useRemote } from '../stores/remote';
import { effectiveFontSize, loadFonts, useSettings } from '../stores/settings';
import { useTabs, type Tab } from '../stores/tabs';
import { terminalTheme } from '../stores/theme';
import { HintBar } from './HintBar';
import { attachPromptAssist, type PromptAssist } from './promptAssist';
import { StatusBar } from './StatusBar';

/**
 * Opens a link from the terminal. Ctrl (or Cmd) must be held, as in other
 * terminals: a plain click is how text is selected and must not leave the app.
 */
function followLink(event: MouseEvent, url: string) {
  if (event.ctrlKey || event.metaKey) void openExternal(url);
}

/**
 * The part of the user's configuration that xterm.js draws. `seeThrough`
 * says whether this screen was opened able to show a picture behind it.
 */
function terminalOptions(config: Config, zoom: number, seeThrough: boolean): ITerminalOptions {
  return {
    fontFamily: config.font.family,
    fontSize: effectiveFontSize(config.font.size, zoom),
    lineHeight: config.font.line_height,
    fontWeight: '400',
    fontWeightBold: '700',
    // Programs often print dim grey on dark; this lifts such text to a
    // readable contrast (WCAG AA) without touching colours that already pass.
    minimumContrastRatio: 4.5,
    scrollback: config.scrollback,
    cursorStyle: config.cursor.style,
    cursorBlink: config.cursor.blink,
    theme: terminalTheme(config, seeThrough),
  };
}

/**
 * Keys the terminal handles itself. Returns `false` for them so xterm.js
 * does not also send them to the shell.
 *
 * Shift+Enter is sent as Escape + Enter. A terminal has no code of its own
 * for it, and this is the one AI agents (Claude Code and others) read as
 * "new line, do not send yet". Shells treat it as a plain Enter.
 *
 * Ctrl+C copies only when text is selected; otherwise it stays the interrupt
 * key. Ctrl+Shift+C and Ctrl+Shift+V always mean copy and paste.
 */
function terminalKeys(term: Terminal, assist: PromptAssist) {
  return (event: KeyboardEvent): boolean => {
    // Suggestions and editing by selection come first: they only take a key
    // while the user is typing a command at a prompt.
    if (event.type === 'keydown' && assist.handleKey(event)) {
      event.preventDefault();
      return false;
    }
    if (event.key === 'Enter' && event.shiftKey && !event.ctrlKey && !event.altKey) {
      // Also swallow the key press and key up, or Enter would follow.
      if (event.type === 'keydown') term.input('\x1b\r', true);
      return false;
    }
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
  /** Opens a terminal on another machine over SSH: `machine` or `user@machine`. */
  onConnect: (target: string) => void;
}

/**
 * One tab: an xterm.js screen bound to one shell session.
 *
 * Inactive panes stay mounted but hidden, so their screen and history survive
 * a tab switch. The shell lives exactly as long as the pane.
 */
export function TerminalPane({ tab, active, onConnect }: TerminalPaneProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const assistRef = useRef<PromptAssist | null>(null);
  // What the line under the terminal says about the command being typed.
  const [hint, setHint] = useState<Hint | null>(null);
  // The session of this pane, for the buttons of the bar under it.
  const sessionRef = useRef<number | null>(null);
  // The folder the shell is in and its Git branch.
  const [place, setPlace] = useState<Place | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Whether this screen can show a picture behind it. xterm.js fixes that
  // when a screen opens, so it is remembered for later theme changes.
  const seeThroughRef = useRef(false);
  const config = useSettings((state) => state.config);
  const zoom = useSettings((state) => state.zoom);
  const remoteAvailable = useRemote((state) => state.available);
  const hosts = useRemote((state) => state.hosts);

  // Create the screen and its shell once per tab.
  useEffect(() => {
    const host = hostRef.current;
    const initial = useSettings.getState();
    if (!host || !initial.config) return;

    // Blending with a picture costs drawing time, so only screens opened
    // while a picture is set pay for it.
    const seeThrough = initial.backgroundUrl !== null;
    seeThroughRef.current = seeThrough;
    const term = new Terminal({
      ...terminalOptions(initial.config, initial.zoom, seeThrough),
      allowTransparency: seeThrough,
      // Needed by the Unicode addon below.
      allowProposedApi: true,
      // Links that programs mark themselves (OSC 8), common in agent output.
      linkHandler: { activate: followLink },
    });
    // Agents draw their screens with emoji and wide characters. Without the
    // current width tables the cursor drifts and boxes break.
    term.loadAddon(new Unicode11Addon());
    term.unicode.activeVersion = '11';
    // Plain web addresses in the output, for example a sign-in link.
    term.loadAddon(new WebLinksAddon(followLink));
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
    termRef.current = term;
    fitRef.current = fit;

    let disposed = false;
    let sessionId: number | null = null;
    // Input produced before the session id is known. It cannot be dropped:
    // on Windows the shell asks for the cursor position at start and waits
    // for the answer xterm.js sends back.
    let earlyInput = '';
    const send = (data: string) => {
      if (sessionId === null) earlyInput += data;
      else void writePty(sessionId, data);
    };

    // Asks where the shell is now. A command may have changed the folder or
    // the branch, so this runs at every prompt.
    const refreshPlace = () => {
      if (sessionId === null) return;
      sessionPlace(sessionId)
        .then((next) => {
          if (disposed) return;
          setPlace(next);
          setNotice(null);
        })
        // The bar keeps what it showed: a place that cannot be read is not
        // worth interrupting the user for.
        .catch(() => {});
    };

    const assist = attachPromptAssist(term, {
      send,
      settings: () => useSettings.getState().config?.input ?? null,
      history: () => useHistory.getState().entries,
      record: (command) => void useHistory.getState().record(command),
      guide: () => ({
        shell: tab.shellId,
        programs: usePrograms.getState().byShell[tab.shellId] ?? null,
      }),
      onHint: setHint,
      onPrompt: refreshPlace,
    });
    // Another program can change the branch while this window is in the
    // background (an editor, a Git client).
    window.addEventListener('focus', refreshPlace);
    assistRef.current = assist;
    term.attachCustomKeyEventHandler(terminalKeys(term, assist));
    // A program installed a moment ago starts to work in this new terminal,
    // so this is when the list of programs is read again.
    void usePrograms.getState().refresh(tab.shellId);

    spawnPty({
      shellId: tab.shellId,
      projectId: tab.projectId,
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
        sessionRef.current = id;
        // The folder it starts in, before the shell says anything.
        refreshPlace();
        // The answer to the shell's start-up question goes first, then the
        // command. The shell reads the command when it is ready for input.
        const command = tab.initialCommand ? `${tab.initialCommand}\r` : '';
        if (earlyInput || command) void writePty(id, earlyInput + command);
        earlyInput = '';
        // The window may have been resized in the meantime.
        void resizePty(id, term.cols, term.rows);
      })
      .catch((error: unknown) => {
        term.writeln(`\x1b[31mNo se pudo iniciar el shell: ${String(error)}\x1b[0m`);
      });

    const input = term.onData((data) => {
      // The line is read from the screen before Enter makes the shell move on.
      assist.beforeInput(data);
      send(data);
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
      window.removeEventListener('focus', refreshPlace);
      assist.dispose();
      assistRef.current = null;
      sessionRef.current = null;
      input.dispose();
      resize.dispose();
      if (sessionId !== null) void killPty(sessionId);
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [tab.id, tab.shellId, tab.projectId, tab.initialCommand]);

  // Apply configuration edits and zoom to the open screen.
  useEffect(() => {
    const term = termRef.current;
    if (!term || !config) return;
    Object.assign(term.options, terminalOptions(config, zoom, seeThroughRef.current));
    fitRef.current?.fit();
    // A newly chosen font may still be loading: glyphs drawn before it
    // arrived are cached with the fallback font and must be drawn again.
    void loadFonts(config.font.family).then(() => {
      if (termRef.current !== term) return;
      term.clearTextureAtlas();
      fitRef.current?.fit();
    });
  }, [config, zoom]);

  useEffect(() => {
    if (active) termRef.current?.focus();
  }, [active]);

  return (
    <div
      role="tabpanel"
      id={`panel-${tab.id}`}
      aria-labelledby={`tab-${tab.id}`}
      className={active ? 'absolute inset-0 flex flex-col' : 'hidden'}
      style={{ padding: config?.padding ?? 8 }}
    >
      <div ref={hostRef} className="min-h-0 w-full flex-1" />
      {config?.input.hints && (
        <HintBar
          hint={hint}
          // The fourth numbered colour is yellow.
          warningColor={config.theme.ansi[3] ?? config.theme.foreground}
          onFix={() => assistRef.current?.applyFix()}
        />
      )}
      <StatusBar
        place={place}
        notice={notice}
        remoteAvailable={remoteAvailable}
        hosts={hosts}
        onConnect={onConnect}
        onCancel={() => termRef.current?.focus()}
        onOpenFolder={() => {
          const id = sessionRef.current;
          if (id === null) return;
          // Rust answers in English; the reason shown is the one that
          // happens in practice.
          openFolder(id).catch(() => setNotice('No se pudo abrir la carpeta: ya no existe.'));
        }}
      />
    </div>
  );
}
