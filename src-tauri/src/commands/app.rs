//! App-level (cross-vault) commands: recent vaults, window state,
//! restored-on-launch metadata.

use crate::error::Result;
use crate::state::{AppLevel, AppLevelState, WindowState};
use tauri::State;

#[tauri::command]
pub async fn get_app_state(app: State<'_, AppLevel>) -> Result<AppLevelState> {
    Ok(app.read())
}

#[tauri::command]
pub async fn forget_recent_vault(path: String, app: State<'_, AppLevel>) -> Result<AppLevelState> {
    app.with_mut(|s| {
        s.recent_vaults.retain(|v| v.path != path);
        if s.last_vault.as_deref() == Some(path.as_str()) {
            s.last_vault = None;
        }
    });
    Ok(app.read())
}

#[tauri::command]
pub async fn set_last_theme(theme: String, app: State<'_, AppLevel>) -> Result<()> {
    app.with_mut(|s| s.last_theme = Some(theme));
    Ok(())
}

#[tauri::command]
pub async fn save_window_state(state: WindowState, app: State<'_, AppLevel>) -> Result<()> {
    app.with_mut(|s| s.window = state);
    Ok(())
}
