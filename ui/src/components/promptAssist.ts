import type { IDecoration, IDisposable, IMarker, Terminal } from '@xterm/xterm';
import type { Config } from '../ipc';
import { completeCommand, hintFor, type GuideContext, type Hint } from '../stores/guide';
import { TIPS } from '../stores/guideData';
import {
  deleteKeys,
  moveFocus,
  rangeOfSelection,
  readInputLine,
  replaceKeys,
  spanOf,
  suggest,
  type InputLine,
  type Move,
} from '../stores/inputLine';

export interface PromptAssistOptions {
  /** Sends keys to the shell, as if the user had typed them. */
  send: (data: string) => void;
  /** The `[input]` settings, or `null` before the configuration loads. */
  settings: () => Config['input'] | null;
  /** The remembered commands, oldest first. */
  history: () => string[];
  /** Called with each command the user runs. */
  record: (command: string) => void;
  /** What is known about the shell of this terminal. */
  guide: () => GuideContext;
  /** Called when there is something new to say about the line, or nothing any more. */
  onHint: (hint: Hint | null) => void;
}

export interface PromptAssist {
  /** Handles a key press. Returns `true` when the key must not reach the shell. */
  handleKey: (event: KeyboardEvent) => boolean;
  /** Makes the change the current hint proposes. Returns whether there was one. */
  applyFix: () => boolean;
  /** Must be called with the user's input right before it is sent to the shell. */
  beforeInput: (data: string) => void;
  dispose: () => void;
}

const MOVES: Record<string, Move> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  Home: 'home',
  End: 'end',
};

/** Keys that are held, not typed. Pressing one changes nothing by itself. */
const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta']);

/** Which tip the next terminal opens with, so each one shows a different tip. */
let nextTip = 0;

/**
 * Help while typing a command: a suggestion from earlier commands, a line
 * that explains the command, and deleting text by selecting it.
 *
 * It only acts between a prompt and the Enter that runs the command. The
 * shell says where each prompt ends with an invisible mark (see
 * `crates/shell`). Without marks, or while a program is running (an editor,
 * an AI agent, a password question), this does nothing and every key goes
 * to the program untouched.
 *
 * The line is always read from the screen, never rebuilt from key presses.
 * So text the shell does not echo, like a password, is never seen here.
 */
export function attachPromptAssist(term: Terminal, options: PromptAssistOptions): PromptAssist {
  /** Where the prompt ended. `null` when no prompt is waiting for a command. */
  let start: { marker: IMarker; x: number } | null = null;
  /** The ends of a selection made with the keyboard, as indexes in the line. */
  let keyboardSelection: { anchor: number; focus: number } | null = null;
  let ghost: { decoration: IDecoration; marker: IMarker; rest: string; key: string } | null = null;
  /** What the view was last told about the line. */
  let hint: Hint | null = null;
  /** The tip of this terminal, shown at its prompt until a first command runs. */
  const tip: Hint = { tone: 'info', text: TIPS[nextTip++ % TIPS.length]! };
  let ranCommand = false;
  let frame = 0;

  const leavePrompt = () => {
    start?.marker.dispose();
    start = null;
    keyboardSelection = null;
    clearGhost();
    showHint(null);
  };

  /** Tells the view about `next`, unless it is what the view already shows. */
  function showHint(next: Hint | null) {
    const same =
      next?.text === hint?.text &&
      next?.subject === hint?.subject &&
      next?.fix?.text === hint?.fix?.text;
    hint = next;
    if (!same) options.onHint(next);
  }

  /** What there is to say about `line`: its hint, or the tip while it is empty. */
  function hintOf(line: InputLine): Hint | null {
    if (line.text.trim()) return hintFor(line.text, options.guide());
    return ranCommand ? null : tip;
  }

  /** Replaces the part of the line the hint points at with what it proposes. */
  function applyFix(): boolean {
    const line = currentLine();
    // Worked out again from the line as it is now: the hint on screen may
    // be one frame behind the shell.
    const fix = line && options.settings()?.hints ? hintOf(line)?.fix : undefined;
    if (!line || !fix) return false;
    options.send(replaceKeys(line.cursor, fix, fix.text, term.modes.applicationCursorKeysMode));
    term.clearSelection();
    keyboardSelection = null;
    return true;
  }

  /** The command line on screen right now, or `null` when there is none to trust. */
  function currentLine(): InputLine | null {
    const buffer = term.buffer.active;
    // The other screen belongs to full-screen programs; markers do not apply.
    if (!start || start.marker.isDisposed || start.marker.line < 0 || buffer.type !== 'normal') {
      return null;
    }
    return readInputLine(
      buffer,
      { x: start.x, y: start.marker.line },
      { x: buffer.cursorX, y: buffer.baseY + buffer.cursorY },
      term.cols,
    );
  }

  function clearGhost() {
    ghost?.decoration.dispose();
    ghost?.marker.dispose();
    ghost = null;
  }

  /** Shows, hides or moves the suggestion to match the line on screen. */
  function refresh() {
    frame = 0;
    const settings = options.settings();
    const line = currentLine();
    showHint(settings?.hints && line ? hintOf(line) : null);
    // Only at the end of the line: a suggestion in the middle of the text
    // would cover what is already typed. And not over a suggestion the
    // shell draws itself (PowerShell, fish): two texts on the same cells.
    const atEnd = line !== null && line.cursor === line.chars.length && !line.shellHint;
    // The user's own commands first; a common command when none fits.
    const rest =
      settings?.suggestions && atEnd && !term.hasSelection()
        ? (suggest(options.history(), line.text) ?? completeCommand(line.text, options.guide()))
        : null;
    const buffer = term.buffer.active;
    const room = term.cols - buffer.cursorX;
    if (!rest || room <= 0) return clearGhost();

    const shown = [...rest].slice(0, room);
    const key = `${buffer.baseY + buffer.cursorY}:${buffer.cursorX}:${rest}`;
    if (ghost?.key === key) return;
    clearGhost();

    const marker = term.registerMarker(0);
    const decoration = term.registerDecoration({
      marker,
      x: buffer.cursorX,
      width: shown.length,
    });
    if (!decoration) return marker.dispose();
    decoration.onRender((element) => paintGhost(element, shown));
    ghost = { decoration, marker, rest, key };
  }

  /** Draws the suggestion, one box per character so it lines up with the grid. */
  function paintGhost(element: HTMLElement, shown: string[]) {
    const text = shown.join('');
    if (element.dataset.ghost === text) return;
    element.dataset.ghost = text;
    element.classList.add('term-ghost');
    element.style.fontFamily = term.options.fontFamily ?? '';
    element.style.fontSize = `${term.options.fontSize}px`;
    element.style.lineHeight = element.style.height;
    element.replaceChildren(
      ...shown.map((char) => {
        const box = document.createElement('span');
        box.textContent = char;
        // A glyph is a little wider or narrower than a cell. Left to its own
        // width, each character would drift further from the grid.
        box.style.width = `${100 / shown.length}%`;
        return box;
      }),
    );
  }

  const scheduleRefresh = () => {
    if (!frame) frame = requestAnimationFrame(refresh);
  };

  /** Extends the keyboard selection by one move and shows it. */
  function select(line: InputLine, move: Move) {
    // A selection made or cleared with the mouse replaces the keyboard one.
    if (!term.hasSelection()) keyboardSelection = null;
    const current = keyboardSelection ?? { anchor: line.cursor, focus: line.cursor };
    const focus = moveFocus(line, Math.min(current.focus, line.chars.length), move);
    keyboardSelection = { anchor: current.anchor, focus };
    if (focus === current.anchor) return term.clearSelection();
    const span = spanOf(
      line,
      { from: Math.min(current.anchor, focus), to: Math.max(current.anchor, focus) },
      term.cols,
    );
    term.select(span.x, span.y, span.length);
  }

  /** Deletes the selected part of the line. Returns whether there was one. */
  function deleteSelection(line: InputLine): boolean {
    const selection = term.getSelectionPosition();
    if (!selection) return false;
    // xterm.js gives the start cell and the cell after the end, counted from 0.
    const range = rangeOfSelection(line, selection.start, selection.end);
    if (!range) return false;
    options.send(deleteKeys(line.cursor, range, term.modes.applicationCursorKeysMode));
    term.clearSelection();
    keyboardSelection = null;
    return true;
  }

  const subscriptions: IDisposable[] = [
    // OSC 133 are the prompt marks: A before the prompt, B after it.
    term.parser.registerOscHandler(133, (data) => {
      if (data.startsWith('B')) {
        leavePrompt();
        start = { marker: term.registerMarker(0), x: term.buffer.active.cursorX };
        scheduleRefresh();
      }
      return true;
    }),
    term.onWriteParsed(scheduleRefresh),
    term.onCursorMove(scheduleRefresh),
    term.onSelectionChange(scheduleRefresh),
  ];

  return {
    handleKey(event) {
      const settings = options.settings();
      if (!settings || MODIFIER_KEYS.has(event.key)) return false;
      const plain = !event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey;

      if (event.key === 'ArrowRight' && plain && ghost) {
        options.send(ghost.rest);
        clearGhost();
        return true;
      }
      // Ctrl+. is the "quick fix" key of code editors, and no shell uses it.
      const onlyCtrl = event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey;
      if (event.key === '.' && onlyCtrl && hint?.fix) return applyFix();

      const line = currentLine();
      if (!line) return false;

      const held = settings.select_with === 'ctrl' ? event.ctrlKey : event.shiftKey;
      const others =
        (settings.select_with === 'ctrl' ? event.shiftKey : event.ctrlKey) ||
        event.altKey ||
        event.metaKey;
      const move = MOVES[event.key];
      if (move && held && !others) {
        select(line, move);
        return true;
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && plain) {
        return deleteSelection(line);
      }
      if (event.key === 'Escape' && plain && keyboardSelection) {
        keyboardSelection = null;
        term.clearSelection();
        return true;
      }
      // Any other key ends the keyboard selection; xterm.js clears the
      // highlight itself when the user types.
      keyboardSelection = null;
      return false;
    },

    applyFix,

    beforeInput(data) {
      // Enter runs the command. Shift+Enter arrives as Escape + Enter and
      // shells treat it the same.
      if (data === '\r' || data === '\x1b\r') {
        const line = currentLine();
        if (line && line.text.trim()) {
          options.record(line.text);
          ranCommand = true;
        }
        leavePrompt();
      } else if (data === '\x03') {
        // Ctrl+C abandons the line. The next prompt brings a new mark.
        leavePrompt();
      }
    },

    dispose() {
      if (frame) cancelAnimationFrame(frame);
      subscriptions.forEach((subscription) => subscription.dispose());
      leavePrompt();
    },
  };
}
