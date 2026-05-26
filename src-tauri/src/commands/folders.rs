//! Folder commands. Folders correspond directly to filesystem directories
//! under the vault root.

use crate::error::{NotorError, Result};
use crate::models::FolderInfo;
use crate::state::AppState;
use crate::vault;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::State;

fn require_vault(state: &State<'_, AppState>) -> Result<PathBuf> {
    state.vault_path().ok_or(NotorError::NoVault)
}

#[tauri::command]
pub async fn list_folders(state: State<'_, AppState>) -> Result<Vec<FolderInfo>> {
    let root = require_vault(&state)?;
    let notor = vault::notor_dir(&root);
    let notes = state.read().notes.clone();
    let count_for = |abs_dir: &Path| -> usize {
        notes
            .values()
            .filter(|n| n.path.starts_with(abs_dir.to_string_lossy().as_ref()))
            .count()
    };

    fn walk(
        root: &Path,
        notor: &Path,
        dir: &Path,
        count_for: &impl Fn(&Path) -> usize,
    ) -> Vec<FolderInfo> {
        let mut out = vec![];
        let Ok(entries) = fs::read_dir(dir) else {
            return out;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            if path.starts_with(notor) {
                continue;
            }
            if path
                .file_name()
                .and_then(|s| s.to_str())
                .map(|s| s.starts_with('.'))
                .unwrap_or(false)
            {
                continue;
            }
            let name = path.file_name().unwrap().to_string_lossy().to_string();
            let relative = path
                .strip_prefix(root)
                .unwrap_or(&path)
                .to_string_lossy()
                .to_string();
            let children = walk(root, notor, &path, count_for);
            out.push(FolderInfo {
                name,
                relative_path: relative,
                absolute_path: path.to_string_lossy().to_string(),
                note_count: count_for(&path),
                children,
            });
        }
        out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
        out
    }

    Ok(walk(&root, &notor, &root, &count_for))
}

#[tauri::command]
pub async fn create_folder(path: String, state: State<'_, AppState>) -> Result<()> {
    let root = require_vault(&state)?;
    let dest = vault::resolve_in_vault(&root, &path)?;
    fs::create_dir_all(&dest)?;
    Ok(())
}

#[tauri::command]
pub async fn rename_folder(
    path: String,
    new_name: String,
    state: State<'_, AppState>,
) -> Result<()> {
    let root = require_vault(&state)?;
    let src = vault::resolve_in_vault(&root, &path)?;
    if !src.exists() {
        return Err(NotorError::NotFound(path));
    }
    let parent = src
        .parent()
        .ok_or_else(|| NotorError::Other("folder has no parent".into()))?;
    let dest = parent.join(new_name);
    fs::rename(&src, &dest)?;

    // Update in-memory index paths so we don't surface stale entries.
    let mut inner = state.write();
    let mut updates: Vec<(PathBuf, PathBuf, String)> = vec![];
    for (p, id) in &inner.by_path {
        if let Ok(rel) = p.strip_prefix(&src) {
            let new_path = dest.join(rel);
            updates.push((p.clone(), new_path, id.clone()));
        }
    }
    for (old, new, id) in updates {
        inner.by_path.remove(&old);
        inner.by_path.insert(new.clone(), id.clone());
        if let Some(note) = inner.notes.get_mut(&id) {
            note.path = new.to_string_lossy().to_string();
            if let Ok(rel) = new.strip_prefix(&root) {
                note.relative_path = rel.to_string_lossy().to_string();
                note.folder = new
                    .parent()
                    .and_then(|p| p.strip_prefix(&root).ok())
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_default();
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn delete_folder(path: String, state: State<'_, AppState>) -> Result<()> {
    let root = require_vault(&state)?;
    let src = vault::resolve_in_vault(&root, &path)?;
    if !src.exists() {
        return Ok(());
    }
    // Move the entire folder into trash to preserve recovery.
    let trash = vault::notor_dir(&root).join("trash");
    fs::create_dir_all(&trash)?;
    let name = src
        .file_name()
        .ok_or_else(|| NotorError::Other("no folder name".into()))?
        .to_string_lossy()
        .to_string();
    let mut dest = trash.join(&name);
    let mut counter = 2;
    while dest.exists() {
        dest = trash.join(format!("{}-{}", name, counter));
        counter += 1;
    }
    fs::rename(&src, &dest)?;

    // Evict notes under this folder from the in-memory index.
    let mut inner = state.write();
    let evict_paths: Vec<PathBuf> = inner
        .by_path
        .keys()
        .filter(|p| p.starts_with(&src))
        .cloned()
        .collect();
    for p in evict_paths {
        if let Some(id) = inner.by_path.remove(&p) {
            inner.notes.remove(&id);
        }
    }
    Ok(())
}
