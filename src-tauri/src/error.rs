//! Single application error type — converted to a String at the Tauri command
//! boundary so the frontend gets a stable, JSON-friendly message.

use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum NotorError {
    #[error("vault not open")]
    NoVault,
    #[error("note not found: {0}")]
    NotFound(String),
    #[error("path escapes vault: {0}")]
    PathEscape(String),
    #[error("invalid front matter: {0}")]
    #[allow(dead_code)] // reserved for richer front-matter validation
    FrontMatter(String),
    #[error("io: {0}")]
    Io(#[from] std::io::Error),
    #[error("yaml: {0}")]
    Yaml(#[from] serde_yaml::Error),
    #[error("json: {0}")]
    Json(#[from] serde_json::Error),
    #[error("watcher: {0}")]
    Watcher(String),
    #[error("{0}")]
    Other(String),
}

impl Serialize for NotorError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type Result<T> = std::result::Result<T, NotorError>;
