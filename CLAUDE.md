# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

Tauri v2 (Rust) shell + React 19 + TypeScript 5.7 + Vite 6 + CodeMirror 6 + Zustand. Frontend uses CSS Modules; no Tailwind, no CSS-in-JS. Package manager is pnpm 9.

## Commands

```bash
pnpm tauri:dev          # full app (Vite + Rust + WebView) — first run ~30s for Rust compile
pnpm dev                # Vite only (no Tauri runtime; use to iterate on layout/CSS quickly)
pnpm typecheck          # tsc --noEmit (strict; required to pass)
pnpm test               # vitest run
pnpm test src/lib/fuzzy.test.ts          # single test file
pnpm test -t "matches consecutive"        # single test by name
pnpm build              # production Vite bundle (used by tauri:build)
pnpm tauri:build        # universal macOS .dmg

# Rust (from src-tauri/)
cargo check             # fastest Rust feedback
cargo build             # full debug build
cargo fmt && cargo clippy --all-targets
```

CI requires `pnpm typecheck`, `pnpm test`, and `cargo build` to pass. Lint is best-effort.

## Architecture

The split between frontend and backend is the most important thing to internalize before changing anything.

**Backend (`src-tauri/src/`)** holds all persistent state: the active vault path, the in-memory NoteIndex map, the file watcher. Frontend state stores are derived views.

**Adding a Tauri command requires three coordinated changes:**
1. Implement in `src-tauri/src/commands/{vault,fs,folders,search,watcher}.rs` — must be `#[tauri::command] pub async fn ... -> Result<T, NotorError>`.
2. Register in `src-tauri/src/lib.rs` inside `tauri::generate_handler![...]`.
3. Add a typed wrapper in `src/lib/tauri.ts`. Components must call the wrapper, never `invoke()` directly — this keeps the IPC surface discoverable and mockable.

**Rust and TS models are mirrored.** `src-tauri/src/models.rs` uses `#[serde(rename_all = "camelCase")]`; `src/types/{note,vault,ai}.ts` declares the same shape. Changing one side without the other will silently break at runtime.

**Frontend state is split into five Zustand stores** with intentionally narrow scopes:
- `vaultStore` — open vault metadata, notes map, folder tree (canonical source for the sidebar)
- `editorStore` — open tabs, active tab, in-memory dirty content per tab
- `searchStore` — query/filters/results for the full-text overlay
- `aiStore` — conversation, provider, model, API keys, streaming flag
- `uiStore` — panel widths/visibility, focus mode, overlay slot, toast, context menu

The `overlay` field on `uiStore` is a **single-slot enum** (`"quickOpen" | "commandPalette" | "search" | "settings" | null`). Only ever one overlay visible. Don't add ad-hoc `visible` flags — extend this enum.

**The file watcher is live.** `useVaultWatcher` listens for `note:created/modified/deleted` events from Rust and merges them into `vaultStore`. Do not poll, do not call `listNotes()` on a timer — backend pushes are the source of truth.

**CodeMirror owns the editor DOM.** React only re-renders when tabs switch (the `EditorSurface` is keyed on `tab.noteId`). Keystrokes never trigger a React render — the `autoSave` plugin pushes content into `editorStore.updateContent` and debounces a `saveTab()` 800ms after the last edit. If you find yourself adding `useState` for editor content, you're going the wrong way.

## Design tokens (no hard-coded values)

Every color, spacing, radius, motion, font value is a CSS custom property in `src/styles/tokens.css`. Themes swap by setting `data-theme="dark" | "light"` on `<html>`. Components reference `var(--accent-primary)` etc. Hard-coded hex/px values in component CSS are a bug.

The CodeMirror theme (`src/components/Editor/extensions/theme.ts`) also pulls from these variables, so theme switches in the editor are instant with no JS work.

## Adding things in their right places

- **New keyboard shortcut** → add a `Binding` in `src/hooks/useKeymap.ts`. Mark `global: true` if it should fire inside text fields.
- **New command palette entry** → add to `buildCommandRegistry()` in `src/lib/commands.ts`. Bindings in `useKeymap` can dispatch by command id.
- **New AI slash command** → add to `SLASH_COMMANDS` in `src/components/AIPanel/AIInput.tsx`.
- **New CodeMirror extension** → file under `src/components/Editor/extensions/`, then include in the `extensions` array in `Editor.tsx`. WidgetType subclasses must use `override` on `eq`, `toDOM`, `ignoreEvent` (TS strict).
- **New AI provider** → add a streaming function in `src/hooks/useAI.ts` mirroring `anthropicStream` / `openaiStream`; wire it in `callProvider`; add the provider to `DEFAULT_MODELS` in `aiStore.ts` and to the dropdown in `Settings.tsx`.

## Vault on-disk format

A vault is just a directory of `.md` files plus a `.notor/` sidecar:

- `.notor/config.json` — `VaultConfig` (theme, panel widths, AI provider, open tabs)
- `.notor/trash/` — deletes move here, never unlink
- `.notor/index/` — reserved for tantivy when we swap the v1 in-memory scorer

Every note has YAML front matter with a stable `id` (NTR-{nanoid}). The filename is a slug of the title; **renaming a note rewrites the filename but the id is permanent**. Backlinks resolve by title (case-insensitive) and alias — see `src/lib/wikilinks.ts`.

All writes go through `atomic_write` in `commands/fs.rs` (tempfile + `persist`), and `delete_note` moves to `.notor/trash/` rather than unlinking. Path resolution (`vault::resolve_in_vault`) defends against `..` traversal — always go through it when accepting a path from the frontend.

## Gotchas hit during the initial build (worth knowing)

- `pub type Result<T> = ...` in `src-tauri/src/error.rs` shadows `std::result::Result` inside the `Serialize for NotorError` impl. The Serialize signature must spell out `std::result::Result<S::Ok, S::Error>` or the `generate_handler!` proc macro panics with a misleading error.
- The Tauri v2 `setup` closure expects `Result<(), Box<dyn std::error::Error>>`, not `tauri::Result`.
- Tauri's bundle config requires icon files to exist at build time even in `cargo check` — keep `src-tauri/icons/*.png` populated.
- The front-matter pill widget disappears when the cursor is inside the YAML block (intentional — lets you edit it).

## Project principles (from the spec)

When making design calls, default to these:

1. **Files first.** No DB lock-in. Every change should remain compatible with editing notes in Finder + a plain text editor.
2. **CodeMirror keystrokes never trigger React re-renders.**
3. **No JS animations** for panel show/hide — CSS transitions on `width`/`opacity`/`transform` only.
4. **AI is a panel, not a product.** The note is always the hero; AI must remain optional and never block writing.
