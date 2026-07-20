//! Vault-level helpers: path resolution, note ID generation, front matter
//! parsing/serialization, on-disk index management.

use crate::error::{NotorError, Result};
use crate::models::{NoteFrontMatter, NoteIndex, NoteStatus};
use chrono::{DateTime, Utc};
use serde_yaml::Value as YamlValue;
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};

const FM_DELIM: &str = "---";

/// Resolve a path, guaranteeing it lives inside `vault_root`. Defends
/// against `..` traversal coming from the frontend by:
///   1. Rejecting any input that contains a `..` segment, and
///   2. Verifying the joined result still starts with `vault_root`.
/// The target file may not yet exist on disk — callers do their own
/// existence checks where it matters.
pub fn resolve_in_vault(vault_root: &Path, relative_or_abs: &str) -> Result<PathBuf> {
    let raw = Path::new(relative_or_abs);
    if raw
        .components()
        .any(|c| matches!(c, std::path::Component::ParentDir))
    {
        return Err(NotorError::PathEscape(relative_or_abs.to_string()));
    }

    let candidate = if raw.is_absolute() {
        raw.to_path_buf()
    } else {
        vault_root.join(raw)
    };

    let normalized = dunce::simplified(&candidate).to_path_buf();
    let root = dunce::simplified(vault_root).to_path_buf();

    if !normalized.starts_with(&root) {
        return Err(NotorError::PathEscape(relative_or_abs.to_string()));
    }
    Ok(normalized)
}

/// Deterministic short ID from path — used only as a fallback when a note has
/// no front-matter `id`. New notes always get a fresh nanoid.
pub fn fallback_id_from_path(path: &Path) -> String {
    let mut hasher = Sha256::new();
    hasher.update(path.to_string_lossy().as_bytes());
    let digest = hasher.finalize();
    // 10 hex chars is plenty for an identifier scoped to one vault.
    hex_encode(&digest[..5])
}

fn hex_encode(bytes: &[u8]) -> String {
    const HEX: &[u8] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for &b in bytes {
        out.push(HEX[(b >> 4) as usize] as char);
        out.push(HEX[(b & 0xf) as usize] as char);
    }
    out
}

/// Generate a new note ID. Format: `NTR-{10-char-nanoid}`.
pub fn new_note_id() -> String {
    format!("NTR-{}", nanoid::nanoid!(10, &nanoid::alphabet::SAFE))
}

/// Split raw file text into (front matter, body). Either may be empty.
pub fn split_front_matter(raw: &str) -> (Option<&str>, &str) {
    let trimmed = raw.trim_start_matches('\u{feff}');
    if !trimmed.starts_with(FM_DELIM) {
        return (None, raw);
    }
    // Skip the leading delimiter line.
    let after_first = trimmed.find('\n').map(|i| i + 1).unwrap_or(trimmed.len());
    let rest = &trimmed[after_first..];

    if let Some(end_rel) = rest.find(&format!("\n{}", FM_DELIM)) {
        let fm = &rest[..end_rel];
        let after_close = end_rel + 1 + FM_DELIM.len();
        // Skip trailing newline after closing ---
        let body_start = if rest[after_close..].starts_with('\n') {
            after_close + 1
        } else if rest[after_close..].starts_with("\r\n") {
            after_close + 2
        } else {
            after_close
        };
        (Some(fm), &rest[body_start..])
    } else {
        (None, raw)
    }
}

/// Parse YAML front matter into a typed struct (lossy: extra keys are dropped).
pub fn parse_front_matter(fm: Option<&str>) -> NoteFrontMatter {
    let Some(yaml) = fm else {
        return NoteFrontMatter::default();
    };
    serde_yaml::from_str(yaml).unwrap_or_default()
}

/// Serialize a NoteFrontMatter back to YAML, preserving stable key ordering.
pub fn serialize_front_matter(fm: &NoteFrontMatter) -> Result<String> {
    let mut map = serde_yaml::Mapping::new();
    if let Some(id) = &fm.id {
        map.insert(
            YamlValue::String("id".into()),
            YamlValue::String(id.clone()),
        );
    }
    if let Some(title) = &fm.title {
        map.insert(
            YamlValue::String("title".into()),
            YamlValue::String(title.clone()),
        );
    }
    if let Some(created) = fm.created {
        map.insert(
            YamlValue::String("created".into()),
            YamlValue::String(created.to_rfc3339()),
        );
    }
    if let Some(modified) = fm.modified {
        map.insert(
            YamlValue::String("modified".into()),
            YamlValue::String(modified.to_rfc3339()),
        );
    }
    if !fm.tags.is_empty() {
        map.insert(
            YamlValue::String("tags".into()),
            YamlValue::Sequence(
                fm.tags
                    .iter()
                    .map(|t| YamlValue::String(t.clone()))
                    .collect(),
            ),
        );
    }
    if fm.pinned {
        map.insert(YamlValue::String("pinned".into()), YamlValue::Bool(true));
    }
    if let Some(collection) = &fm.collection {
        map.insert(
            YamlValue::String("collection".into()),
            YamlValue::String(collection.clone()),
        );
    }
    if let Some(status) = fm.status {
        let s = match status {
            NoteStatus::Active => "active",
            NoteStatus::Archived => "archived",
            NoteStatus::Trash => "trash",
        };
        map.insert(
            YamlValue::String("status".into()),
            YamlValue::String(s.into()),
        );
    }
    if let Some(cover) = &fm.cover {
        map.insert(
            YamlValue::String("cover".into()),
            YamlValue::String(cover.clone()),
        );
    }
    if !fm.aliases.is_empty() {
        map.insert(
            YamlValue::String("aliases".into()),
            YamlValue::Sequence(
                fm.aliases
                    .iter()
                    .map(|a| YamlValue::String(a.clone()))
                    .collect(),
            ),
        );
    }
    Ok(serde_yaml::to_string(&YamlValue::Mapping(map))?)
}

/// Compose front matter + body into a single string suitable for writing.
pub fn compose_file(fm: &NoteFrontMatter, body: &str) -> Result<String> {
    let yaml = serialize_front_matter(fm)?;
    Ok(format!("{}\n{}{}\n{}", FM_DELIM, yaml, FM_DELIM, body))
}

/// Read a file from disk, parse front matter, and return both the index entry
/// AND the body. Callers that intend to cache the body for search should use
/// this entry point instead of round-tripping through `index_from_disk`.
pub fn read_and_index(vault_root: &Path, path: &Path) -> Result<(NoteIndex, String)> {
    let raw = fs::read_to_string(path)?;
    let (fm_str, body) = split_front_matter(&raw);
    let fm = parse_front_matter(fm_str);
    let body_owned = body.to_string();
    let index = index_from_parts(vault_root, path, &fm, &body_owned)?;
    Ok((index, body_owned))
}

/// Read a file from disk, parse front matter, and return its index entry.
pub fn index_from_disk(vault_root: &Path, path: &Path) -> Result<NoteIndex> {
    let raw = fs::read_to_string(path)?;
    let (fm_str, body) = split_front_matter(&raw);
    let fm = parse_front_matter(fm_str);
    index_from_parts(vault_root, path, &fm, body)
}

fn index_from_parts(
    vault_root: &Path,
    path: &Path,
    fm: &NoteFrontMatter,
    body: &str,
) -> Result<NoteIndex> {
    let metadata = fs::metadata(path)?;
    let modified_disk: DateTime<Utc> = metadata
        .modified()
        .map(DateTime::<Utc>::from)
        .unwrap_or_else(|_| Utc::now());
    let created_disk: DateTime<Utc> = metadata
        .created()
        .map(DateTime::<Utc>::from)
        .unwrap_or(modified_disk);

    let relative = path
        .strip_prefix(vault_root)
        .unwrap_or(path)
        .to_string_lossy()
        .to_string();

    let folder = path
        .parent()
        .and_then(|p| p.strip_prefix(vault_root).ok())
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();

    let id = fm.id.clone().unwrap_or_else(|| fallback_id_from_path(path));
    let title = fm.title.clone().unwrap_or_else(|| {
        path.file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "Untitled".into())
    });

    let body_clean = body.trim();
    let word_count = body_clean.split_whitespace().count();
    let excerpt = body_clean.chars().take(160).collect::<String>();

    Ok(NoteIndex {
        id,
        title,
        path: path.to_string_lossy().to_string(),
        relative_path: relative,
        folder,
        tags: fm.tags.clone(),
        collection: fm.collection.clone(),
        status: fm.status.unwrap_or_default(),
        pinned: fm.pinned,
        created: fm.created.unwrap_or(created_disk),
        modified: fm.modified.unwrap_or(modified_disk),
        word_count,
        excerpt,
        backlinks: Vec::new(),
    })
}

/// Convert a free-form title into a filesystem-safe slug for the filename.
pub fn slugify(title: &str) -> String {
    let mut out = String::with_capacity(title.len());
    let mut prev_dash = false;
    for ch in title.chars() {
        if ch.is_alphanumeric() {
            for low in ch.to_lowercase() {
                out.push(low);
            }
            prev_dash = false;
        } else if !prev_dash && !out.is_empty() {
            out.push('-');
            prev_dash = true;
        }
    }
    while out.ends_with('-') {
        out.pop();
    }
    if out.is_empty() {
        out.push_str("untitled");
    }
    out
}

/// Generate a non-colliding `.md` path for a new note in `folder`.
pub fn unique_note_path(folder: &Path, slug: &str) -> PathBuf {
    let mut candidate = folder.join(format!("{}.md", slug));
    let mut counter = 2;
    while candidate.exists() {
        candidate = folder.join(format!("{}-{}.md", slug, counter));
        counter += 1;
    }
    candidate
}

/// Path to a vault's `.notor` config directory.
pub fn notor_dir(vault_root: &Path) -> PathBuf {
    vault_root.join(".notor")
}

/// Walk the vault and return every `.md` file (excludes `.notor/` and
/// any other dot-prefixed directories like `.git`).
pub fn scan_markdown_files(vault_root: &Path) -> Result<Vec<PathBuf>> {
    let notor = notor_dir(vault_root);
    let mut out = Vec::new();
    for entry in walkdir::WalkDir::new(vault_root)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| {
            let p = e.path();
            !p.starts_with(&notor)
                && !p
                    .file_name()
                    .and_then(|s| s.to_str())
                    .map(|s| s.starts_with('.'))
                    .unwrap_or(false)
        })
        .flatten()
    {
        if entry.file_type().is_file()
            && entry.path().extension().and_then(|s| s.to_str()) == Some("md")
        {
            out.push(entry.into_path());
        }
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slugify_basic() {
        assert_eq!(slugify("Kyoto Trip Ideas"), "kyoto-trip-ideas");
        assert_eq!(slugify("Hello, world!"), "hello-world");
        assert_eq!(slugify("  spaces  "), "spaces");
        assert_eq!(slugify(""), "untitled");
        assert_eq!(slugify("___"), "untitled");
    }

    #[test]
    fn split_front_matter_present() {
        let text = "---\ntitle: Test\n---\nbody text";
        let (fm, body) = split_front_matter(text);
        assert_eq!(fm, Some("title: Test"));
        assert_eq!(body, "body text");
    }

    #[test]
    fn split_front_matter_missing() {
        let text = "no front matter here";
        let (fm, body) = split_front_matter(text);
        assert_eq!(fm, None);
        assert_eq!(body, text);
    }

    #[test]
    fn resolve_in_vault_blocks_traversal() {
        let root = std::env::temp_dir().join("notor-test-vault-traversal");
        std::fs::create_dir_all(&root).unwrap();
        let bad = resolve_in_vault(&root, "../../../etc/passwd");
        assert!(bad.is_err(), "expected escape error, got {:?}", bad);
        let good = resolve_in_vault(&root, "note.md");
        assert!(good.is_ok());
        assert!(good.unwrap().ends_with("note.md"));
    }

    #[test]
    fn front_matter_round_trip() {
        let fm = NoteFrontMatter {
            id: Some("abc".into()),
            title: Some("Hello".into()),
            created: None,
            modified: None,
            tags: vec!["a".into(), "b".into()],
            pinned: true,
            collection: Some("Work".into()),
            status: None,
            cover: None,
            aliases: vec![],
        };
        let yaml = serialize_front_matter(&fm).unwrap();
        assert!(yaml.contains("id: abc"));
        assert!(yaml.contains("title: Hello"));
        assert!(yaml.contains("pinned: true"));
        let parsed = parse_front_matter(Some(&yaml));
        assert_eq!(parsed.id.as_deref(), Some("abc"));
        assert_eq!(parsed.tags, vec!["a".to_string(), "b".to_string()]);
        assert!(parsed.pinned);
    }

    #[test]
    fn fallback_id_is_stable() {
        let p = std::path::Path::new("/tmp/foo.md");
        assert_eq!(fallback_id_from_path(p), fallback_id_from_path(p));
    }

    #[test]
    fn unique_note_path_avoids_collisions() {
        let dir = std::env::temp_dir().join("notor-test-unique");
        std::fs::create_dir_all(&dir).unwrap();
        let p1 = unique_note_path(&dir, "abc");
        std::fs::write(&p1, "").unwrap();
        let p2 = unique_note_path(&dir, "abc");
        assert_ne!(p1, p2);
        assert!(p2.to_string_lossy().contains("abc-2"));
        std::fs::remove_file(&p1).ok();
    }
}
