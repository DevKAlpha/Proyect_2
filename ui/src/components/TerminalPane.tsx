import { useEffect, useRef, useState } from 'react';
import { readText, writeText } from '@tauri-apps/plugin-clipboard-manager';
import { FitAddon } from '@xterm/addon-fit';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { WebglAddon } from '@xterm/addon-webgl';
import { Terminal, type ITerminalOptions } from '@xterm/xterm';
import {
  clipboardPaste,
  killPty,
  onFilesDropped,
  openExternal,
  openFolder,
  pathsExist,
  resizePty,
  revealPath,
  sessionPlace,
  spawnPty,
  writePty,
  type Config,
  type Place,
} from '../ipc';
import type { Hint } from '../stores/guide';
import { useHistory } from '../stores/history';
import { pathsToInput, planPaste } from '../stores/paste';
import { usePrograms } from '../stores/programs';
import { useRemote } from '../stores/remote';
import { effectiveFontSize, loadFonts, useSettings } from '../stores/settings';
import { useTabs, type Tab } from '../stores/tabs';
import { showsWorking } from '../stores/working';
import { terminalTheme } from '../stores/theme';
import { HintBar } from './HintBar';
import { attachPathLinks } from './pathLinks';
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
 * key. Ctrl+Shift+C and Ctrl+Shift+V always mean copy and paste. `paste`
 * reads the clipboard, which can hold files or a picture as well as text.
 */
function terminalKeys(term: Terminal, assist: PromptAssist, paste: () => void) {
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
      paste();
      return false;
    }
    return true;
  };
}

interface TerminalPaneProps {
  tab: Tab;
  active: boolean;
  /**
   * Where the pane is drawn inside the work area, as CSS lengths: the whole
   * of it, or one half of a split. `null` keeps the pane mounted and hidden.
   */
  frame: { left: string; width: string } | null;
  /** Marks the pane as the one with the keyboard. Only needed when two are on screen. */
  marked: boolean;
  /** Opens a terminal on another machine over SSH: `machine` or `user@machine`. */
  onConnect: (target: string) => void;
}

/**
 * One tab: an xterm.js screen bound to one shell session.
 *
 * Inactive panes stay mounted but hidden, so their screen and history survive
 * a tab switch. The shell lives exactly as long as the pane.
 */
export function TerminalPane({ tab, active, frame, marked, onConnect }: TerminalPaneProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const assistRef = useRef<PromptAssist | null>(null);
  // Whether this pane is the one on screen, for events that reach every pane.
  const activeRef = useRef(active);
  // What the line under the terminal says about the command being typed.
  const [hint, setHint] = useState<Hint | null>(null);
  // The session of this pane, for the buttons of the bar under it.
  const sessionRef = useRef<number | null>(null);
  // The folder the shell is in and its Git branch.
  const [place, setPlace] = useState<Place | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // When the command running now started, while the duck should swim for it.
  const [working, setWorking] = useState<number | null>(null);
  // A paste of several lines that waits for the user's yes.
  const [pendingPaste, setPendingPaste] = useState<{ text: string; lines: number } | null>(null);
  /** Answers the question about a paste and gives the keyboard back. */
  const endPaste = (accepted: boolean) => {
    if (accepted && pendingPaste) termRef.current?.paste(pendingPaste.text);
    setPendingPaste(null);
    termRef.current?.focus();
  };
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
      linkHandler: { activate: (event, url) => openLink(event, url) },
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
      onRun: (command) => setWorking(showsWorking(command) ? Date.now() : null),
      // The prompt is back: the command finished.
      onPrompt: () => {
        setWorking(null);
        refreshPlace();
      },
    });
    // Another program can change the branch while this window is in the
    // background (an editor, a Git client).
    window.addEventListener('focus', refreshPlace);
    assistRef.current = assist;

    // Files go into a terminal as their paths, written for its shell. That
    // is how programs take them, AI agents included: a pasted picture path
    // becomes an attached picture.
    const insertFiles = (paths: string[]) => {
      const { text, skipped } = pathsToInput(paths, tab.shellId);
      if (text) term.paste(text);
      if (skipped > 0) {
        setNotice(
          skipped === 1
            ? 'Se omitió 1 vídeo: los vídeos aún no se pueden pegar.'
            : `Se omitieron ${skipped} vídeos: los vídeos aún no se pueden pegar.`,
        );
      }
    };
    // Text is pasted at once only when it cannot run anything by itself.
    // Several lines into a shell that takes each line end as Enter wait
    // for the user to say yes.
    const pasteText = (text: string) => {
      const plan = planPaste(text, term.modes.bracketedPasteMode);
      if (plan.lines > 1) setPendingPaste(plan);
      else if (plan.text) term.paste(plan.text);
    };
    const paste = () => {
      clipboardPaste()
        .then((pasted) => {
          if (disposed) return;
          if (pasted.text) pasteText(pasted.text);
          else insertFiles(pasted.paths);
        })
        // The clipboard could not be read in full: text alone still can be.
        .catch(() => void readText().then((text) => text && !disposed && pasteText(text)));
    };
    // A drop lands on the window, and only the terminal on screen takes it.
    // Paths in the output are links to the file manager; web addresses, to
    // the browser. Neither ever opens a file with its program: output is
    // not trusted, and a file that is a program would run.
    const reveal = (path: string) => {
      if (sessionId === null) return;
      revealPath(sessionId, tab.shellId, path).catch(() =>
        setNotice('No se pudo mostrar: ya no existe o no está en este equipo.'),
      );
    };
    function openLink(event: MouseEvent, url: string) {
      if (!/^file:/i.test(url)) return followLink(event, url);
      if (event.ctrlKey || event.metaKey) reveal(url);
    }
    const pathLinks = attachPathLinks(term, {
      exist: (paths) =>
        sessionId === null ? Promise.resolve([]) : pathsExist(sessionId, tab.shellId, paths),
      reveal,
    });
    const dropped = onFilesDropped((paths) => {
      if (activeRef.current) insertFiles(paths);
    });
    term.attachCustomKeyEventHandler(terminalKeys(term, assist, paste));
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
    // A program the user types into is talking with them, not working on
    // its own (a question, a console). Neither is one that takes the whole
    // screen (an editor, a pager). The duck leaves both alone.
    const typed = term.onKey(({ domEvent }) => {
      if (domEvent.key !== 'Enter') setWorking(null);
    });
    const screens = term.buffer.onBufferChange((buffer) => {
      if (buffer.type === 'alternate') setWorking(null);
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
      void dropped.then((stop) => stop()).catch(() => {});
      pathLinks.dispose();
      assist.dispose();
      assistRef.current = null;
      sessionRef.current = null;
      input.dispose();
      typed.dispose();
      screens.dispose();
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
    activeRef.current = active;
    if (active) termRef.current?.focus();
  }, [active]);

  return (
    <div
      role="tabpanel"
      id={`panel-${tab.id}`}
      aria-labelledby={`tab-${tab.id}`}
      className={
        frame
          ? `absolute inset-y-0 flex flex-col ${marked ? 'shadow-[inset_0_2px_0_var(--term-accent)]' : ''}`
          : 'hidden'
      }
      style={{ padding: config?.padding ?? 8, ...frame }}
      // In a split, a click on the other half gives it the keyboard.
      onMouseDownCapture={() => {
        if (!active) useTabs.getState().activate(tab.id);
      }}
    >
      <div ref={hostRef} className="min-h-0 w-full flex-1" />
      {pendingPaste && (
        <div
          role="alertdialog"
          aria-label="Confirmar el pegado"
          className="flex items-center gap-3 bg-fg/10 px-3 py-2 text-sm"
          onKeyDown={(event) => {
            if (event.key === 'Escape') endPaste(false);
          }}
        >
          <p className="min-w-0 flex-1">
            Vas a pegar {pendingPaste.lines} líneas. Este shell ejecuta cada línea al pegarla, sin
            esperar a Enter.
          </p>
          <button
            type="button"
            // The safe answer has the keyboard: Enter by reflex pastes nothing.
            autoFocus
            onClick={() => endPaste(false)}
            className="shrink-0 rounded border border-fg/30 px-2 py-0.5 outline-none hover:bg-fg/10 focus-visible:ring-2 focus-visible:ring-accent"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => endPaste(true)}
            className="shrink-0 rounded border border-fg/30 px-2 py-0.5 outline-none hover:bg-fg/10 focus-visible:ring-2 focus-visible:ring-accent"
          >
            Pegar y ejecutar
          </button>
        </div>
      )}
      {config?.input.hints && (
        <HintBar
          hint={hint}
          working={working}
          ansi={config.theme.ansi}
          visible={frame !== null}
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
