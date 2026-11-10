//! State shared by every IPC command.

use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Child;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Mutex, MutexGuard, PoisonError};

use tauri::{AppHandle, Emitter, Manager};
use term_browser::Browser;
use term_config::{Config, ConfigWatcher, Workspace};
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
    workspace: Mutex<Workspace>,
    workspace_path: Option<PathBuf>,
    /// The test browser, while this app has one running.
    browser: Mutex<Option<Child>>,
    /// Detected once at start: installing a shell needs a restart to show up.
    pub shells: Vec<ShellProfile>,
    /// Detected once at start, like the shells.
    pub test_browser: Option<Browser>,
}

impl AppState {
    /// Reads the configuration and the saved projects, and detects shells.
    /// A broken file must not stop the terminal from opening, so each one
    /// falls back to its default.
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

        let workspace_path = term_config::workspace_path();
        let workspace = workspace_path
            .as_deref()
            .and_then(|path| match Workspace::load(path) {
                Ok(workspace) => Some(workspace),
                Err(error) => {
                    eprintln!("starting without saved projects: {error}");
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
            workspace: Mutex::new(workspace),
            workspace_path,
            browser: Mutex::default(),
            shells: term_shell::detect_shells(),
            test_browser: term_browser::find_browser(),
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

    pub fn config_path(&self) -> Option<&PathBuf> {
        self.config_path.as_ref()
    }

    pub fn workspace(&self) -> Workspace {
        lock(&self.workspace).clone()
    }

    /// Replaces the saved projects, in memory and on disk.
    pub fn set_workspace(&self, workspace: Workspace) -> Result<(), String> {
        if let Some(path) = &self.workspace_path {
            workspace.save(path).map_err(|error| error.to_string())?;
        }
        *lock(&self.workspace) = workspace;
        Ok(())
    }

    /// Folder a new terminal of `project` starts in, when it still exists.
    pub fn project_dir(&self, project: &str) -> Option<PathBuf> {
        lock(&self.workspace).project_dir(project)
    }

    /// Whether the test browser started by this app is still open. The user
    /// can close its window at any time.
    pub fn browser_running(&self) -> bool {
        let mut browser = lock(&self.browser);
        let running = matches!(browser.as_mut().map(Child::try_wait), Some(Ok(None)));
        if !running {
            *browser = None;
        }
        running
    }

    /// Starts the test browser if it is not already open.
    pub fn open_browser(&self) -> Result<(), String> {
        if self.browser_running() {
            return Ok(());
        }
        let browser = self
            .test_browser
            .as_ref()
            .ok_or("no Chrome, Edge or Chromium was found on this machine")?;
        let profile = dirs::data_local_dir()
            .ok_or("this system has no folder for application data")?
            .join("terminal")
            .join("browser-profile");
        let port = lock(&self.config).browser.port;
        let child =
            term_browser::launch(browser, port, &profile).map_err(|error| error.to_string())?;
        *lock(&self.browser) = Some(child);
        Ok(())
    }

    /// Stops the test browser. Also called when the app exits: a browser that
    /// accepts remote control must not outlive the terminal that opened it.
    pub fn close_browser(&self) {
        if let Some(mut child) = lock(&self.browser).take() {
            let _ = child.kill();
            let _ = child.wait();
        }
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
