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
//! A shell without marks (WSL, zsh, fish, or a prompt that replaces ours)
//! keeps working as a plain terminal.

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

/// The prompt cmd shows when the user has not set one.
const CMD_DEFAULT_PROMPT: &str = "$P$G";

/// The marks for the shell `shell_id` (an id from [`crate::detect_shells`]).
/// `env` reads the environment the shell will inherit, so existing settings
/// are kept. Shells this module does not know get nothing.
pub fn prompt_marks(shell_id: &str, env: &dyn Fn(&str) -> Option<String>) -> Integration {
    match shell_id {
        "pwsh" | "powershell" => Integration {
            args: vec!["-NoExit".into(), "-Command".into(), POWERSHELL.into()],
            env: Vec::new(),
        },
        "bash" | "git-bash" => {
            let command = match env("PROMPT_COMMAND") {
                Some(existing) if existing.contains(MARK) => existing,
                Some(existing) if !existing.trim().is_empty() => format!("{BASH}; {existing}"),
                _ => BASH.to_owned(),
            };
            Integration {
                args: Vec::new(),
                env: vec![("PROMPT_COMMAND".into(), command)],
            }
        }
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

#[cfg(test)]
mod tests {
    use super::*;

    fn no_env(_: &str) -> Option<String> {
        None
    }

    #[test]
    fn powershell_wraps_the_prompt_with_one_argument_free_of_double_quotes() {
        for id in ["pwsh", "powershell"] {
            let marks = prompt_marks(id, &no_env);

            assert_eq!(marks.args[..2], ["-NoExit", "-Command"]);
            assert!(marks.args[2].contains("']133;B'"));
            assert!(!marks.args[2].contains('"'));
            assert!(marks.env.is_empty());
        }
    }

    #[test]
    fn bash_marks_through_the_prompt_command() {
        let marks = prompt_marks("git-bash", &no_env);

        assert!(marks.args.is_empty());
        assert_eq!(marks.env[0].0, "PROMPT_COMMAND");
        assert_eq!(marks.env[0].1, BASH);
    }

    #[test]
    fn bash_keeps_a_prompt_command_the_user_already_has() {
        let marks = prompt_marks("bash", &|key| {
            (key == "PROMPT_COMMAND").then(|| "history -a".to_owned())
        });

        assert!(marks.env[0].1.starts_with(BASH));
        assert!(marks.env[0].1.ends_with("; history -a"));
    }

    #[test]
    fn cmd_wraps_the_default_prompt() {
        let marks = prompt_marks("cmd", &no_env);

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
        let marks = prompt_marks("cmd", &|key| {
            (key == "PROMPT").then(|| "$T $P$G".to_owned())
        });

        assert_eq!(marks.env[0].1, "$E]133;A$E\\$T $P$G$E]133;B$E\\");
    }

    #[test]
    fn marks_are_not_added_twice_when_terminals_are_nested() {
        let marked = "$E]133;A$E\\$P$G$E]133;B$E\\";
        let marks = prompt_marks("cmd", &|key| (key == "PROMPT").then(|| marked.to_owned()));

        assert_eq!(marks.env[0].1, marked);
    }

    #[test]
    fn unknown_shells_start_unchanged() {
        for id in ["wsl", "zsh", "fish", "sh"] {
            assert_eq!(prompt_marks(id, &no_env), Integration::default());
        }
    }
}
