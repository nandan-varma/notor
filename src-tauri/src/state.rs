//! Shared app state — guarded by parking_lot RwLocks so reads don't block writes.
//!
//! There are two state surfaces here:
//!
//! - `Inner` — per-vault state (open vault path, note index, body cache).
//!   Reset on every vault open/close.
//! - `AppLevelState` — global, cross-vault state (recent vaults, last
//!   window size/position, last theme). Persisted to a `state.json` next
//!   to the app config dir, so the next launch can restore the user's
//!   working context before the first paint.

use crate::models::{NoteIndex, VaultConfig};
use chrono::{DateTime, Utc};
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;

pub struct AppState {
    inner: Arc<RwLock<Inner>>,
}

pub struct Inner {
    pub vault_path: Option<PathBuf>,
    pub config: VaultConfig,
    /// Index keyed by stable note ID.
    pub notes: HashMap<String, NoteIndex>,
    /// Reverse map: absolute path -> note ID.
    pub by_path: HashMap<PathBuf, String>,
    /// Note body (everything after the front matter) keyed by ID, cached in
    /// memory so search doesn't re-read every file per query.
    pub bodies: HashMap<String, String>,
    /// Whether a watcher is currently active.
    pub watching: bool,
}

impl Default for Inner {
    fn default() -> Self {
        Self {
            vault_path: None,
            config: VaultConfig::default(),
            notes: HashMap::new(),
            by_path: HashMap::new(),
            bodies: HashMap::new(),
            watching: false,
        }
    }
}

impl AppState {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(RwLock::new(Inner::default())),
        }
    }

    pub fn read(&self) -> parking_lot::RwLockReadGuard<'_, Inner> {
        self.inner.read()
    }

    pub fn write(&self) -> parking_lot::RwLockWriteGuard<'_, Inner> {
        self.inner.write()
    }

    pub fn vault_path(&self) -> Option<PathBuf> {
        self.inner.read().vault_path.clone()
    }

    /// Hand out a clone of the inner Arc. The file watcher thread needs to
    /// keep a long-lived reference without holding the Tauri State guard.
    /// Named `arc()` rather than `inner()` to avoid shadowing
    /// `tauri::State::inner()`.
    pub fn arc(&self) -> Arc<RwLock<Inner>> {
        self.inner.clone()
    }
}

// ── App-level (cross-vault) state ────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentVault {
    pub path: String,
    pub name: String,
    pub last_opened: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct WindowState {
    pub width: Option<f64>,
    pub height: Option<f64>,
    pub x: Option<f64>,
    pub y: Option<f64>,
    pub maximized: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AppLevelState {
    #[serde(default)]
    pub recent_vaults: Vec<RecentVault>,
    #[serde(default)]
    pub last_vault: Option<String>,
    #[serde(default)]
    pub last_theme: Option<String>,
    #[serde(default)]
    pub window: WindowState,
}

impl AppLevelState {
    pub fn load(path: &Path) -> Self {
        if !path.exists() {
            return Self::default();
        }
        match std::fs::read_to_string(path) {
            Ok(s) => serde_json::from_str(&s).unwrap_or_default(),
            Err(_) => Self::default(),
        }
    }

    pub fn save(&self, path: &Path) -> std::io::Result<()> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let json = serde_json::to_string_pretty(self).map_err(std::io::Error::other)?;
        std::fs::write(path, json)
    }

    pub fn upsert_recent(&mut self, path: String, name: String) {
        self.recent_vaults.retain(|v| v.path != path);
        self.recent_vaults.insert(
            0,
            RecentVault {
                path: path.clone(),
                name,
                last_opened: Utc::now(),
            },
        );
        self.recent_vaults.truncate(10);
        self.last_vault = Some(path);
    }
}

pub struct AppLevel {
    pub state: Arc<RwLock<AppLevelState>>,
    pub path: PathBuf,
}

impl AppLevel {
    pub fn new(path: PathBuf) -> Self {
        let state = AppLevelState::load(&path);
        Self {
            state: Arc::new(RwLock::new(state)),
            path,
        }
    }

    pub fn read(&self) -> AppLevelState {
        self.state.read().clone()
    }

    pub fn with_mut<F: FnOnce(&mut AppLevelState)>(&self, f: F) {
        let mut guard = self.state.write();
        f(&mut guard);
        let snapshot = guard.clone();
        drop(guard);
        if let Err(e) = snapshot.save(&self.path) {
            log::warn!("failed to persist app state: {}", e);
        }
    }
}
