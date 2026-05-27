//! Search commands.
//!
//! V1 ships a simple BM25-ish scorer over the in-memory index — fast enough
//! for tens of thousands of notes and zero new dependencies. We can swap in
//! `tantivy` later behind the same command signature without touching the UI.

use crate::error::{NotorError, Result};
use crate::models::{HighlightSpan, IndexStats, NoteIndex, SearchFilters, SearchResult, TagInfo};
use crate::state::AppState;
use crate::vault;
use regex::RegexBuilder;
use std::collections::HashMap;
use std::path::PathBuf;
use std::time::Instant;
use tauri::State;

const MAX_RESULTS: usize = 30;

fn tokenize(text: &str) -> Vec<String> {
    text.to_lowercase()
        .split(|c: char| !c.is_alphanumeric())
        .filter(|s| !s.is_empty() && s.len() > 1)
        .map(|s| s.to_string())
        .collect()
}

fn score_note(note: &NoteIndex, body: &str, query_terms: &[String]) -> (f32, Vec<HighlightSpan>) {
    if query_terms.is_empty() {
        return (0.0, vec![]);
    }
    let title_lc = note.title.to_lowercase();
    let body_lc = body.to_lowercase();
    let tags_joined = note.tags.join(" ").to_lowercase();

    let mut score: f32 = 0.0;
    let mut highlights: Vec<HighlightSpan> = vec![];
    for term in query_terms {
        let mut term_score = 0.0;
        if title_lc.contains(term) {
            term_score += 3.0;
        }
        if tags_joined.contains(term) {
            term_score += 2.0;
        }
        let body_hits = body_lc.matches(term).count();
        term_score += body_hits as f32;
        if term_score == 0.0 {
            // term missing — penalize so notes matching all terms rank higher
            score -= 0.5;
            continue;
        }
        score += term_score;

        // Find highlights in body for excerpt rendering (case-insensitive)
        if let Ok(re) = RegexBuilder::new(&regex::escape(term))
            .case_insensitive(true)
            .build()
        {
            for m in re.find_iter(body).take(3) {
                highlights.push(HighlightSpan {
                    start: m.start(),
                    end: m.end(),
                });
            }
        }
    }
    (score, highlights)
}

fn passes_filters(note: &NoteIndex, filters: &SearchFilters) -> bool {
    if !filters.tags.is_empty() {
        let lc: Vec<String> = note.tags.iter().map(|t| t.to_lowercase()).collect();
        if !filters
            .tags
            .iter()
            .all(|t| lc.contains(&t.to_lowercase()))
        {
            return false;
        }
    }
    if let Some(folder) = &filters.folder {
        if !folder.is_empty() && &note.folder != folder {
            return false;
        }
    }
    if let Some(collection) = &filters.collection {
        if note.collection.as_deref() != Some(collection.as_str()) {
            return false;
        }
    }
    if let Some(from) = filters.date_from {
        if note.modified < from {
            return false;
        }
    }
    if let Some(to) = filters.date_to {
        if note.modified > to {
            return false;
        }
    }
    if let Some(min) = filters.word_count_min {
        if note.word_count < min {
            return false;
        }
    }
    if let Some(max) = filters.word_count_max {
        if note.word_count > max {
            return false;
        }
    }
    if let Some(has) = filters.has_backlinks {
        if has && note.backlinks.is_empty() {
            return false;
        }
        if !has && !note.backlinks.is_empty() {
            return false;
        }
    }
    true
}

#[tauri::command]
pub async fn full_text_search(
    query: String,
    filters: SearchFilters,
    state: State<'_, AppState>,
) -> Result<Vec<SearchResult>> {
    let inner = state.read();
    let query_terms = tokenize(&query);

    let mut results: Vec<SearchResult> = vec![];
    for note in inner.notes.values() {
        if !passes_filters(note, &filters) {
            continue;
        }
        // Hit the in-memory body cache. Notes without a cached body (rare
        // race with the watcher mid-delete) are skipped rather than blocking
        // on disk I/O.
        let body_ref = match inner.bodies.get(&note.id) {
            Some(b) => b.as_str(),
            None => continue,
        };
        let (score, highlights) = score_note(note, body_ref, &query_terms);
        if score <= 0.0 && !query_terms.is_empty() {
            continue;
        }
        let excerpt = build_excerpt(body_ref, highlights.first());
        results.push(SearchResult {
            id: note.id.clone(),
            title: note.title.clone(),
            path: note.path.clone(),
            excerpt,
            score,
            highlights,
        });
    }
    results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
    results.truncate(MAX_RESULTS);
    Ok(results)
}

/// Carve out a snippet around the first match. Always lands on char
/// boundaries so we never slice mid-codepoint on UTF-8 input.
fn build_excerpt(body: &str, first_hl: Option<&HighlightSpan>) -> String {
    let Some(first) = first_hl else {
        return body.chars().take(160).collect();
    };
    let want_start = first.start.saturating_sub(60);
    let start = body
        .char_indices()
        .map(|(i, _)| i)
        .filter(|&i| i <= want_start)
        .last()
        .unwrap_or(0);
    let want_end = first.end + 100;
    let end = body
        .char_indices()
        .map(|(i, _)| i)
        .find(|&i| i >= want_end)
        .unwrap_or(body.len());
    body[start..end].to_string()
}

#[tauri::command]
pub async fn rebuild_index(state: State<'_, AppState>) -> Result<IndexStats> {
    let root = state.vault_path().ok_or(NotorError::NoVault)?;
    let start = Instant::now();
    let files = vault::scan_markdown_files(&root)?;
    let mut notes = HashMap::new();
    let mut by_path: HashMap<PathBuf, String> = HashMap::new();
    let mut bodies: HashMap<String, String> = HashMap::new();
    for file in &files {
        if let Ok((idx, body)) = vault::read_and_index(&root, file) {
            by_path.insert(file.clone(), idx.id.clone());
            bodies.insert(idx.id.clone(), body);
            notes.insert(idx.id.clone(), idx);
        }
    }
    let note_count = notes.len();
    {
        let mut inner = state.write();
        inner.notes = notes;
        inner.by_path = by_path;
        inner.bodies = bodies;
    }
    Ok(IndexStats {
        note_count,
        duration_ms: start.elapsed().as_millis() as u64,
    })
}

#[tauri::command]
pub async fn get_backlinks(
    note_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<NoteIndex>> {
    let inner = state.read();
    let target = inner
        .notes
        .get(&note_id)
        .ok_or_else(|| NotorError::NotFound(note_id.clone()))?;
    let title_lc = target.title.to_lowercase();

    let mut out = vec![];
    for note in inner.notes.values() {
        if note.id == note_id {
            continue;
        }
        let Some(body) = inner.bodies.get(&note.id) else {
            continue;
        };
        let lc = body.to_lowercase();
        if lc.contains(&format!("[[{}]]", title_lc)) || lc.contains(&format!("[[{}|", title_lc))
        {
            out.push(note.clone());
        }
    }
    Ok(out)
}

#[tauri::command]
pub async fn get_tags(state: State<'_, AppState>) -> Result<Vec<TagInfo>> {
    let inner = state.read();
    let mut counts: HashMap<String, usize> = HashMap::new();
    for note in inner.notes.values() {
        for tag in &note.tags {
            *counts.entry(tag.to_lowercase()).or_insert(0) += 1;
        }
    }
    let mut out: Vec<TagInfo> = counts
        .into_iter()
        .map(|(name, count)| TagInfo { name, count })
        .collect();
    out.sort_by(|a, b| b.count.cmp(&a.count).then_with(|| a.name.cmp(&b.name)));
    Ok(out)
}
