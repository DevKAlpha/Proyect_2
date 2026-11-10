//! Desktop shell of the terminal.
//!
//! This crate only wires things together: it owns the window, exposes the
//! core crates to the UI as IPC commands and forwards their events. Logic
//! belongs in `crates/`, where it can be tested without a window.

// No console window behind the app on Windows release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod state;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .manage(state::AppState::load())
        .setup(|app| {
            state::watch_config(app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_shells,
            commands::list_tools,
            commands::list_agents,
            commands::get_config,
            commands::pty_spawn,
            commands::pty_write,
            commands::pty_resize,
            commands::pty_kill,
        ])
        .run(tauri::generate_context!())
        .expect("the application failed to start");
}
