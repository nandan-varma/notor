//! Note CRUD commands. Every disk write goes through `atomic_write` so we
//! never leave a half-written file if the process dies mid-save.

use crate::error::{NotorError, Result};
use crate::models::{NoteContent, NoteFrontMatter, NoteIndex, NoteStatus};
use crate::state::AppState;
use crate::vault;
use chrono::Utc;
use std::fs;
use std::io::Write as _;
use std::path::{Path, PathBuf};
use tauri::State;

fn require_vault(state: &State<'_, AppState>) -> Result<PathBuf> {
    state.vault_path().ok_or(NotorError::NoVault)
}

/// tempfile-in-same-dir + rename = atomic write on all major filesystems.
fn atomic_write(path: &Path, content: &str) -> Result<()> {
    let parent = path
        .parent()
        .ok_or_else(|| NotorError::Other("path has no parent".into()))?;
    fs::create_dir_all(parent)?;
    let mut tmp = tempfile::NamedTempFile::new_in(parent)?;
    tmp.write_all(content.as_bytes())?;
    tmp.as_file_mut().sync_all()?;
    tmp.persist(path)
        .map_err(|e| NotorError::Io(e.error))?;
    Ok(())
}

#[tauri::command]
pub async fn list_notes(
    folder: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<NoteIndex>> {
    let inner = state.read();
    let mut notes: Vec<NoteIndex> = inner
        .notes
        .values()
        .filter(|n| match &folder {
            Some(f) if !f.is_empty() => &n.folder == f,
            _ => true,
        })
        .filter(|n| n.status != NoteStatus::Trash)
        .cloned()
        .collect();
    notes.sort_by(|a, b| b.modified.cmp(&a.modified));
    Ok(notes)
}

#[tauri::command]
pub async fn read_note(path: String, state: State<'_, AppState>) -> Result<NoteContent> {
    let root = require_vault(&state)?;
    let resolved = vault::resolve_in_vault(&root, &path)?;
    if !resolved.exists() {
        return Err(NotorError::NotFound(path));
    }
    let raw = fs::read_to_string(&resolved)?;
    let (fm_str, body) = vault::split_front_matter(&raw);
    let front_matter = vault::parse_front_matter(fm_str);
    let index = vault::index_from_disk(&root, &resolved)?;

    // Keep the in-memory index hot.
    {
        let mut inner = state.write();
        inner.by_path.insert(resolved.clone(), index.id.clone());
        inner.notes.insert(index.id.clone(), index.clone());
    }

    Ok(NoteContent {
        raw: raw.clone(),
        front_matter,
        body: body.to_string(),
        index,
    })
}

#[tauri::command]
pub async fn write_note(
    path: String,
    content: String,
    state: State<'_, AppState>,
) -> Result<NoteIndex> {
    let root = require_vault(&state)?;
    let resolved = vault::resolve_in_vault(&root, &path)?;

    // Stamp `modified` on every save. If front matter exists, update it in place;
    // otherwise leave the body as-is (the editor controls front-matter on writes
    // it understands).
    let stamped = stamp_modified(&content)?;
    atomic_write(&resolved, &stamped)?;

    let index = vault::index_from_disk(&root, &resolved)?;
    {
        let mut inner = state.write();
        inner.by_path.insert(resolved.clone(), index.id.clone());
        inner.notes.insert(index.id.clone(), index.clone());
    }
    Ok(index)
}

fn stamp_modified(raw: &str) -> Result<String> {
    let (fm_str, body) = vault::split_front_matter(raw);
    let Some(fm_str) = fm_str else {
        return Ok(raw.to_string());
    };
    let mut fm = vault::parse_front_matter(Some(fm_str));
    fm.modified = Some(Utc::now());
    vault::compose_file(&fm, body)
}

#[tauri::command]
pub async fn create_note(
    folder: String,
    title: String,
    state: State<'_, AppState>,
) -> Result<NoteIndex> {
    let root = require_vault(&state)?;
    let folder_path = if folder.is_empty() {
        root.clone()
    } else {
        vault::resolve_in_vault(&root, &folder)?
    };
    fs::create_dir_all(&folder_path)?;

    let slug = vault::slugify(&title);
    let path = vault::unique_note_path(&folder_path, &slug);

    let now = Utc::now();
    let fm = NoteFrontMatter {
        id: Some(vault::new_note_id()),
        title: Some(title.clone()),
        created: Some(now),
        modified: Some(now),
        tags: vec![],
        pinned: false,
        collection: None,
        status: Some(NoteStatus::Active),
        cover: None,
        aliases: vec![],
    };
    let file = vault::compose_file(&fm, &format!("# {}\n\n", title))?;
    atomic_write(&path, &file)?;

    let index = vault::index_from_disk(&root, &path)?;
    {
        let mut inner = state.write();
        inner.by_path.insert(path.clone(), index.id.clone());
        inner.notes.insert(index.id.clone(), index.clone());
    }
    Ok(index)
}

#[tauri::command]
pub async fn rename_note(
    path: String,
    new_title: String,
    state: State<'_, AppState>,
) -> Result<NoteIndex> {
    let root = require_vault(&state)?;
    let old = vault::resolve_in_vault(&root, &path)?;
    if !old.exists() {
        return Err(NotorError::NotFound(path));
    }
    // Rename file (slug derived) and update front-matter title in one shot.
    let parent = old.parent().unwrap().to_path_buf();
    let slug = vault::slugify(&new_title);
    let new_path = vault::unique_note_path(&parent, &slug);

    // Read, mutate front matter, write to new path, remove old.
    let raw = fs::read_to_string(&old)?;
    let (fm_str, body) = vault::split_front_matter(&raw);
    let mut fm = vault::parse_front_matter(fm_str);
    fm.title = Some(new_title);
    fm.modified = Some(Utc::now());
    let composed = vault::compose_file(&fm, body)?;
    atomic_write(&new_path, &composed)?;
    if new_path != old {
        fs::remove_file(&old)?;
    }

    let index = vault::index_from_disk(&root, &new_path)?;
    {
        let mut inner = state.write();
        inner.by_path.remove(&old);
        inner.by_path.insert(new_path.clone(), index.id.clone());
        inner.notes.insert(index.id.clone(), index.clone());
    }
    Ok(index)
}

#[tauri::command]
pub async fn move_note(
    path: String,
    dest_folder: String,
    state: State<'_, AppState>,
) -> Result<NoteIndex> {
    let root = require_vault(&state)?;
    let src = vault::resolve_in_vault(&root, &path)?;
    let dest_dir = if dest_folder.is_empty() {
        root.clone()
    } else {
        vault::resolve_in_vault(&root, &dest_folder)?
    };
    fs::create_dir_all(&dest_dir)?;
    let filename = src
        .file_name()
        .ok_or_else(|| NotorError::Other("no filename".into()))?;
    let dest = dest_dir.join(filename);
    fs::rename(&src, &dest)?;

    let index = vault::index_from_disk(&root, &dest)?;
    {
        let mut inner = state.write();
        inner.by_path.remove(&src);
        inner.by_path.insert(dest.clone(), index.id.clone());
        inner.notes.insert(index.id.clone(), index.clone());
    }
    Ok(index)
}

#[tauri::command]
pub async fn delete_note(path: String, state: State<'_, AppState>) -> Result<()> {
    let root = require_vault(&state)?;
    let src = vault::resolve_in_vault(&root, &path)?;
    if !src.exists() {
        return Ok(());
    }
    let trash = vault::notor_dir(&root).join("trash");
    fs::create_dir_all(&trash)?;
    let filename = src
        .file_name()
        .ok_or_else(|| NotorError::Other("no filename".into()))?;
    let mut dest = trash.join(filename);
    let mut counter = 2;
    while dest.exists() {
        dest = trash.join(format!(
            "{}-{}.md",
            src.file_stem().unwrap().to_string_lossy(),
            counter
        ));
        counter += 1;
    }
    fs::rename(&src, &dest)?;
    {
        let mut inner = state.write();
        if let Some(id) = inner.by_path.remove(&src) {
            inner.notes.remove(&id);
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn duplicate_note(
    path: String,
    state: State<'_, AppState>,
) -> Result<NoteIndex> {
    let root = require_vault(&state)?;
    let src = vault::resolve_in_vault(&root, &path)?;
    if !src.exists() {
        return Err(NotorError::NotFound(path));
    }
    let raw = fs::read_to_string(&src)?;
    let (fm_str, body) = vault::split_front_matter(&raw);
    let mut fm = vault::parse_front_matter(fm_str);
    let now = Utc::now();
    fm.id = Some(vault::new_note_id());
    fm.title = Some(format!("{} (copy)", fm.title.clone().unwrap_or_default()));
    fm.created = Some(now);
    fm.modified = Some(now);

    let parent = src.parent().unwrap().to_path_buf();
    let slug = vault::slugify(fm.title.as_deref().unwrap_or("untitled-copy"));
    let new_path = vault::unique_note_path(&parent, &slug);
    let composed = vault::compose_file(&fm, body)?;
    atomic_write(&new_path, &composed)?;

    let index = vault::index_from_disk(&root, &new_path)?;
    {
        let mut inner = state.write();
        inner.by_path.insert(new_path.clone(), index.id.clone());
        inner.notes.insert(index.id.clone(), index.clone());
    }
    Ok(index)
}
