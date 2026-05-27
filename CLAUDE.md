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

**Frontend state is split into six Zustand stores** with intentionally narrow scopes:
- `appStore` — cross-vault state (recent vaults, last vault, last theme). Hydrated from the Rust-side `state.json` at launch.
- `vaultStore` — open vault metadata, notes map, folder tree (canonical source for the sidebar)
- `editorStore` — open tabs, active tab, in-memory dirty content per tab, external-conflict resolution
- `searchStore` — query/filters/results for the full-text overlay
- `aiStore` — conversation, provider, model, API keys (persisted via tauri-plugin-store), streaming flag
- `uiStore` — panel widths/visibility, focus mode, overlay slot, toast, context menu

The `overlay` field on `uiStore` is a **single-slot enum** (`"quickOpen" | "commandPalette" | "search" | "settings" | null`). Only ever one overlay visible. Don't add ad-hoc `visible` flags — extend this enum.

**The file watcher is live.** `useVaultWatcher` listens for `note:created/modified/deleted` events from Rust and merges them into `vaultStore`. Do not poll, do not call `listNotes()` on a timer — backend pushes are the source of truth.

**CodeMirror owns the editor DOM.** React only re-renders when tabs switch (the `EditorSurface` is keyed on `tab.noteId`). Keystrokes never trigger a React render — the `autoSave` plugin pushes content into `editorStore.updateContent` and debounces a `saveTab()` 800ms after the last edit. If you find yourself adding `useState` for editor content, you're going the wrong way.

**Two writes never collide.** Every `atomic_write` calls `register_self_write(path)` *before* `persist()`. The file watcher consults that map and skips events on paths the app wrote within a 600ms window — otherwise our own saves would bounce back as "external changes" and trigger the conflict toast. If you add a new write path, make sure it goes through `atomic_write` (or registers self-writes manually).

**The Rust body cache is the source of truth for search.** `AppState.bodies: HashMap<NoteId, String>` is primed during `open_vault` and updated by every fs command and the watcher. `full_text_search` reads from there, never from disk. Adding a new write path means: write to disk, then update `notes` + `by_path` + `bodies` together, or search results go stale.

**Two layers of persisted state.** Per-vault config lives in `{vault}/.notor/config.json`. Cross-vault state (recent vaults, last opened vault, last theme, window size+position) lives in `{app_config_dir}/state.json` and is owned by the Rust `AppLevel` manager. `main.tsx` runs `applyCachedTheme()` synchronously from localStorage before React mounts so the first paint is never the wrong color.

## Design tokens (no hard-coded values)

Every color, spacing, radius, motion, font value is a CSS custom property in `src/styles/tokens.css`. Themes swap by setting `data-theme="dark" | "light"` on `<html>`. Components reference `var(--accent-primary)` etc. Hard-coded hex/px values in component CSS are a bug.

The CodeMirror theme (`src/components/Editor/extensions/theme.ts`) also pulls from these variables, so theme switches in the editor are instant with no JS work.

## Adding things in their right places

- **New keyboard shortcut** → add a `Binding` in `src/hooks/useKeymap.ts`. Mark `global: true` if it should fire inside text fields.
- **New command palette entry** → add to `buildCommandRegistry()` in `src/lib/commands.ts`. Bindings in `useKeymap` can dispatch by command id.
- **New AI slash command** → add to `SLASH_COMMANDS` in `src/components/AIPanel/AIInput.tsx`.
- **New CodeMirror extension** → file under `src/components/Editor/extensions/`, then include in the `extensions` array in `Editor.tsx`. WidgetType subclasses must use `override` on `eq`, `toDOM`, `ignoreEvent` (TS strict).
- **New markdown shortcut** → add a `KeyBinding` to `markdownKeymap.ts`. Build selections via `EditorSelection.create([EditorSelection.range(a, b)])`, not plain object literals.
- **New AI provider** → add a streaming function in `src/hooks/useAI.ts` mirroring `anthropicStream` / `openaiStream`; wire it in `callProvider`; add the host to the `connect-src` of the CSP in `tauri.conf.json`; add to `DEFAULT_MODELS` in `aiStore.ts` and to the dropdown in `Settings.tsx`.
- **New native shell action** → write the Rust command in `src-tauri/src/commands/shell.rs` (use `std::process::Command`, not yet-another-plugin), register in `lib.rs`, surface in `src/lib/tauri.ts`.
- **New persisted cross-vault state** → add a field to `AppLevelState` in `src-tauri/src/state.rs`, expose via a command in `commands/app.rs`, mirror in `appStore.ts`. The Rust side handles atomic save on every mutation.

## Vault on-disk format

A vault is just a directory of `.md` files plus a `.notor/` sidecar:

- `.notor/config.json` — `VaultConfig` (theme, panel widths, AI provider, open tabs)
- `.notor/trash/` — deletes move here, never unlink
- `.notor/index/` — reserved for tantivy when we swap the v1 in-memory scorer

Every note has YAML front matter with a stable `id` (NTR-{nanoid}). The filename is a slug of the title; **renaming a note rewrites the filename but the id is permanent**. Backlinks resolve by title (case-insensitive) and alias — see `src/lib/wikilinks.ts`.

All writes go through `atomic_write` in `commands/fs.rs` (tempfile + `persist`), and `delete_note` moves to `.notor/trash/` rather than unlinking. Path resolution (`vault::resolve_in_vault`) defends against `..` traversal — always go through it when accepting a path from the frontend.

## Gotchas hit during builds (worth knowing)

- `pub type Result<T> = ...` in `src-tauri/src/error.rs` shadows `std::result::Result` inside the `Serialize for NotorError` impl. The Serialize signature must spell out `std::result::Result<S::Ok, S::Error>` or the `generate_handler!` proc macro panics with a misleading error.
- `tauri::State<T>` has its own `.inner()` that returns `&T`, which shadows any `inner()` you define on `T`. The AppState exposes `.arc()` to clone its `Arc<RwLock<Inner>>` for the watcher thread — don't rename it back to `inner()`.
- The Tauri v2 `setup` closure expects `Result<(), Box<dyn std::error::Error>>`, not `tauri::Result`.
- Tauri's bundle config requires icon files to exist at build time even in `cargo check` — keep `src-tauri/icons/*.png` populated.
- `Path::components()` does not resolve `..` segments; it yields `ParentDir` components for each one. `resolve_in_vault` rejects any `ParentDir` *before* joining — `starts_with` on the joined path alone is not sufficient defense.
- CM6 dispatch's `selection` field expects an `EditorSelection`, not a plain object. Build it via `EditorSelection.create([EditorSelection.range(a, b)])`.
- The front-matter pill widget disappears when the cursor is inside the YAML block (intentional — lets you edit it).
- `localStorage` and `matchMedia` are polyfilled in `src/test/setup.ts` because jsdom 25 on newer Node releases doesn't always expose them. Tests that touch persistence rely on those polyfills.

## Project principles (from the spec)

When making design calls, default to these:

1. **Files first.** No DB lock-in. Every change should remain compatible with editing notes in Finder + a plain text editor.
2. **CodeMirror keystrokes never trigger React re-renders.**
3. **No JS animations** for panel show/hide — CSS transitions on `width`/`opacity`/`transform` only.
4. **AI is a panel, not a product.** The note is always the hero; AI must remain optional and never block writing.
