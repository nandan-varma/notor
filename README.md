# Notor

> Two good things per day, with enough empty space to wander.

A minimal, open-source markdown note-taking & PKM app for macOS. Plain files, native speed, beautiful by default.

## Why Notor

- **Files first** — every note is a `.md` file with YAML front matter. No database, no lock-in.
- **Native performance** — Tauri shell, Rust backend, ~8MB bundle.
- **Zero cognitive overhead** — tiny UI surface, power lives in shortcuts.
- **AI as a panel** — Anthropic / OpenAI / Ollama / OpenRouter. Optional, never required.

## Quick start

```bash
pnpm install
pnpm tauri:dev
```

Requirements:

- Node 18+ and pnpm 9
- Rust 1.77+ (`rustup install stable`)
- macOS 13 Ventura or newer

## Project layout

```
src/             React 19 + TypeScript frontend
  components/    UI: Sidebar, NoteList, Editor, AIPanel, overlays
  store/         Zustand stores (vault, editor, search, ai, ui)
  hooks/         useKeymap, useTheme, useVaultWatcher, useAI
  lib/           tauri bridge, fuzzy, wikilinks, dateFormat, frontmatter
  styles/        Design tokens, reset, typography, animations
  types/         Shared TS types

src-tauri/       Rust backend
  src/commands/  fs, folders, search, vault, watcher
  src/vault.rs   File parsing, indexing, front-matter helpers
  src/state.rs   In-memory app state
```

## Keyboard shortcuts

| Action                | Shortcut |
| --------------------- | -------- |
| Quick open            | ⌘K       |
| Command palette       | ⌘⇧P      |
| Full-text search      | ⌘⇧F      |
| New note              | ⌘N       |
| Toggle AI panel       | ⌘⇧A      |
| Toggle sidebar        | ⌘⇧S      |
| Toggle note list      | ⌘⇧L      |
| Focus mode            | ⌘⌥F      |
| Settings              | ⌘,       |
| Toggle theme          | ⌘⇧T      |

## Status

This is an early build. Phase 1 (core shell) is functional; Phase 2 (full search, AI provider polish, backlinks) and Phase 3 (graph view, daily notes, plugin API) follow.

## Contributing

PRs welcome — see `CONTRIBUTING.md`. Especially valuable contributions:

- New AI provider adapters
- CodeMirror extensions
- Themes (CSS token files only)
- i18n via `react-i18next`

## License

MIT — see [LICENSE](LICENSE).
