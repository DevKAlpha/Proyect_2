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

fn main() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
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
            commands::open_config_file,
            commands::read_background,
            commands::load_workspace,
            commands::save_workspace,
            commands::pick_folder,
            commands::browser_status,
            commands::browser_open,
            commands::browser_close,
            commands::pty_spawn,
            commands::pty_write,
            commands::pty_resize,
            commands::pty_kill,
        ])
        .build(tauri::generate_context!())
        .expect("the application failed to start");

    app.run(|handle, event| {
        if let RunEvent::Exit = event {
            handle.state::<state::AppState>().close_browser();
        }
    });
}
