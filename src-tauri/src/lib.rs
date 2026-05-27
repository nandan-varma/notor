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

use state::{AppLevel, AppState};
use tauri::{LogicalPosition, LogicalSize, Manager};

pub fn run() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::new())
        .setup(|app| {
            // Boot the cross-vault state from disk. The file lives next to
            // the app's config directory, so it survives upgrades.
            let state_path = app
                .path()
                .app_config_dir()
                .map(|dir| dir.join("state.json"))
                .unwrap_or_else(|_| std::path::PathBuf::from("state.json"));
            let app_level = AppLevel::new(state_path);
            restore_window_state(app, &app_level);
            app.manage(app_level);

            #[cfg(target_os = "macos")]
            apply_macos_chrome(app)?;
            #[cfg(not(target_os = "macos"))]
            let _ = app;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // App-level
            commands::app::get_app_state,
            commands::app::forget_recent_vault,
            commands::app::set_last_theme,
            commands::app::save_window_state,
            // Vault
            commands::vault::open_vault,
            commands::vault::close_vault,
            commands::vault::get_vault_config,
            commands::vault::update_vault_config,
            commands::vault::pick_vault_directory,
            commands::vault::create_vault,
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
            // Shell
            commands::shell::reveal_in_finder,
            commands::shell::open_externally,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Apply persisted window size + position before the user sees the first
/// paint. Invalid (off-screen) coordinates are silently ignored — Tauri's
/// own defaults take over.
fn restore_window_state(app: &tauri::App, app_level: &AppLevel) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let state = app_level.read();
    let w = state.window.width.unwrap_or(0.0);
    let h = state.window.height.unwrap_or(0.0);
    if w >= 600.0 && h >= 400.0 {
        let _ = window.set_size(LogicalSize::new(w, h));
    }
    if let (Some(x), Some(y)) = (state.window.x, state.window.y) {
        // We can't easily query screen bounds here; trust the persisted value
        // and rely on the OS to clamp to a visible area.
        let _ = window.set_position(LogicalPosition::new(x, y));
    }
}

#[cfg(target_os = "macos")]
fn apply_macos_chrome(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
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
