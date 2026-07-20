//! Vault open/close/config commands.

use crate::error::{NotorError, Result};
use crate::models::{VaultConfig, VaultMeta};
use crate::state::{AppLevel, AppState};
use crate::vault;
use std::fs;
use std::path::PathBuf;
use tauri::State;

const CONFIG_FILE: &str = "config.json";

fn config_path(vault_root: &std::path::Path) -> PathBuf {
    vault::notor_dir(vault_root).join(CONFIG_FILE)
}

fn ensure_notor_dir(vault_root: &std::path::Path) -> Result<()> {
    let dir = vault::notor_dir(vault_root);
    if !dir.exists() {
        fs::create_dir_all(&dir)?;
    }
    Ok(())
}

fn load_or_init_config(vault_root: &std::path::Path) -> Result<VaultConfig> {
    let path = config_path(vault_root);
    if path.exists() {
        let raw = fs::read_to_string(&path)?;
        let cfg: VaultConfig = serde_json::from_str(&raw).unwrap_or_default();
        Ok(cfg)
    } else {
        ensure_notor_dir(vault_root)?;
        let cfg = VaultConfig::default();
        fs::write(&path, serde_json::to_string_pretty(&cfg)?)?;
        Ok(cfg)
    }
}

#[tauri::command]
pub async fn open_vault(
    path: String,
    state: State<'_, AppState>,
    app: State<'_, AppLevel>,
) -> Result<VaultMeta> {
    let root = PathBuf::from(&path);
    if !root.exists() {
        return Err(NotorError::NotFound(path.clone()));
    }
    let canonical = dunce::canonicalize(&root)?;
    ensure_notor_dir(&canonical)?;
    let config = load_or_init_config(&canonical)?;

    // Build initial index AND prime the body cache so search doesn't have
    // to re-read every file on each query.
    let files = vault::scan_markdown_files(&canonical)?;
    let mut notes = std::collections::HashMap::new();
    let mut by_path = std::collections::HashMap::new();
    let mut bodies = std::collections::HashMap::new();
    for file in &files {
        match vault::read_and_index(&canonical, file) {
            Ok((idx, body)) => {
                by_path.insert(file.clone(), idx.id.clone());
                bodies.insert(idx.id.clone(), body);
                notes.insert(idx.id.clone(), idx);
            }
            Err(e) => log::warn!("indexing {} failed: {}", file.display(), e),
        }
    }
    let note_count = notes.len();

    {
        let mut inner = state.write();
        inner.vault_path = Some(canonical.clone());
        inner.config = config.clone();
        inner.notes = notes;
        inner.by_path = by_path;
        inner.bodies = bodies;
    }

    // Track in recent vaults for restore-on-launch.
    let display_name = config.name.clone();
    let canonical_str = canonical.to_string_lossy().to_string();
    app.with_mut(|s| s.upsert_recent(canonical_str.clone(), display_name));

    Ok(VaultMeta {
        path: canonical_str,
        config,
        note_count,
    })
}

#[tauri::command]
pub async fn close_vault(state: State<'_, AppState>) -> Result<()> {
    let mut inner = state.write();
    inner.vault_path = None;
    inner.notes.clear();
    inner.by_path.clear();
    inner.bodies.clear();
    Ok(())
}

#[tauri::command]
pub async fn get_vault_config(state: State<'_, AppState>) -> Result<VaultConfig> {
    Ok(state.read().config.clone())
}

#[tauri::command]
pub async fn update_vault_config(config: VaultConfig, state: State<'_, AppState>) -> Result<()> {
    let vault_path = state.vault_path().ok_or(NotorError::NoVault)?;
    let cfg_path = config_path(&vault_path);
    fs::write(&cfg_path, serde_json::to_string_pretty(&config)?)?;
    state.write().config = config;
    Ok(())
}

#[tauri::command]
pub async fn pick_vault_directory() -> Result<Option<String>> {
    // Stub: the frontend handles the dialog directly via tauri-plugin-dialog.
    // Kept as a command for future native menu integration.
    Ok(None)
}

/// Validate a vault name. Returns the trimmed name or a user-facing error.
/// Exposed for tests; callers should usually go through `create_vault`.
pub fn sanitize_vault_name(name: &str) -> Result<&str> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err(NotorError::Other("vault name is required".into()));
    }
    if trimmed.contains(['/', '\\'])
        || trimmed == "."
        || trimmed == ".."
        || trimmed.starts_with('.')
    {
        return Err(NotorError::Other(
            "vault name must not contain slashes or start with a dot".into(),
        ));
    }
    Ok(trimmed)
}

/// Create a new vault directory at `{parent}/{name}` and initialize its
/// `.notor/` sidecar. Returns the absolute path so the caller can immediately
/// `open_vault` on it.
///
/// If the target already exists we don't error — initializing `.notor/` on top
/// of an existing folder is a no-op, which lets users create + open in one
/// step even if they accidentally re-run.
#[tauri::command]
pub async fn create_vault(parent: String, name: String) -> Result<String> {
    let trimmed = sanitize_vault_name(&name)?;
    let parent_path = PathBuf::from(&parent);
    if !parent_path.exists() {
        return Err(NotorError::NotFound(parent));
    }
    let canonical_parent = dunce::canonicalize(&parent_path)?;
    let target = canonical_parent.join(trimmed);

    if !target.exists() {
        fs::create_dir_all(&target)?;
    }
    ensure_notor_dir(&target)?;
    load_or_init_config(&target)?;

    Ok(target.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_accepts_simple_names() {
        assert_eq!(sanitize_vault_name("My Vault").unwrap(), "My Vault");
        assert_eq!(sanitize_vault_name("  trimmed  ").unwrap(), "trimmed");
    }

    #[test]
    fn sanitize_rejects_empty_and_dot_names() {
        assert!(sanitize_vault_name("").is_err());
        assert!(sanitize_vault_name("   ").is_err());
        assert!(sanitize_vault_name(".").is_err());
        assert!(sanitize_vault_name("..").is_err());
        assert!(sanitize_vault_name(".hidden").is_err());
    }

    #[test]
    fn sanitize_rejects_slashes() {
        assert!(sanitize_vault_name("a/b").is_err());
        assert!(sanitize_vault_name("a\\b").is_err());
        assert!(sanitize_vault_name("../escape").is_err());
    }
}
