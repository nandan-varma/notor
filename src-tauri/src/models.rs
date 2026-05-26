//! Shared data models — these structs serialize directly to the frontend.
//!
//! Keep the JSON shape in sync with `src/types/*.ts` on the React side.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteIndex {
    pub id: String,
    pub title: String,
    pub path: String,
    pub relative_path: String,
    pub folder: String,
    pub tags: Vec<String>,
    pub collection: Option<String>,
    pub status: NoteStatus,
    pub pinned: bool,
    pub created: DateTime<Utc>,
    pub modified: DateTime<Utc>,
    pub word_count: usize,
    pub excerpt: String,
    pub backlinks: Vec<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum NoteStatus {
    Active,
    Archived,
    Trash,
}

impl Default for NoteStatus {
    fn default() -> Self {
        Self::Active
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct NoteFrontMatter {
    #[serde(default)]
    pub id: Option<String>,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub created: Option<DateTime<Utc>>,
    #[serde(default)]
    pub modified: Option<DateTime<Utc>>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub pinned: bool,
    #[serde(default)]
    pub collection: Option<String>,
    #[serde(default)]
    pub status: Option<NoteStatus>,
    #[serde(default)]
    pub cover: Option<String>,
    #[serde(default)]
    pub aliases: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteContent {
    /// Raw file text including front matter and body.
    pub raw: String,
    /// Parsed front matter (best-effort).
    pub front_matter: NoteFrontMatter,
    /// Body without front matter.
    pub body: String,
    /// Updated index entry (timestamps reflect disk state).
    pub index: NoteIndex,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderInfo {
    pub name: String,
    pub relative_path: String,
    pub absolute_path: String,
    pub note_count: usize,
    pub children: Vec<FolderInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultConfig {
    pub version: u32,
    pub name: String,
    pub avatar: String,
    pub theme: String,
    pub default_font: String,
    pub ai_provider: String,
    pub ai_model: String,
    pub collections: Vec<String>,
    pub sidebar_width: u32,
    pub editor_width: u32,
    pub ai_panel_width: u32,
    pub spellcheck: bool,
    pub typewriter_mode: bool,
    pub line_numbers: bool,
    pub focus_mode: bool,
    #[serde(default)]
    pub open_tabs: Vec<String>,
    #[serde(default)]
    pub active_tab: Option<String>,
}

impl Default for VaultConfig {
    fn default() -> Self {
        Self {
            version: 1,
            name: "Notor".into(),
            avatar: "N".into(),
            theme: "dark".into(),
            default_font: "editor".into(),
            ai_provider: "anthropic".into(),
            ai_model: "claude-sonnet-4-20250514".into(),
            collections: vec![],
            sidebar_width: 240,
            editor_width: 680,
            ai_panel_width: 380,
            spellcheck: true,
            typewriter_mode: false,
            line_numbers: false,
            focus_mode: false,
            open_tabs: vec![],
            active_tab: None,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultMeta {
    pub path: String,
    pub config: VaultConfig,
    pub note_count: usize,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SearchFilters {
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub folder: Option<String>,
    #[serde(default)]
    pub collection: Option<String>,
    #[serde(default)]
    pub date_from: Option<DateTime<Utc>>,
    #[serde(default)]
    pub date_to: Option<DateTime<Utc>>,
    #[serde(default)]
    pub word_count_min: Option<usize>,
    #[serde(default)]
    pub word_count_max: Option<usize>,
    #[serde(default)]
    pub has_backlinks: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub id: String,
    pub title: String,
    pub path: String,
    pub excerpt: String,
    pub score: f32,
    pub highlights: Vec<HighlightSpan>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HighlightSpan {
    pub start: usize,
    pub end: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexStats {
    pub note_count: usize,
    pub duration_ms: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TagInfo {
    pub name: String,
    pub count: usize,
}
