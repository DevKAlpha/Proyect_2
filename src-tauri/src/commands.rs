//! IPC commands the UI can call. Each one is a thin call into a core crate.

use std::path::Path;

use serde::Serialize;
use tauri::ipc::{Channel, InvokeResponseBody, Response};
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;
use term_browser::Connector;
use term_config::{Config, Workspace};
use term_pty::{PtySession, SpawnOptions};
use term_shell::ShellProfile;
use term_tools::{AgentStatus, ToolStatus};

use crate::state::AppState;

/// Image types the background accepts. The file is handed to the web view,
/// so only formats it draws as plain pictures are allowed.
const IMAGE_EXTENSIONS: [&str; 5] = ["png", "jpg", "jpeg", "webp", "gif"];
/// Larger pictures cost memory in every tab for no visible gain.
const MAX_IMAGE_BYTES: u64 = 25 * 1024 * 1024;

/// Shells the user can open, best default first.
#[tauri::command]
pub fn list_shells(state: State<'_, AppState>) -> Vec<ShellProfile> {
    state.shells.clone()
}

/// Developer tools and whether each one is installed. Checked on every call,
/// because the user may have just installed one.
#[tauri::command]
pub fn list_tools() -> Vec<ToolStatus> {
    term_tools::detect()
}

/// Known AI agents and whether each one is installed. Checked on every call.
#[tauri::command]
pub fn list_agents() -> Vec<AgentStatus> {
    term_tools::detect_agents()
}

#[tauri::command]
pub fn get_config(state: State<'_, AppState>) -> Config {
    state.config()
}

/// Opens the configuration file in the user's editor. Customising the
/// terminal should not start with a hunt for a hidden folder.
#[tauri::command]
pub fn open_config_file(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let path = state
        .config_path()
        .ok_or("this system has no configuration folder")?;
    app.opener()
        .open_path(path.to_string_lossy(), None::<&str>)
        .map_err(|error| error.to_string())
}

/// The background picture named in the configuration, as raw bytes.
///
/// The UI never sends a path: it can only get the one file the user chose
/// in their own configuration.
#[tauri::command]
pub async fn read_background(state: State<'_, AppState>) -> Result<Response, String> {
    let image = state.config().background.image;
    let path = Path::new(&image);
    let extension = path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(str::to_ascii_lowercase)
        .unwrap_or_default();
    if !IMAGE_EXTENSIONS.contains(&extension.as_str()) {
        return Err(format!(
            "the background must be a PNG, JPG, WebP or GIF file: {image}"
        ));
    }
    let size = std::fs::metadata(path)
        .map_err(|error| format!("could not open the background image {image}: {error}"))?
        .len();
    if size > MAX_IMAGE_BYTES {
        return Err(format!(
            "the background image is larger than 25 MB: {image}"
        ));
    }
    std::fs::read(path)
        .map(Response::new)
        .map_err(|error| format!("could not read the background image {image}: {error}"))
}

/// The saved projects and their terminals.
#[tauri::command]
pub fn load_workspace(state: State<'_, AppState>) -> Workspace {
    state.workspace()
}

#[tauri::command]
pub fn save_workspace(state: State<'_, AppState>, workspace: Workspace) -> Result<(), String> {
    state.set_workspace(workspace)
}

/// Lets the user choose the folder of a new project. Returns `None` when
/// they cancel. The dialog belongs to the system, not to the web view.
#[tauri::command]
pub async fn pick_folder(app: AppHandle) -> Option<String> {
    let folder = app.dialog().file().blocking_pick_folder()?;
    let path = folder.into_path().ok()?;
    Some(path.to_string_lossy().into_owned())
}

/// The commands the user ran before, oldest first.
#[tauri::command]
pub fn history_list(state: State<'_, AppState>) -> Vec<String> {
    state.history()
}

/// Remembers a command the user just ran and returns the list as it is now.
/// What is worth remembering is decided by `term-history`, not by the UI.
#[tauri::command]
pub fn history_add(state: State<'_, AppState>, command: String) -> Vec<String> {
    state.record_command(&command)
}

#[tauri::command]
pub fn history_clear(state: State<'_, AppState>) {
    state.clear_history();
}

/// What the UI needs to know about the test browser.
#[derive(Serialize)]
pub struct BrowserStatus {
    /// Name of the browser found on this machine, if any.
    browser: Option<&'static str>,
    running: bool,
    /// Address agents connect to while it runs.
    endpoint: String,
    /// One-time commands that register the browser with each agent.
    connectors: Vec<Connector>,
}

#[tauri::command]
pub fn browser_status(state: State<'_, AppState>) -> BrowserStatus {
    let port = state.config().browser.port;
    BrowserStatus {
        browser: state.test_browser.as_ref().map(|browser| browser.name),
        running: state.browser_running(),
        endpoint: term_browser::endpoint(port),
        connectors: term_browser::connectors(port),
    }
}

/// Opens the test browser. Only ever started by this explicit request.
#[tauri::command]
pub fn browser_open(state: State<'_, AppState>) -> Result<BrowserStatus, String> {
    state.open_browser()?;
    Ok(browser_status(state))
}

#[tauri::command]
pub fn browser_close(state: State<'_, AppState>) -> BrowserStatus {
    state.close_browser();
    browser_status(state)
}

/// Starts a shell and returns the id of its session.
///
/// Output goes through `on_data` as raw bytes: JSON would cost a copy and an
/// encode per chunk, and chunks can end in the middle of a character.
#[tauri::command]
pub fn pty_spawn(
    state: State<'_, AppState>,
    shell_id: String,
    project_id: Option<String>,
    cols: u16,
    rows: u16,
    on_data: Channel<InvokeResponseBody>,
    on_exit: Channel<Option<u32>>,
) -> Result<u32, String> {
    // The UI sends ids, never paths: it must not be able to run anything
    // that was not detected on this machine, nor start it anywhere but in a
    // folder the user registered as a project.
    let shell = state
        .shells
        .iter()
        .find(|shell| shell.id == shell_id)
        .ok_or_else(|| format!("unknown shell: {shell_id}"))?;
    let cwd = project_id
        .and_then(|project| state.project_dir(&project))
        .or_else(dirs::home_dir);

    // The shell marks its prompt, so the terminal knows which text is the
    // command being typed. Suggestions and editing by selection rest on it.
    let marks = term_shell::prompt_marks(&shell.id, &|key| std::env::var(key).ok());
    let mut args = shell.args.clone();
    args.extend(marks.args);
    let mut env = marks.env;
    // A tool installed after the app started must work in the next tab.
    if let Some(path) = term_tools::fresh_path() {
        env.push(("PATH".to_owned(), path.to_string_lossy().into_owned()));
    }

    let options = SpawnOptions {
        program: shell.program.clone(),
        args,
        cwd,
        env,
        cols,
        rows,
    };
    let session = PtySession::spawn(
        options,
        move |bytes| {
            // Fails only when the tab is already gone.
            let _ = on_data.send(InvokeResponseBody::Raw(bytes.to_vec()));
        },
        move |code| {
            let _ = on_exit.send(code);
        },
    )
    .map_err(|error| error.to_string())?;

    let id = state.next_session_id();
    state.sessions().insert(id, session);
    Ok(id)
}

#[tauri::command]
pub fn pty_write(state: State<'_, AppState>, id: u32, data: String) -> Result<(), String> {
    match state.sessions().get_mut(&id) {
        Some(session) => session
            .write(data.as_bytes())
            .map_err(|error| error.to_string()),
        // The shell just exited and the tab is closing: nothing to send to.
        None => Ok(()),
    }
}

#[tauri::command]
pub fn pty_resize(state: State<'_, AppState>, id: u32, cols: u16, rows: u16) -> Result<(), String> {
    match state.sessions().get(&id) {
        Some(session) => session
            .resize(cols, rows)
            .map_err(|error| error.to_string()),
        None => Ok(()),
    }
}

/// Ends a session. The UI calls this for every tab it closes, also after the
/// shell exited by itself, so this is the only place sessions are freed.
#[tauri::command]
pub fn pty_kill(state: State<'_, AppState>, id: u32) {
    // Dropping the session kills the process and closes the pseudo-terminal.
    state.sessions().remove(&id);
}
