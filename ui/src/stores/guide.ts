/**
 * Help with the command being typed: what it does, whether it belongs to
 * another system, a likely typing mistake, a warning before something that
 * is easy to regret.
 *
 * Pure functions over the text of the line. Everything they know comes from
 * `guideData.ts` and from the list of programs installed on this machine.
 * No network and no AI: the answer is the same every time and nothing the
 * user types leaves the app.
 */
import {
  DANGERS,
  EVERYWHERE,
  LINUX_ONLY,
  ORIGIN,
  POSIX_BUILTINS,
  POWERSHELL_ALIASES,
  PROGRAMS,
  REWRITES,
  TASKS,
  familyOf,
  type Family,
  type Task,
} from './guideData';

/** What is known about the terminal the line is typed in. */
export interface GuideContext {
  /** Id of the shell, as the Rust side names it. */
  shell: string;
  /**
   * Names of the programs this shell can run, in lower case. `null` when
   * they are not known (not loaded yet, or a shell inside WSL): every
   * program then gets the benefit of the doubt.
   */
  programs: ReadonlySet<string> | null;
}

/** A change to the line the user can accept with one key. */
export interface Fix {
  /** The characters to replace: from `from` up to, not including, `to`. */
  from: number;
  to: number;
  text: string;
}

export interface Hint {
  /** `warning` is for commands that can destroy work. */
  tone: 'info' | 'warning';
  /** The command the hint talks about, shown before the text. */
  subject?: string;
  text: string;
  fix?: Fix;
}

const FAMILIES: readonly Family[] = ['posix', 'cmd', 'powershell'];

/** A command name, as opposed to a path, a variable or a number. */
const NAME = /^[A-Za-z][\w-]*$/;

const has = (record: object, key: string) => Object.hasOwn(record, key);

/** The first word of a way of writing a task, in lower case. */
const head = (spelling: string) => spelling.split(' ', 1)[0]!.toLowerCase();

/** A way of writing a task without its options: `taskkill /PID` is `taskkill`. */
const withoutOptions = (spelling: string) => spelling.replace(/\s+[/-].*$/, '').toLowerCase();

/** How many characters `text` has before its code unit `index` (emoji count once). */
const charsBefore = (text: string, index: number) => [...text.slice(0, index)].length;

/** Whether the shell of `context` can run the command `word` (in lower case). */
function runsHere(word: string, context: GuideContext): boolean {
  const family = familyOf(context.shell);
  if (has(EVERYWHERE, word)) return true;
  if (TASKS.some((task) => task[family] !== undefined && head(task[family]) === word)) return true;
  if (family === 'powershell' && has(POWERSHELL_ALIASES, word)) return true;
  if (family === 'posix' && POSIX_BUILTINS.has(word)) return true;
  return context.programs?.has(word) ?? true;
}

/** Whether `line` is `spelling` alone or followed by more words. Case does not count. */
function startsWithCommand(line: string, spelling: string): boolean {
  const lower = line.toLowerCase();
  const wanted = spelling.toLowerCase();
  return lower === wanted || lower.startsWith(`${wanted} `);
}

function rewrite(line: string, context: GuideContext): Hint | null {
  const family = familyOf(context.shell);
  for (const rule of REWRITES) {
    if (rule.shell ? rule.shell !== context.shell : rule.family !== family) continue;
    const match = rule.match.exec(line);
    if (!match) continue;
    return {
      tone: 'info',
      text: rule.text,
      fix: {
        from: match.index,
        to: match.index + match[0].length,
        text: typeof rule.to === 'string' ? rule.to : rule.to(match),
      },
    };
  }
  return null;
}

function danger(line: string): Hint | null {
  const found = DANGERS.find((rule) => rule.match.test(line));
  return found ? { tone: 'warning', text: found.text } : null;
}

/** A command of another system that this shell cannot run. */
function foreign(line: string, word: string, context: GuideContext): Hint | null {
  const family = familyOf(context.shell);
  const lower = word.toLowerCase();

  if (family !== 'posix' && has(LINUX_ONLY, lower)) {
    const known = LINUX_ONLY[lower]!;
    return {
      tone: 'info',
      subject: word,
      text: `es de Linux: ${known.about.toLowerCase()}. ${known.onWindows}`,
    };
  }

  for (const other of FAMILIES) {
    if (other === family) continue;
    for (const task of TASKS) {
      const theirs = task[other];
      // A spelling of several words counts only when all of them were typed:
      // `ip route` is not the task written `ip addr`.
      if (!theirs || head(theirs) !== lower || !startsWithCommand(line, theirs)) continue;
      const ours = task[family];
      const subject = line.slice(0, theirs.length);
      if (!ours) {
        return { tone: 'info', subject, text: `es de ${ORIGIN[other]} y aquí no existe.` };
      }
      return {
        tone: 'info',
        subject,
        text: `es de ${ORIGIN[other]}. Aquí se escribe ${ours}.`,
        fix: { from: 0, to: theirs.length, text: ours },
      };
    }
  }
  return null;
}

/** Whether swapping two neighbouring letters of `a` gives `b`. */
function isSwap(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const first = [...a].findIndex((char, index) => char !== b[index]);
  return (
    first !== -1 &&
    a[first] === b[first + 1] &&
    a[first + 1] === b[first] &&
    a.slice(first + 2) === b.slice(first + 2)
  );
}

/** Whether `a` becomes `b` by adding, removing or changing one letter. */
function isOneLetterAway(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1 || a === b) return false;
  let start = 0;
  while (start < a.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  return endA - start <= 1 && endB - start <= 1;
}

/** Every one-word command this shell runs that the terminal knows about. */
function knownHere(context: GuideContext): string[] {
  const family = familyOf(context.shell);
  const names = [
    ...Object.keys(PROGRAMS),
    ...TASKS.map((task) => task[family] ?? ''),
    ...Object.keys(EVERYWHERE),
    ...(family === 'posix' ? Object.keys(LINUX_ONLY) : []),
  ];
  return names.filter(
    (name) => name && !name.includes(' ') && runsHere(name.toLowerCase(), context),
  );
}

/** A command name that is one slip of the fingers away from a known one. */
function typo(word: string, context: GuideContext): Hint | null {
  const lower = word.toLowerCase();
  // Without the list of programs nothing says this is not a real command.
  if (lower.length < 3 || !/^[a-z0-9]+$/.test(lower) || context.programs === null) return null;
  const meant = knownHere(context).find((name) => {
    const known = name.toLowerCase();
    // Short names are too close to each other: `gst` is a common alias, not
    // `git` mistyped. Only swapped letters count for them.
    return isSwap(lower, known) || (known.length >= 5 && isOneLetterAway(lower, known));
  });
  if (!meant) return null;
  return {
    tone: 'info',
    subject: word,
    text: `no es un comando de este equipo. ¿Quisiste escribir ${meant}?`,
    fix: { from: 0, to: word.length, text: meant },
  };
}

/** What `name` (one or more words, lower case) does in this family, if known. */
function describe(name: string, family: Family): string | null {
  if (has(PROGRAMS, name)) return PROGRAMS[name]!;
  if (has(EVERYWHERE, name)) return EVERYWHERE[name]!;
  const own = TASKS.find((task) => isWritten(task, family, name));
  if (own) return own.about;
  if (family === 'powershell' && has(POWERSHELL_ALIASES, name)) {
    const real = POWERSHELL_ALIASES[name]!;
    const aliased = TASKS.find((task) => isWritten(task, family, real.toLowerCase()));
    return aliased ? `${aliased.about}. En PowerShell es otro nombre de ${real}` : null;
  }
  // The same name means something else to a Linux shell.
  if (family === 'posix' && POSIX_BUILTINS.has(name)) return null;
  if (has(LINUX_ONLY, name)) return LINUX_ONLY[name]!.about;
  // A command of another system that is installed here all the same, like
  // the Linux tools Git brings to PowerShell and cmd.
  const borrowed = TASKS.find((task) => FAMILIES.some((other) => isWritten(task, other, name)));
  return borrowed?.about ?? null;
}

/** Whether `family` writes `task` as `spelling` (in lower case), options aside. */
function isWritten(task: Task, family: Family, spelling: string): boolean {
  const theirs = task[family];
  return (
    theirs !== undefined &&
    (theirs.toLowerCase() === spelling || withoutOptions(theirs) === spelling)
  );
}

/** What the command at the start of the line does. */
function explain(line: string, context: GuideContext): Hint | null {
  const family = familyOf(context.shell);
  const words = line.split(/\s+/);
  // The longest name first: `git commit` says more than `git`.
  for (let count = Math.min(3, words.length); count >= 1; count--) {
    const subject = words.slice(0, count).join(' ');
    const about = describe(subject.toLowerCase(), family);
    if (!about) continue;
    if (!runsHere(words[0]!.toLowerCase(), context)) {
      return { tone: 'info', subject: words[0]!, text: 'no está instalado en este equipo.' };
    }
    return { tone: 'info', subject, text: about };
  }
  return null;
}

/**
 * The most useful thing to say about the line being typed, or `null` when
 * there is nothing worth saying. `typed` is the whole line as it is on
 * screen; the positions of a fix count its characters.
 *
 * Only the first command of the line is looked at, plus the whole line for
 * the few commands that can destroy work.
 */
export function hintFor(typed: string, context: GuideContext): Hint | null {
  const line = typed.trim();
  if (!line) return null;
  const word = line.split(/\s+/, 1)[0]!;
  const named = NAME.test(word);

  // A command that will not run here comes before what it would do.
  const hint =
    rewrite(line, context) ??
    (named && !runsHere(word.toLowerCase(), context)
      ? (foreign(line, word, context) ?? typo(word, context))
      : null) ??
    danger(line) ??
    explain(line, context);
  if (!hint?.fix) return hint;

  // Rules count from the first word; the caller counts characters of the
  // line on screen, spaces in front included.
  const lead = typed.length - typed.trimStart().length;
  const { from, to, text } = hint.fix;
  return {
    ...hint,
    fix: { from: lead + charsBefore(line, from), to: lead + charsBefore(line, to), text },
  };
}

/**
 * What to add to `typed` to complete a common command that starts with it:
 * the help for a user with no history yet. Returns `null` when nothing
 * fits. Shells of Windows do not mind upper and lower case; the others do.
 */
export function completeCommand(typed: string, context: GuideContext): string | null {
  if (typed.trim().length < 2 || typed !== typed.trimStart()) return null;
  const family = familyOf(context.shell);
  const fold = (text: string) => (family === 'posix' ? text : text.toLowerCase());
  const names = [
    ...Object.keys(PROGRAMS),
    ...TASKS.map((task) => task[family] ?? ''),
    ...Object.keys(EVERYWHERE),
  ];
  const wanted = fold(typed);
  const found = names.find(
    (name) =>
      name.length > typed.length && fold(name).startsWith(wanted) && runsHere(head(name), context),
  );
  return found ? found.slice(typed.length) : null;
}
