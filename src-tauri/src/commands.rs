//! IPC commands the UI can call. Each one is a thin call into a core crate.

use tauri::ipc::{Channel, InvokeResponseBody};
use tauri::State;
use term_config::Config;
use term_pty::{PtySession, SpawnOptions};
use term_shell::ShellProfile;
use term_tools::{AgentStatus, ToolStatus};

use crate::state::AppState;

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

/// Starts a shell and returns the id of its session.
///
/// Output goes through `on_data` as raw bytes: JSON would cost a copy and an
/// encode per chunk, and chunks can end in the middle of a character.
#[tauri::command]
pub fn pty_spawn(
    state: State<'_, AppState>,
    shell_id: String,
    cols: u16,
    rows: u16,
    on_data: Channel<InvokeResponseBody>,
    on_exit: Channel<Option<u32>>,
) -> Result<u32, String> {
    // The UI sends an id, never a path: it must not be able to run anything
    // that was not detected on this machine.
    let shell = state
        .shells
        .iter()
        .find(|shell| shell.id == shell_id)
        .ok_or_else(|| format!("unknown shell: {shell_id}"))?;

    let options = SpawnOptions {
        program: shell.program.clone(),
        args: shell.args.clone(),
        cwd: dirs::home_dir(),
        // A tool installed after the app started must work in the next tab.
        env: term_tools::fresh_path()
            .map(|path| ("PATH".to_owned(), path.to_string_lossy().into_owned()))
            .into_iter()
            .collect(),
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
