//! User configuration.
//!
//! One TOML file the user can read and edit by hand. Every key is optional and
//! falls back to a default, so a short or old file keeps working. [`watch`]
//! reports edits while the app runs.

use std::fs;
use std::path::{Path, PathBuf};

use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};

mod folders;
mod templates;
mod theme;
mod workspace;

pub use folders::{config_dir, data_dir, local_dir, tidy_data};
pub use templates::{apply_template, templates, Template};
pub use theme::{Theme, ANSI_NAMES};
pub use workspace::{workspace_path, Project, SavedTerminal, Workspace};

/// Format version this build writes and understands.
pub const CURRENT_VERSION: u32 = 1;

/// The commented file written on first run. It must parse to [`Config::default`].
pub const DEFAULT_TOML: &str = include_str!("default.toml");

/// Folder name under the system configuration directory.
pub(crate) const APP_DIR: &str = "terminal";

/// Why the configuration could not be loaded or watched.
#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("could not read or write the configuration file: {0}")]
    Io(#[from] std::io::Error),
    #[error("the configuration file is not valid: {0}")]
    Parse(#[from] toml::de::Error),
    #[error("the configuration file is version {0}, but this build only understands up to version {CURRENT_VERSION}")]
    UnsupportedVersion(u32),
    #[error("could not watch the configuration file: {0}")]
    Watch(#[from] notify::Error),
    #[error("there is no template named `{0}`")]
    UnknownTemplate(String),
    #[error("the saved projects could not be read or written: {0}")]
    Workspace(serde_json::Error),
}

/// Everything the user can configure.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct Config {
    pub version: u32,
    /// Id of the shell for new tabs. `None` means the first one detected.
    pub default_shell: Option<String>,
    /// Lines of history kept per tab.
    pub scrollback: u32,
    /// Space between the text and the edge of the window, in pixels.
    pub padding: u16,
    /// On Windows, lets PowerShell and cmd find the Unix tools that come
    /// with Git for Windows (`grep`, `ls`, `cat`...).
    pub linux_commands: bool,
    pub font: Font,
    pub cursor: Cursor,
    pub theme: Theme,
    pub background: Background,
    pub browser: Browser,
    pub input: Input,
    /// Extra entries for the new-tab menu: any agent or tool that starts
    /// with a command.
    pub agents: Vec<CustomAgent>,
}

/// Help while typing a command.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct Input {
    /// Suggest an earlier command that starts like the one being typed, or
    /// a common command when nothing remembered fits.
    pub suggestions: bool,
    /// Explain the command being typed and warn about likely mistakes, in a
    /// line under the terminal.
    pub hints: bool,
    /// How many commands are remembered. Zero remembers none.
    pub history_size: u32,
    /// Key that, held down, selects text of the command with the arrows.
    pub select_with: SelectWith,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SelectWith {
    Ctrl,
    Shift,
}

/// A command the user wants one click away, for example an AI agent that
/// the app does not know.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CustomAgent {
    /// Name shown in the menu and on the tab.
    pub name: String,
    /// What to type in the shell to start it.
    pub command: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct Font {
    /// CSS font list: the first available family wins. VT323 (the pixel
    /// letters of an old terminal) and JetBrains Mono ship
    /// with the app, so it is available on every system.
    pub family: String,
    pub size: u16,
    /// Height of a row as a multiple of the font size.
    pub line_height: f32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct Cursor {
    pub style: CursorStyle,
    pub blink: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CursorStyle {
    Block,
    Bar,
    Underline,
}

/// A picture behind the text.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct Background {
    /// Path of the image file. Empty means no image.
    pub image: String,
    /// How much the background colour covers the image: 0 shows the whole
    /// image, 1 hides it. Text stays readable only with enough of it.
    pub dim: f32,
}

/// The browser AI agents drive to test web apps.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct Browser {
    /// Local port agents connect to. Fixed, because agents store it when
    /// the browser is registered with them.
    pub port: u16,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            version: CURRENT_VERSION,
            default_shell: None,
            scrollback: 5000,
            padding: 8,
            linux_commands: true,
            font: Font::default(),
            cursor: Cursor::default(),
            theme: Theme::default(),
            background: Background::default(),
            browser: Browser::default(),
            input: Input::default(),
            agents: Vec::new(),
        }
    }
}

impl Default for Font {
    fn default() -> Self {
        Self {
            family:
                "VT323, JetBrains Mono, Cascadia Code, Consolas, Menlo, DejaVu Sans Mono, monospace"
                    .into(),
            size: 20,
            line_height: 1.0,
        }
    }
}

impl Default for Cursor {
    fn default() -> Self {
        Self {
            style: CursorStyle::Block,
            blink: true,
        }
    }
}

impl Default for Background {
    fn default() -> Self {
        Self {
            image: String::new(),
            dim: 0.75,
        }
    }
}

impl Default for Input {
    fn default() -> Self {
        Self {
            suggestions: true,
            hints: true,
            history_size: 1000,
            select_with: SelectWith::Ctrl,
        }
    }
}

impl Default for Browser {
    fn default() -> Self {
        Self { port: 9333 }
    }
}

impl Config {
    /// Reads a configuration from TOML text. Missing keys take their default.
    pub fn parse(text: &str) -> Result<Self, ConfigError> {
        let config: Config = toml::from_str(text)?;
        // A newer file may give old keys a new meaning; guessing would be worse
        // than saying so.
        if config.version > CURRENT_VERSION {
            return Err(ConfigError::UnsupportedVersion(config.version));
        }
        Ok(config)
    }
}

/// Where the configuration file lives on this system, if it has a
/// configuration directory at all.
pub fn default_path() -> Option<PathBuf> {
    Some(dirs::config_dir()?.join(APP_DIR).join("config.toml"))
}

/// Loads the file at `path`. On first run it writes the commented default
/// file, so the user has something to edit.
pub fn load_or_create(path: &Path) -> Result<Config, ConfigError> {
    if !path.exists() {
        if let Some(dir) = path.parent() {
            fs::create_dir_all(dir)?;
        }
        fs::write(path, DEFAULT_TOML)?;
    }
    let mut text = fs::read_to_string(path)?;
    if let Some(updated) = adopt_defaults(&text) {
        // A file that cannot be written keeps its old look: not worth
        // stopping the terminal for.
        if fs::write(path, &updated).is_ok() {
            text = updated;
        }
    }
    Config::parse(&text)
}

/// The theme lines of the file older builds wrote on first run, when the
/// default look was the dark one.
const OLD_THEME_LINES: [&str; 2] = [
    "# Tema de partida: \"dark\", \"light\" o \"high-contrast\".",
    "preset = \"dark\"",
];
/// What replaces them: the lines of the file written today.
const THEME_LINES: [&str; 3] = [
    "# Tema de partida: \"console\" (blanco sobre negro, como la consola de un",
    "# router), \"dark\", \"light\" o \"high-contrast\".",
    "preset = \"console\"",
];

/// `text` with the default look of today, when it still carries the theme
/// lines an older build wrote: that user never chose a theme, they were
/// given one. `None` when there is nothing to change.
///
/// A file where the user picked a theme, by hand or with a template, no
/// longer has those two lines together and is left alone. So is this file
/// after the change: choosing "dark" later sticks.
pub fn adopt_default_theme(text: &str) -> Option<String> {
    replace_lines(text, &OLD_THEME_LINES, &THEME_LINES)
}

/// The font lines of the file older builds wrote on first run, when the
/// default letter was the modern one.
const OLD_FONT_LINES: [&str; 7] = [
    "# Se usa la primera fuente de la lista que esté disponible. JetBrains Mono",
    "# viene incluida en la terminal; las demás deben estar instaladas en el equipo.",
    "family = \"JetBrains Mono, Cascadia Code, Consolas, Menlo, DejaVu Sans Mono, monospace\"",
    "# Tamaño base. Ctrl + y Ctrl - lo cambian mientras trabajas; Ctrl 0 vuelve a este valor.",
    "size = 14",
    "# Alto de cada línea, como múltiplo del tamaño de la fuente.",
    "line_height = 1.2",
];
/// What replaces them: the lines of the file written today.
const FONT_LINES: [&str; 11] = [
    "# Se usa la primera fuente de la lista que esté disponible. VT323 (letra de",
    "# píxeles, como la de una terminal antigua) y JetBrains Mono vienen incluidas",
    "# en la terminal; las demás deben estar instaladas en el equipo.",
    "family = \"VT323, JetBrains Mono, Cascadia Code, Consolas, Menlo, DejaVu Sans Mono, monospace\"",
    "# Para una letra moderna, cambia la línea de arriba por esta, con size = 14",
    "# y line_height = 1.2:",
    "# family = \"JetBrains Mono, Cascadia Code, Consolas, Menlo, DejaVu Sans Mono, monospace\"",
    "# Tamaño base. Ctrl + y Ctrl - lo cambian mientras trabajas; Ctrl 0 vuelve a este valor.",
    "size = 20",
    "# Alto de cada línea, como múltiplo del tamaño de la fuente.",
    "line_height = 1.0",
];

/// The same for the letter: `text` with the pixel font of today, when it
/// still carries, whole and untouched, the font lines an older build wrote.
/// One changed value (a size the user liked) and the file is left alone.
pub fn adopt_default_font(text: &str) -> Option<String> {
    replace_lines(text, &OLD_FONT_LINES, &FONT_LINES)
}

/// `text` with every default an older build wrote brought up to date, or
/// `None` when there is nothing to change.
pub fn adopt_defaults(text: &str) -> Option<String> {
    let theme = adopt_default_theme(text);
    let font = adopt_default_font(theme.as_deref().unwrap_or(text));
    font.or(theme)
}

/// `text` with the lines `old`, found together and in order, replaced by
/// `new`. `None` when they are not there. The file keeps its line endings.
fn replace_lines(text: &str, old: &[&str], new: &[&str]) -> Option<String> {
    let lines: Vec<&str> = text.split_inclusive('\n').collect();
    let at = lines.windows(old.len()).position(|found| {
        found
            .iter()
            .zip(old)
            .all(|(line, wanted)| line.trim_end() == *wanted)
    })?;
    let ending = if lines[at].ends_with("\r\n") {
        "\r\n"
    } else {
        "\n"
    };
    let mut updated: String = lines[..at].concat();
    for line in new {
        updated.push_str(line);
        updated.push_str(ending);
    }
    updated.push_str(&lines[at + old.len()..].concat());
    Some(updated)
}

/// Keeps a file watch alive. The watch stops when this value is dropped.
pub struct ConfigWatcher {
    _watcher: RecommendedWatcher,
}

/// Calls `on_change` each time the content of the file at `path` changes.
///
/// A file with an error is reported as `Err`, so the caller can keep the last
/// good configuration and tell the user what is wrong.
pub fn watch<F>(path: &Path, on_change: F) -> Result<ConfigWatcher, ConfigError>
where
    F: Fn(Result<Config, ConfigError>) + Send + 'static,
{
    let file = path.to_path_buf();
    let folder = path
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from("."));
    let mut last_text = fs::read_to_string(path).ok();

    let mut watcher = notify::recommended_watcher(move |event: notify::Result<notify::Event>| {
        let Ok(event) = event else { return };
        let about_our_file = event
            .paths
            .iter()
            .any(|changed| changed.file_name() == file.file_name());
        if !about_our_file {
            return;
        }
        // Editors save in several steps (truncate, write, rename). A missing
        // or empty file is one of those steps, not a real edit.
        let Ok(text) = fs::read_to_string(&file) else {
            return;
        };
        if text.trim().is_empty() || last_text.as_deref() == Some(text.as_str()) {
            return;
        }
        on_change(Config::parse(&text));
        last_text = Some(text);
    })?;

    // Watch the folder, not the file: many editors replace the file on save,
    // and a watch on the old file would go silent.
    watcher.watch(&folder, RecursiveMode::NonRecursive)?;
    Ok(ConfigWatcher { _watcher: watcher })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc;
    use std::time::Duration;

    #[test]
    fn default_file_matches_the_defaults() {
        assert_eq!(Config::parse(DEFAULT_TOML).unwrap(), Config::default());
    }

    #[test]
    fn missing_keys_take_their_default() {
        let config = Config::parse("[theme]\nbackground = \"#000000\"\n").unwrap();

        assert_eq!(config.theme.background, "#000000");
        assert_eq!(config.theme.foreground, Theme::default().foreground);
        assert_eq!(config.font, Font::default());
    }

    #[test]
    fn reads_cursor_background_and_browser_settings() {
        let config = Config::parse(
            "[cursor]
style = 'bar'
blink = false
[background]
image = 'C:/fondos/noche.png'
dim = 0.5
[browser]
port = 9400
",
        )
        .unwrap();

        assert_eq!(config.cursor.style, CursorStyle::Bar);
        assert!(!config.cursor.blink);
        assert_eq!(config.background.image, "C:/fondos/noche.png");
        assert_eq!(config.background.dim, 0.5);
        assert_eq!(config.browser.port, 9400);
    }

    #[test]
    fn reads_input_settings() {
        let config = Config::parse(
            "[input]
suggestions = false
hints = false
history_size = 0
select_with = 'shift'
",
        )
        .unwrap();

        assert!(!config.input.suggestions);
        assert!(!config.input.hints);
        assert_eq!(config.input.history_size, 0);
        assert_eq!(config.input.select_with, SelectWith::Shift);
    }

    #[test]
    fn linux_commands_can_be_turned_off() {
        let config = Config::parse("linux_commands = false\n").unwrap();

        assert!(Config::default().linux_commands);
        assert!(!config.linux_commands);
    }

    #[test]
    fn an_unknown_cursor_style_is_an_error() {
        assert!(Config::parse(
            "[cursor]
style = 'wave'
"
        )
        .is_err());
    }

    #[test]
    fn a_theme_typo_is_reported_as_a_parse_error() {
        assert!(matches!(
            Config::parse(
                "[theme]
preset = 'neon'
"
            ),
            Err(ConfigError::Parse(_))
        ));
    }

    #[test]
    fn reads_agents_added_by_the_user() {
        let config =
            Config::parse("[[agents]]\nname = \"Aider\"\ncommand = \"aider --model sonnet\"\n")
                .unwrap();

        assert_eq!(config.agents.len(), 1);
        assert_eq!(config.agents[0].name, "Aider");
        assert_eq!(config.agents[0].command, "aider --model sonnet");
    }

    #[test]
    fn an_agent_without_a_command_is_an_error() {
        assert!(Config::parse("[[agents]]\nname = \"Aider\"\n").is_err());
    }

    #[test]
    fn unknown_keys_are_ignored_so_old_builds_read_new_files() {
        assert!(Config::parse("some_future_key = true\n").is_ok());
    }

    #[test]
    fn a_newer_version_is_rejected() {
        let error = Config::parse("version = 99\n").unwrap_err();

        assert!(matches!(error, ConfigError::UnsupportedVersion(99)));
    }

    #[test]
    fn invalid_toml_is_an_error() {
        assert!(matches!(
            Config::parse("font = "),
            Err(ConfigError::Parse(_))
        ));
    }

    #[test]
    fn first_run_writes_the_default_file() {
        let folder = tempfile::tempdir().unwrap();
        let path = folder.path().join("nested").join("config.toml");

        let config = load_or_create(&path).unwrap();

        assert_eq!(config, Config::default());
        assert_eq!(fs::read_to_string(&path).unwrap(), DEFAULT_TOML);
    }

    #[test]
    fn a_file_with_the_old_default_theme_gets_the_new_one() {
        let old = "padding = 8\r\n[theme]\r\n# Tema de partida: \"dark\", \"light\" o \"high-contrast\".\r\npreset = \"dark\"\r\n# background = \"#14161b\"\r\n";

        let updated = adopt_default_theme(old).unwrap();

        assert_eq!(Config::parse(&updated).unwrap().theme, Theme::default());
        assert!(updated.starts_with("padding = 8\r\n[theme]\r\n# Tema de partida: \"console\""));
        assert!(updated.ends_with("preset = \"console\"\r\n# background = \"#14161b\"\r\n"));
        // Done once: the new file is not touched again.
        assert_eq!(adopt_default_theme(&updated), None);
    }

    #[test]
    fn a_file_with_the_old_default_font_gets_the_pixel_one() {
        let old = format!("[font]\n{}\n\n[cursor]\n", OLD_FONT_LINES.join("\n"));

        let updated = adopt_defaults(&old).unwrap();

        assert_eq!(Config::parse(&updated).unwrap().font, Font::default());
        assert!(updated.ends_with("line_height = 1.0\n\n[cursor]\n"));
        assert_eq!(adopt_defaults(&updated), None);
    }

    #[test]
    fn the_font_lines_written_today_are_the_ones_of_the_default_file() {
        assert!(DEFAULT_TOML
            .replace("\r\n", "\n")
            .contains(&FONT_LINES.join("\n")));
    }

    #[test]
    fn a_font_the_user_changed_is_kept() {
        let old =
            format!("[font]\n{}\n", OLD_FONT_LINES.join("\n")).replace("size = 14", "size = 16");

        assert_eq!(adopt_defaults(&old), None);
    }

    #[test]
    fn a_theme_the_user_chose_is_kept() {
        // Chosen by hand: the comment of the old file is gone or the lines differ.
        assert_eq!(adopt_default_theme("[theme]\npreset = \"dark\"\n"), None);
        assert_eq!(
            adopt_default_theme(
                "# Tema de partida: \"dark\", \"light\" o \"high-contrast\".\npreset = \"light\"\n"
            ),
            None
        );
        assert_eq!(adopt_default_theme(DEFAULT_TOML), None);
    }

    #[test]
    fn an_old_file_on_disk_is_updated_when_loaded() {
        let folder = tempfile::tempdir().unwrap();
        let path = folder.path().join("config.toml");
        fs::write(
            &path,
            "[theme]\n# Tema de partida: \"dark\", \"light\" o \"high-contrast\".\npreset = \"dark\"\n",
        )
        .unwrap();

        let config = load_or_create(&path).unwrap();

        assert_eq!(config.theme, Theme::default());
        assert!(fs::read_to_string(&path)
            .unwrap()
            .ends_with("preset = \"console\"\n"));
    }

    #[test]
    fn watch_reports_an_edit() {
        let folder = tempfile::tempdir().unwrap();
        let path = folder.path().join("config.toml");
        load_or_create(&path).unwrap();
        let (tx, rx) = mpsc::channel();
        let _watcher = watch(&path, move |change| {
            let _ = tx.send(change);
        })
        .unwrap();

        fs::write(&path, "scrollback = 42\n").unwrap();

        let change = rx
            .recv_timeout(Duration::from_secs(15))
            .expect("the edit is reported");
        assert_eq!(change.unwrap().scrollback, 42);
    }
}
