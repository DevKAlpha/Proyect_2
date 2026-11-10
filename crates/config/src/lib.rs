//! User configuration.
//!
//! One TOML file the user can read and edit by hand. Every key is optional and
//! falls back to a default, so a short or old file keeps working. [`watch`]
//! reports edits while the app runs.

use std::fs;
use std::path::{Path, PathBuf};

use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};

/// Format version this build writes and understands.
pub const CURRENT_VERSION: u32 = 1;

/// The commented file written on first run. It must parse to [`Config::default`].
pub const DEFAULT_TOML: &str = include_str!("default.toml");

/// Folder name under the system configuration directory.
const APP_DIR: &str = "terminal";

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
    pub font: Font,
    pub theme: Theme,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct Font {
    /// CSS font list: the first available family wins. JetBrains Mono ships
    /// with the app, so it is available on every system.
    pub family: String,
    pub size: u16,
    /// Height of a row as a multiple of the font size.
    pub line_height: f32,
}

/// Colours as CSS hex strings (`#RRGGBB` or `#RRGGBBAA`).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct Theme {
    pub background: String,
    pub foreground: String,
    pub cursor: String,
    pub selection: String,
    pub accent: String,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            version: CURRENT_VERSION,
            default_shell: None,
            scrollback: 5000,
            font: Font::default(),
            theme: Theme::default(),
        }
    }
}

impl Default for Font {
    fn default() -> Self {
        Self {
            family: "JetBrains Mono, Cascadia Code, Consolas, Menlo, DejaVu Sans Mono, monospace"
                .into(),
            size: 14,
            line_height: 1.2,
        }
    }
}

impl Default for Theme {
    fn default() -> Self {
        Self {
            background: "#14161b".into(),
            foreground: "#d7dae0".into(),
            cursor: "#8ab4f8".into(),
            selection: "#8ab4f84d".into(),
            accent: "#8ab4f8".into(),
        }
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
    Config::parse(&fs::read_to_string(path)?)
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
