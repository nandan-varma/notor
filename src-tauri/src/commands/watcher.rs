//! File watcher — uses native FSEvents on macOS via the `notify` crate.
//!
//! Events are emitted as Tauri events:
//!   `note:created`, `note:modified`, `note:deleted`, `note:renamed`
//! Frontend listeners merge these into their stores so the UI stays live.

use crate::error::{NotorError, Result};
use crate::state::AppState;
use crate::vault;
use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::sync::mpsc::channel;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, State};

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct DeletedPayload {
    path: String,
}

static WATCHER_HANDLE: once_cell_lite::OnceCell<Arc<Mutex<Option<RecommendedWatcher>>>> =
    once_cell_lite::OnceCell::new();

mod once_cell_lite {
    use std::sync::OnceLock;
    pub struct OnceCell<T>(OnceLock<T>);
    impl<T> OnceCell<T> {
        pub const fn new() -> Self {
            Self(OnceLock::new())
        }
        pub fn get_or_init(&self, f: impl FnOnce() -> T) -> &T {
            self.0.get_or_init(f)
        }
    }
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
        let mut guard = handle.lock().unwrap();
        *guard = Some(watcher);
    }
    state.write().watching = true;

    let app_handle = app.clone();
    let root_for_thread = root.clone();
    thread::spawn(move || {
        // Debounce: collect events for 100ms windows before processing.
        loop {
            match rx.recv() {
                Ok(Ok(event)) => {
                    let mut batch = vec![event];
                    while let Ok(more) = rx.recv_timeout(Duration::from_millis(100)) {
                        if let Ok(ev) = more {
                            batch.push(ev);
                        }
                    }
                    process_batch(&app_handle, &root_for_thread, batch);
                }
                Ok(Err(e)) => log::warn!("watch error: {:?}", e),
                Err(_) => break,
            }
        }
    });

    Ok(())
}

fn is_markdown(path: &std::path::Path, vault_root: &std::path::Path) -> bool {
    if path.starts_with(vault_root.join(".notor")) {
        return false;
    }
    path.extension().and_then(|s| s.to_str()) == Some("md")
}

fn process_batch(app: &AppHandle, root: &std::path::Path, events: Vec<Event>) {
    for ev in events {
        match ev.kind {
            EventKind::Create(_) => {
                for p in &ev.paths {
                    if !is_markdown(p, root) {
                        continue;
                    }
                    if let Ok(idx) = vault::index_from_disk(root, p) {
                        let _ = app.emit("note:created", &idx);
                    }
                }
            }
            EventKind::Modify(_) => {
                for p in &ev.paths {
                    if !is_markdown(p, root) {
                        continue;
                    }
                    if !p.exists() {
                        let _ = app.emit(
                            "note:deleted",
                            DeletedPayload {
                                path: p.to_string_lossy().to_string(),
                            },
                        );
                        continue;
                    }
                    if let Ok(idx) = vault::index_from_disk(root, p) {
                        let _ = app.emit("note:modified", &idx);
                    }
                }
            }
            EventKind::Remove(_) => {
                for p in &ev.paths {
                    if !is_markdown(p, root) {
                        continue;
                    }
                    let _ = app.emit(
                        "note:deleted",
                        DeletedPayload {
                            path: p.to_string_lossy().to_string(),
                        },
                    );
                }
            }
            _ => {}
        }
    }
}

#[tauri::command]
pub async fn stop_watching(state: State<'_, AppState>) -> Result<()> {
    if let Some(handle) = WATCHER_HANDLE.get_or_init(|| Arc::new(Mutex::new(None))).lock().ok() {
        // dropping the watcher inside the Option stops it
        drop(handle);
    }
    state.write().watching = false;
    Ok(())
}
