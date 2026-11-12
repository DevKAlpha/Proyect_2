//! Prompt marks.
//!
//! A terminal only sees a stream of characters: it cannot tell the command
//! the user is typing from the output around it. Shells can say it. With
//! what this module adds to a shell's start, the shell prints an invisible
//! mark right after each prompt (`OSC 133 ; B`, the mark other terminals
//! use too). Everything from that mark to the next Enter is the user's
//! command line, which is what suggestions and editing by selection need.
//!
//! Nothing is written to the user's shell configuration: the marks come from
//! arguments and environment variables of the one process being started.
//! zsh has no such argument or variable, so it reads one start-up file of
//! ours from a folder of the app (see [`install_support`]).
//! A shell without marks (`sh`, or a prompt that replaces ours) keeps
//! working as a plain terminal.

use std::fs;
use std::io;
use std::path::Path;

/// What to add to a shell's start so that it marks its prompt.
#[derive(Debug, Default, PartialEq, Eq)]
pub struct Integration {
    /// Appended to the shell's own arguments.
    pub args: Vec<String>,
    pub env: Vec<(String, String)>,
}

/// Text every mark of ours contains, used to avoid adding it twice.
const MARK: &str = "133;B";

/// Wraps the prompt function the user's profile defined. The original is
/// called first, as the very first statement, so that prompts which show
/// whether the last command failed still see that status. No double quotes:
/// the script travels as one command-line argument.
const POWERSHELL: &str = "$Global:__termPrompt = $function:prompt; \
function Global:prompt { $p = & $Global:__termPrompt; \
-join ([char]27, ']133;A', [char]7, $p, [char]27, ']133;B', [char]7) }";

/// Run by bash before each prompt: makes sure the prompt ends with the mark,
/// whatever the user's files set it to. `\[ \]` tells bash the mark takes no
/// room on screen.
const BASH: &str = r#"case "$PS1" in *'133;B'*) ;; *) PS1="$PS1"'\[\e]133;B\a\]' ;; esac"#;

/// Run by fish after the user's configuration. Wraps the prompt function,
/// calling the original first so it still sees the status of the last
/// command. fish draws its own suggestion after the cursor; drawing it dim
/// lets the terminal tell it from what the user typed.
const FISH: &str = "functions -c fish_prompt __term_prompt; \
function fish_prompt; __term_prompt; printf '\\e]133;B\\a'; end; \
set -g fish_color_autosuggestion $fish_color_autosuggestion --dim";

/// Folder, inside the app's support folder, that zsh reads its first
/// start-up file from.
const ZSH_FOLDER: &str = "zsh";

/// The first file zsh reads. It hands zsh its real folder back at once, so
/// every other start-up file is the user's own, read from where they keep
/// it. Then it asks zsh to end each prompt with the mark. `%{ %}` tells zsh
/// the mark takes no room on screen.
///
/// The hook moves itself to the end of the list: a theme that rebuilds the
/// prompt before each command would otherwise wipe the mark.
const ZSH_ENV: &str = r#"# Read by zsh only when it is started by the terminal app.
if [[ -n "${TERM_APP_ZDOTDIR+set}" ]]; then
  ZDOTDIR="$TERM_APP_ZDOTDIR"
else
  unset ZDOTDIR
fi
unset TERM_APP_ZDOTDIR
[[ -f "${ZDOTDIR:-$HOME}/.zshenv" ]] && source "${ZDOTDIR:-$HOME}/.zshenv"

if [[ -o interactive ]]; then
  __term_mark() {
    [[ "$PS1" == *'133;B'* ]] || PS1="$PS1"$'%{\e]133;B\a%}'
    [[ "${precmd_functions[-1]}" == __term_mark ]] ||
      precmd_functions=(${precmd_functions:#__term_mark} __term_mark)
  }
  precmd_functions+=(__term_mark)
fi
"#;

/// Writes the start-up files some shells need into `folder`, a folder that
/// belongs to the app. Call it once before [`prompt_marks`], and pass the
/// folder there only when this succeeded.
pub fn install_support(folder: &Path) -> io::Result<()> {
    let zsh = folder.join(ZSH_FOLDER);
    fs::create_dir_all(&zsh)?;
    let file = zsh.join(".zshenv");
    // Rewritten only when it differs: shells may be reading it right now.
    if fs::read_to_string(&file).ok().as_deref() != Some(ZSH_ENV) {
        fs::write(&file, ZSH_ENV)?;
    }
    Ok(())
}

/// The marks for the shell `shell_id` (an id from [`crate::detect_shells`]).
/// `env` reads the environment the shell will inherit, so existing settings
/// are kept. `support` is the folder [`install_support`] filled, or `None`
/// when there is none: shells that need a file then start unchanged.
/// Shells this module does not know get nothing.
pub fn prompt_marks(
    shell_id: &str,
    env: &dyn Fn(&str) -> Option<String>,
    support: Option<&Path>,
) -> Integration {
    match shell_id {
        "pwsh" | "powershell" => Integration {
            args: vec!["-NoExit".into(), "-Command".into(), POWERSHELL.into()],
            env: Vec::new(),
        },
        "bash" | "git-bash" => Integration {
            args: Vec::new(),
            env: vec![("PROMPT_COMMAND".into(), bash_prompt_command(env))],
        },
        "wsl" => {
            // The shell runs inside Linux. `WSLENV` names the variables that
            // cross over; `/u` means only in this direction. It works when
            // the distribution's shell is bash.
            let crossing = match env("WSLENV") {
                Some(existing) if existing.contains("PROMPT_COMMAND") => existing,
                Some(existing) if !existing.is_empty() => format!("PROMPT_COMMAND/u:{existing}"),
                _ => "PROMPT_COMMAND/u".to_owned(),
            };
            Integration {
                args: Vec::new(),
                env: vec![
                    ("PROMPT_COMMAND".into(), bash_prompt_command(env)),
                    ("WSLENV".into(), crossing),
                ],
            }
        }
        "zsh" => match support {
            Some(folder) => {
                let mut vars = vec![(
                    "ZDOTDIR".to_owned(),
                    folder.join(ZSH_FOLDER).to_string_lossy().into_owned(),
                )];
                // Our file gives this back to zsh before anything else runs.
                if let Some(own) = env("ZDOTDIR") {
                    vars.push(("TERM_APP_ZDOTDIR".to_owned(), own));
                }
                Integration {
                    args: Vec::new(),
                    env: vars,
                }
            }
            None => Integration::default(),
        },
        "fish" => Integration {
            args: vec!["--init-command".into(), FISH.into()],
            env: Vec::new(),
        },
        "cmd" => {
            // In a cmd prompt, `$E` is the escape character.
            let prompt = match env("PROMPT") {
                Some(existing) if existing.contains(MARK) => existing,
                existing => format!(
                    "$E]133;A$E\\{}$E]133;B$E\\",
                    existing
                        .filter(|prompt| !prompt.is_empty())
                        .unwrap_or_else(|| CMD_DEFAULT_PROMPT.to_owned())
                ),
            };
            Integration {
                args: Vec::new(),
                env: vec![("PROMPT".into(), prompt)],
            }
        }
        _ => Integration::default(),
    }
}

/// The prompt cmd shows when the user has not set one.
const CMD_DEFAULT_PROMPT: &str = "$P$G";

/// `PROMPT_COMMAND` with our mark, in front of what the user already has.
fn bash_prompt_command(env: &dyn Fn(&str) -> Option<String>) -> String {
    match env("PROMPT_COMMAND") {
        Some(existing) if existing.contains(MARK) => existing,
        Some(existing) if !existing.trim().is_empty() => format!("{BASH}; {existing}"),
        _ => BASH.to_owned(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn no_env(_: &str) -> Option<String> {
        None
    }

    #[test]
    fn powershell_wraps_the_prompt_with_one_argument_free_of_double_quotes() {
        for id in ["pwsh", "powershell"] {
            let marks = prompt_marks(id, &no_env, None);

            assert_eq!(marks.args[..2], ["-NoExit", "-Command"]);
            assert!(marks.args[2].contains("']133;B'"));
            assert!(!marks.args[2].contains('"'));
            assert!(marks.env.is_empty());
        }
    }

    #[test]
    fn bash_marks_through_the_prompt_command() {
        let marks = prompt_marks("git-bash", &no_env, None);

        assert!(marks.args.is_empty());
        assert_eq!(marks.env[0].0, "PROMPT_COMMAND");
        assert_eq!(marks.env[0].1, BASH);
    }

    #[test]
    fn bash_keeps_a_prompt_command_the_user_already_has() {
        let marks = prompt_marks(
            "bash",
            &|key| (key == "PROMPT_COMMAND").then(|| "history -a".to_owned()),
            None,
        );

        assert!(marks.env[0].1.starts_with(BASH));
        assert!(marks.env[0].1.ends_with("; history -a"));
    }

    #[test]
    fn wsl_sends_the_bash_mark_into_linux() {
        let marks = prompt_marks("wsl", &no_env, None);

        assert_eq!(
            marks.env,
            [
                ("PROMPT_COMMAND".to_owned(), BASH.to_owned()),
                ("WSLENV".to_owned(), "PROMPT_COMMAND/u".to_owned()),
            ]
        );
    }

    #[test]
    fn wsl_keeps_the_variables_the_user_already_sends() {
        let marks = prompt_marks(
            "wsl",
            &|key| (key == "WSLENV").then(|| "EDITOR/u".to_owned()),
            None,
        );

        assert_eq!(marks.env[1].1, "PROMPT_COMMAND/u:EDITOR/u");
    }

    #[test]
    fn zsh_reads_its_first_file_from_the_support_folder() {
        let folder = tempfile::tempdir().unwrap();
        install_support(folder.path()).unwrap();

        let marks = prompt_marks("zsh", &no_env, Some(folder.path()));

        assert!(marks.args.is_empty());
        assert_eq!(marks.env.len(), 1);
        assert_eq!(marks.env[0].0, "ZDOTDIR");
        let file = Path::new(&marks.env[0].1).join(".zshenv");
        assert_eq!(fs::read_to_string(file).unwrap(), ZSH_ENV);
    }

    #[test]
    fn zsh_gets_the_folder_the_user_chose_back() {
        let marks = prompt_marks(
            "zsh",
            &|key| (key == "ZDOTDIR").then(|| "/home/ana/.config/zsh".to_owned()),
            Some(Path::new("/support")),
        );

        assert_eq!(
            marks.env[1],
            (
                "TERM_APP_ZDOTDIR".to_owned(),
                "/home/ana/.config/zsh".to_owned()
            )
        );
    }

    #[test]
    fn zsh_starts_unchanged_without_a_support_folder() {
        assert_eq!(prompt_marks("zsh", &no_env, None), Integration::default());
    }

    #[test]
    fn installing_support_twice_leaves_the_same_file() {
        let folder = tempfile::tempdir().unwrap();

        install_support(folder.path()).unwrap();
        install_support(folder.path()).unwrap();

        let file = folder.path().join(ZSH_FOLDER).join(".zshenv");
        assert_eq!(fs::read_to_string(file).unwrap(), ZSH_ENV);
    }

    #[test]
    fn fish_wraps_its_prompt_with_an_init_command() {
        let marks = prompt_marks("fish", &no_env, None);

        assert_eq!(marks.args[0], "--init-command");
        assert!(marks.args[1].contains("133;B"));
        assert!(marks.env.is_empty());
    }

    #[test]
    fn cmd_wraps_the_default_prompt() {
        let marks = prompt_marks("cmd", &no_env, None);

        assert_eq!(
            marks.env,
            [(
                "PROMPT".to_owned(),
                "$E]133;A$E\\$P$G$E]133;B$E\\".to_owned()
            )]
        );
    }

    #[test]
    fn cmd_wraps_a_prompt_the_user_already_has() {
        let marks = prompt_marks(
            "cmd",
            &|key| (key == "PROMPT").then(|| "$T $P$G".to_owned()),
            None,
        );

        assert_eq!(marks.env[0].1, "$E]133;A$E\\$T $P$G$E]133;B$E\\");
    }

    #[test]
    fn marks_are_not_added_twice_when_terminals_are_nested() {
        let marked = "$E]133;A$E\\$P$G$E]133;B$E\\";
        let marks = prompt_marks(
            "cmd",
            &|key| (key == "PROMPT").then(|| marked.to_owned()),
            None,
        );

        assert_eq!(marks.env[0].1, marked);
    }

    #[test]
    fn unknown_shells_start_unchanged() {
        for id in ["sh", "nushell"] {
            assert_eq!(prompt_marks(id, &no_env, None), Integration::default());
        }
    }
}
