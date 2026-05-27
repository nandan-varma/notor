//! File watcher — uses native FSEvents on macOS via the `notify` crate.
//!
//! The watcher does two things for every event:
//!   1. Updates the in-memory body cache so search stays in sync.
//!   2. Re-emits events to the frontend so stores update without polling.
//!
//! Suppression: when the app itself writes a note, the resulting FS event
//! would create a useless round-trip. `register_self_write` lets the fs
//! commands flag the path they just wrote so we ignore the next modify on
//! it within a short window.

use crate::error::{NotorError, Result};
use crate::state::AppState;
use crate::vault;
use chrono::Utc;
use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use parking_lot::Mutex;
use serde::Serialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::mpsc::channel;
use std::sync::{Arc, OnceLock};
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, State};

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct DeletedPayload {
    path: String,
}

static WATCHER_HANDLE: OnceLock<Arc<Mutex<Option<RecommendedWatcher>>>> = OnceLock::new();

/// Recently self-written paths — paths the app wrote via write_note within
/// `SELF_WRITE_WINDOW` are skipped to avoid bouncing our own writes through
/// the watcher.
static SELF_WRITES: OnceLock<Arc<Mutex<HashMap<PathBuf, Instant>>>> = OnceLock::new();
const SELF_WRITE_WINDOW: Duration = Duration::from_millis(600);

pub fn register_self_write(path: &Path) {
    let map = SELF_WRITES.get_or_init(|| Arc::new(Mutex::new(HashMap::new())));
    let mut guard = map.lock();
    let now = Instant::now();
    guard.insert(path.to_path_buf(), now);
    // Opportunistic GC so the map doesn't grow unbounded.
    guard.retain(|_, t| now.duration_since(*t) < SELF_WRITE_WINDOW * 4);
}

fn was_self_written(path: &Path) -> bool {
    let map = SELF_WRITES.get_or_init(|| Arc::new(Mutex::new(HashMap::new())));
    let mut guard = map.lock();
    let now = Instant::now();
    if let Some(t) = guard.get(path).copied() {
        if now.duration_since(t) < SELF_WRITE_WINDOW {
            return true;
        }
        guard.remove(path);
    }
    false
}

#[tauri::command]
pub async fn start_watching(app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    let Some(root) = state.vault_path() else {
        return Err(NotorError::NoVault);
    };
    let already = state.read().watching;
    if already {
        return Ok(());
    }

    let (tx, rx) = channel::<notify::Result<Event>>();
    let mut watcher: RecommendedWatcher = notify::recommended_watcher(move |res| {
        let _ = tx.send(res);
    })
    .map_err(|e| NotorError::Watcher(e.to_string()))?;
    watcher
        .watch(&root, RecursiveMode::Recursive)
        .map_err(|e| NotorError::Watcher(e.to_string()))?;

    let handle = WATCHER_HANDLE.get_or_init(|| Arc::new(Mutex::new(None)));
    {
        let mut guard = handle.lock();
        *guard = Some(watcher);
    }
    state.write().watching = true;

    let app_handle = app.clone();
    let root_for_thread = root.clone();
    let state_inner = state.arc();
    thread::spawn(move || {
        loop {
            match rx.recv() {
                Ok(Ok(event)) => {
                    let mut batch = vec![event];
                    // Debounce: collect events for 100ms windows.
                    while let Ok(more) = rx.recv_timeout(Duration::from_millis(100)) {
                        if let Ok(ev) = more {
                            batch.push(ev);
                        }
                    }
                    process_batch(&app_handle, &root_for_thread, &state_inner, batch);
                }
                Ok(Err(e)) => log::warn!("watch error: {:?}", e),
                Err(_) => break,
            }
        }
    });

    Ok(())
}

fn is_markdown(path: &Path, vault_root: &Path) -> bool {
    if path.starts_with(vault_root.join(".notor")) {
        return false;
    }
    path.extension().and_then(|s| s.to_str()) == Some("md")
}

fn process_batch(
    app: &AppHandle,
    root: &Path,
    state: &Arc<parking_lot::RwLock<crate::state::Inner>>,
    events: Vec<Event>,
) {
    for ev in events {
        match ev.kind {
            EventKind::Create(_) => {
                for p in &ev.paths {
                    if !is_markdown(p, root) || was_self_written(p) {
                        continue;
                    }
                    if let Ok((idx, body)) = vault::read_and_index(root, p) {
                        // Keep our in-memory index and body cache up to date.
                        {
                            let mut inner = state.write();
                            inner.by_path.insert(p.clone(), idx.id.clone());
                            inner.bodies.insert(idx.id.clone(), body);
                            inner.notes.insert(idx.id.clone(), idx.clone());
                        }
                        let _ = app.emit("note:created", &idx);
                    }
                }
            }
            EventKind::Modify(_) => {
                for p in &ev.paths {
                    if !is_markdown(p, root) || was_self_written(p) {
                        continue;
                    }
                    if !p.exists() {
                        emit_deleted(app, state, p);
                        continue;
                    }
                    if let Ok((idx, body)) = vault::read_and_index(root, p) {
                        {
                            let mut inner = state.write();
                            inner.by_path.insert(p.clone(), idx.id.clone());
                            inner.bodies.insert(idx.id.clone(), body);
                            inner.notes.insert(idx.id.clone(), idx.clone());
                        }
                        let _ = app.emit("note:modified", &idx);
                    }
                }
            }
            EventKind::Remove(_) => {
                for p in &ev.paths {
                    if !is_markdown(p, root) {
                        continue;
                    }
                    emit_deleted(app, state, p);
                }
            }
            _ => {}
        }
    }
}

fn emit_deleted(
    app: &AppHandle,
    state: &Arc<parking_lot::RwLock<crate::state::Inner>>,
    path: &Path,
) {
    {
        let mut inner = state.write();
        if let Some(id) = inner.by_path.remove(path) {
            inner.notes.remove(&id);
            inner.bodies.remove(&id);
        }
    }
    let _ = app.emit(
        "note:deleted",
        DeletedPayload {
            path: path.to_string_lossy().to_string(),
        },
    );
    // Avoid unused warning when chrono is otherwise unused in this file.
    let _ = Utc::now();
}

#[tauri::command]
pub async fn stop_watching(state: State<'_, AppState>) -> Result<()> {
    if let Some(handle) = WATCHER_HANDLE.get() {
        let mut guard = handle.lock();
        *guard = None; // dropping the watcher stops it
    }
    state.write().watching = false;
    Ok(())
}
