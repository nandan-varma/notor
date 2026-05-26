//! Shared app state — guarded by parking_lot mutexes so reads don't block.

use crate::models::{NoteIndex, VaultConfig};
use parking_lot::RwLock;
use std::collections::HashMap;
use std::path::PathBuf;
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
}
