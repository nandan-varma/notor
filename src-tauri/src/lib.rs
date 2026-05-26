//! Notor — Tauri backend library.
//!
//! The library boundary is intentionally narrow: `run()` wires plugins,
//! shared state, and command handlers. Everything else lives in dedicated
//! modules so commands stay testable in isolation.

mod commands;
mod error;
mod models;
mod state;
mod vault;

use state::AppState;
use tauri::Manager;

pub fn run() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::new())
        .setup(|app| {
            #[cfg(target_os = "macos")]
            apply_macos_chrome(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Vault
            commands::vault::open_vault,
            commands::vault::close_vault,
            commands::vault::get_vault_config,
            commands::vault::update_vault_config,
            commands::vault::pick_vault_directory,
            // Notes
            commands::fs::list_notes,
            commands::fs::read_note,
            commands::fs::write_note,
            commands::fs::create_note,
            commands::fs::rename_note,
            commands::fs::move_note,
            commands::fs::delete_note,
            commands::fs::duplicate_note,
            // Folders
            commands::folders::list_folders,
            commands::folders::create_folder,
            commands::folders::rename_folder,
            commands::folders::delete_folder,
            // Search
            commands::search::full_text_search,
            commands::search::rebuild_index,
            commands::search::get_backlinks,
            commands::search::get_tags,
            // Watcher
            commands::watcher::start_watching,
            commands::watcher::stop_watching,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(target_os = "macos")]
fn apply_macos_chrome(app: &tauri::App) -> tauri::Result<()> {
    use tauri::WebviewWindow;
    if let Some(window) = app.get_webview_window("main") {
        set_traffic_light_inset(&window);
    }
    Ok(())
}

#[cfg(target_os = "macos")]
#[allow(dead_code)]
fn set_traffic_light_inset(_window: &tauri::WebviewWindow) {
    // Tauri v2 already places traffic lights when titleBarStyle = "Overlay".
    // Reserve room for them in CSS via env(safe-area-inset-left) or a fixed 78px
    // gap; this hook is the place to fine-tune positioning later if needed
    // (using objc2 NSWindow APIs).
}
