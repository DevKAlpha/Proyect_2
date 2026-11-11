//! Command history.
//!
//! Remembers the commands the user ran so the terminal can suggest them
//! again. The list is one plain text file, one command per line, that the
//! user can read, edit or delete.
//!
//! A history file is a known place to find secrets, so this one is careful
//! about what it keeps: see [`History::record`].

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

/// Longer lines are scripts pasted by accident, not commands worth suggesting.
const MAX_COMMAND_CHARS: usize = 2000;

/// A command containing any of these is not remembered. It is the list
/// PowerShell's own history uses, plus the usual spellings. A false positive
/// only means one command is not suggested later.
const SENSITIVE_WORDS: [&str; 10] = [
    "password",
    "passwd",
    "secret",
    "token",
    "apikey",
    "api_key",
    "api-key",
    "asplaintext",
    "bearer",
    "private_key",
];

/// The remembered commands, oldest first.
#[derive(Debug, Default, PartialEq, Eq)]
pub struct History {
    entries: Vec<String>,
}

/// Where the history lives. A folder that stays on this machine: history
/// can hold what the filter missed, and must not follow the user's account
/// to other computers.
pub fn history_path() -> Option<PathBuf> {
    Some(dirs::data_local_dir()?.join("terminal").join("history.txt"))
}

/// Whether `command` looks like it carries a credential.
pub fn is_sensitive(command: &str) -> bool {
    let lower = command.to_lowercase();
    SENSITIVE_WORDS.iter().any(|word| lower.contains(word))
}

impl History {
    /// Reads the file at `path`. A missing file is an empty history.
    pub fn load(path: &Path) -> io::Result<Self> {
        match fs::read_to_string(path) {
            Ok(text) => Ok(Self {
                entries: text
                    .lines()
                    .filter(|line| !line.trim().is_empty())
                    .map(str::to_owned)
                    .collect(),
            }),
            Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(Self::default()),
            Err(error) => Err(error),
        }
    }

    /// The commands, oldest first.
    pub fn entries(&self) -> &[String] {
        &self.entries
    }

    /// Remembers `command`, keeping at most `limit` commands. Returns whether
    /// it was kept.
    ///
    /// Not kept, on purpose:
    /// - commands that look like they carry a credential ([`is_sensitive`]);
    /// - commands that start with a space, the usual way to tell a shell
    ///   "do not remember this one";
    /// - empty, multi-line or very long input.
    ///
    /// A command run again moves to the newest place instead of repeating.
    pub fn record(&mut self, command: &str, limit: usize) -> bool {
        let trimmed = command.trim_end();
        let unwanted = limit == 0
            || trimmed.trim().is_empty()
            || trimmed.starts_with(char::is_whitespace)
            || trimmed.contains(['\n', '\r'])
            || trimmed.chars().count() > MAX_COMMAND_CHARS
            || is_sensitive(trimmed);
        if unwanted {
            return false;
        }
        self.entries.retain(|entry| entry != trimmed);
        self.entries.push(trimmed.to_owned());
        if self.entries.len() > limit {
            let excess = self.entries.len() - limit;
            self.entries.drain(..excess);
        }
        true
    }

    /// Forgets everything.
    pub fn clear(&mut self) {
        self.entries.clear();
    }

    /// Writes the file at `path`, through a temporary file so a crash in the
    /// middle cannot leave half a history.
    pub fn save(&self, path: &Path) -> io::Result<()> {
        if let Some(folder) = path.parent() {
            fs::create_dir_all(folder)?;
        }
        let mut text = self.entries.join("\n");
        if !text.is_empty() {
            text.push('\n');
        }
        let temporary = path.with_extension("txt.tmp");
        fs::write(&temporary, text)?;
        fs::rename(&temporary, path)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn history(commands: &[&str]) -> History {
        let mut history = History::default();
        for command in commands {
            history.record(command, 100);
        }
        history
    }

    #[test]
    fn remembers_commands_oldest_first() {
        assert_eq!(
            history(&["git status", "npm test"]).entries(),
            ["git status", "npm test"]
        );
    }

    #[test]
    fn a_repeated_command_moves_to_the_newest_place() {
        let history = history(&["git status", "npm test", "git status"]);

        assert_eq!(history.entries(), ["npm test", "git status"]);
    }

    #[test]
    fn drops_the_oldest_commands_beyond_the_limit() {
        let mut history = History::default();
        for command in ["a", "b", "c", "d"] {
            history.record(command, 2);
        }

        assert_eq!(history.entries(), ["c", "d"]);
    }

    #[test]
    fn a_limit_of_zero_remembers_nothing() {
        let mut history = History::default();

        assert!(!history.record("git status", 0));
        assert!(history.entries().is_empty());
    }

    #[test]
    fn does_not_remember_commands_that_look_like_credentials() {
        let mut history = History::default();

        for command in [
            "mysql -u root --password=hunter2",
            "curl -H 'Authorization: Bearer abc' https://api",
            "$env:API_KEY = 'abc'",
            "export GITHUB_TOKEN=ghp_123",
            "ConvertTo-SecureString 'x' -AsPlainText",
        ] {
            assert!(!history.record(command, 100), "{command}");
        }
        assert!(history.entries().is_empty());
    }

    #[test]
    fn does_not_remember_a_command_that_starts_with_a_space() {
        let mut history = History::default();

        assert!(!history.record(" ssh admin@server", 100));
    }

    #[test]
    fn does_not_remember_empty_multi_line_or_huge_input() {
        let mut history = History::default();

        assert!(!history.record("   ", 100));
        assert!(!history.record("echo a\necho b", 100));
        assert!(!history.record(&"x".repeat(MAX_COMMAND_CHARS + 1), 100));
    }

    #[test]
    fn keeps_inner_spaces_and_drops_trailing_ones() {
        let history = history(&["git commit -m 'two  spaces'   "]);

        assert_eq!(history.entries(), ["git commit -m 'two  spaces'"]);
    }

    #[test]
    fn what_is_saved_is_what_is_loaded() {
        let folder = tempfile::tempdir().unwrap();
        let file = folder.path().join("nested").join("history.txt");
        let saved = history(&["git status", "echo ñandú 🚀"]);

        saved.save(&file).unwrap();

        assert_eq!(History::load(&file).unwrap(), saved);
        assert!(!file.with_extension("txt.tmp").exists());
    }

    #[test]
    fn a_missing_file_is_an_empty_history() {
        let folder = tempfile::tempdir().unwrap();

        assert_eq!(
            History::load(&folder.path().join("none.txt")).unwrap(),
            History::default()
        );
    }

    #[test]
    fn clearing_forgets_everything_also_on_disk() {
        let folder = tempfile::tempdir().unwrap();
        let file = folder.path().join("history.txt");
        let mut history = history(&["git status"]);
        history.save(&file).unwrap();

        history.clear();
        history.save(&file).unwrap();

        assert_eq!(fs::read_to_string(&file).unwrap(), "");
    }
}
