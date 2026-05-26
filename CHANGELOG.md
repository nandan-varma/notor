# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial Tauri v2 shell with macOS overlay title bar
- Rust backend: vault open/close, note CRUD, folder operations, file watcher, simple full-text search
- React 19 + Vite 6 frontend with strict TypeScript
- Three-panel layout: Sidebar / NoteList / Editor / AIPanel with drag-resize
- CodeMirror 6 editor with markdown highlighting, front-matter pill, clickable checkboxes, wikilink navigation
- Multi-tab editing with unsaved indicators
- ⌘K Quick open with fuzzy title search
- ⌘⇧P command palette
- ⌘⇧F full-text search
- AI panel with streaming completions across Anthropic, OpenAI, Ollama, OpenRouter
- Slash commands in AI input (/improve, /summarize, /tags, …)
- Settings sheet covering General, Editor, Files, AI, Shortcuts
- Dark/light themes via CSS custom properties
- Atomic file writes (tempfile + rename)
- Vault config persisted to `.notor/config.json`

## [0.1.0] - Unreleased
