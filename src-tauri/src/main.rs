//! Desktop shell of the terminal.
//!
//! This crate only wires things together: it owns the window, exposes the
//! core crates to the UI as IPC commands and forwards their events. Logic
//! belongs in `crates/`, where it can be tested without a window.

// No console window behind the app on Windows release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod state;

use tauri::{Manager, RunEvent};

/// Variables that tell the web view of Windows to start with other
/// switches, another browser program or another profile folder. One of the
/// switches opens a debugging port, and whoever connects to it controls
/// this window, which can start shells.
#[cfg(all(windows, not(debug_assertions)))]
const WEB_VIEW_OVERRIDES: [&str; 4] = [
    "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
    "WEBVIEW2_BROWSER_EXECUTABLE_FOLDER",
    "WEBVIEW2_USER_DATA_FOLDER",
    "WEBVIEW2_RELEASE_CHANNEL_PREFERENCE",
];

fn main() {
    // An installed build never takes them from its environment. This runs
    // before any other thread exists and before the web view is created.
    #[cfg(all(windows, not(debug_assertions)))]
    for name in WEB_VIEW_OVERRIDES {
        std::env::remove_var(name);
    }

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(state::AppState::load())
        .setup(|app| {
            state::watch_config(app.handle());
            // Pictures pasted days ago are private data nobody needs any more.
            commands::sweep_pasted_pictures();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_shells,
            commands::list_tools,
            commands::list_agents,
            commands::list_programs,
            commands::ssh_status,
            commands::get_config,
            commands::open_config_file,
            commands::open_app_folder,
            commands::list_templates,
            commands::apply_template,
            commands::clipboard_paste,
            commands::read_background,
            commands::load_workspace,
            commands::save_workspace,
            commands::pick_folder,
            commands::history_list,
            commands::history_add,
            commands::history_clear,
            commands::browser_status,
            commands::browser_open,
            commands::browser_close,
            commands::pty_spawn,
            commands::pty_write,
            commands::pty_resize,
            commands::pty_kill,
            commands::session_place,
            commands::open_folder,
            commands::paths_exist,
            commands::reveal_path,
        ])
        .build(tauri::generate_context!())
        .expect("the application failed to start");

    app.run(|handle, event| {
        if let RunEvent::Exit = event {
            handle.state::<state::AppState>().close_browser();
        }
    });
}
