//! State shared by every IPC command.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Mutex, MutexGuard, PoisonError};

use tauri::{AppHandle, Emitter, Manager};
use term_config::{Config, ConfigWatcher};
use term_pty::PtySession;
use term_shell::ShellProfile;

/// Event sent to the UI with the new configuration after a valid edit.
const CONFIG_CHANGED: &str = "config-changed";
/// Event sent to the UI with a message when the edited file has an error.
const CONFIG_ERROR: &str = "config-error";

pub struct AppState {
    sessions: Mutex<HashMap<u32, PtySession>>,
    next_session_id: AtomicU32,
    config: Mutex<Config>,
    config_path: Option<PathBuf>,
    /// Held only to keep the file watch alive.
    config_watcher: Mutex<Option<ConfigWatcher>>,
    /// Detected once at start: installing a shell needs a restart to show up.
    pub shells: Vec<ShellProfile>,
}

impl AppState {
    /// Reads the configuration and detects shells. A broken configuration
    /// file must not stop the terminal from opening, so it falls back to the
    /// defaults.
    pub fn load() -> Self {
        let config_path = term_config::default_path();
        let config = config_path
            .as_deref()
            .and_then(|path| match term_config::load_or_create(path) {
                Ok(config) => Some(config),
                Err(error) => {
                    eprintln!("using the default configuration: {error}");
                    None
                }
            })
            .unwrap_or_default();

        Self {
            sessions: Mutex::default(),
            next_session_id: AtomicU32::new(1),
            config: Mutex::new(config),
            config_path,
            config_watcher: Mutex::default(),
            shells: term_shell::detect_shells(),
        }
    }

    pub fn sessions(&self) -> MutexGuard<'_, HashMap<u32, PtySession>> {
        lock(&self.sessions)
    }

    pub fn next_session_id(&self) -> u32 {
        self.next_session_id.fetch_add(1, Ordering::Relaxed)
    }

    pub fn config(&self) -> Config {
        lock(&self.config).clone()
    }
}

/// Starts forwarding configuration edits to the UI.
pub fn watch_config(app: &AppHandle) {
    let state = app.state::<AppState>();
    let Some(path) = state.config_path.as_deref() else {
        return;
    };

    let handle = app.clone();
    let watcher = term_config::watch(path, move |change| match change {
        Ok(config) => {
            *lock(&handle.state::<AppState>().config) = config.clone();
            let _ = handle.emit(CONFIG_CHANGED, config);
        }
        // Keep the last good configuration and say what is wrong.
        Err(error) => {
            let _ = handle.emit(CONFIG_ERROR, error.to_string());
        }
    });

    match watcher {
        Ok(watcher) => *lock(&state.config_watcher) = Some(watcher),
        // The terminal still works; edits just need a restart.
        Err(error) => eprintln!("configuration will not reload on save: {error}"),
    }
}

/// A panic in another command must not take every later command down with it.
fn lock<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(PoisonError::into_inner)
}
