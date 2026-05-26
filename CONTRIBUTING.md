# Contributing to Notor

Thanks for considering a contribution. A few ground rules keep the project tidy:

## Before opening a PR

1. **Discuss large changes first** — open an issue describing the design before writing the code.
2. **Match the existing style** — design tokens for color, CSS Modules for component styles, Zustand for state.
3. **Don't introduce new dependencies casually.** Notor is small on purpose. If you need a new lib, motivate it in the PR description.
4. **Tests pass.** Run `pnpm typecheck`, `pnpm lint`, and `pnpm test` locally before pushing.

## Repository structure

See the README for a layout overview. Key conventions:

- Tauri commands live in `src-tauri/src/commands/` and are mirrored as typed wrappers in `src/lib/tauri.ts`.
- React components are organized by feature, not by file type. A component folder contains `.tsx`, `.module.css`, and any subcomponents.
- Design tokens are defined in `src/styles/tokens.css`. Never hard-code colors.

## Code style

- **TypeScript strict mode is on** — no `any`, no implicit `any`.
- **Rust** — `cargo fmt` + `cargo clippy --all-targets`. CI enforces both.
- **No emojis in source files** unless they're literal user-facing content.
- **Comments** explain *why*, not what. The names should explain what.

## Filing bugs

Use the bug template. Include:

- macOS version
- Vault size (note count)
- Steps to reproduce
- Console output (Cmd+Opt+I in dev builds)

## Areas we'd love help with

- Additional AI provider adapters (Gemini, local llama.cpp)
- CodeMirror extension polish (smooth cursor, image previews)
- Tantivy-backed full-text search (replaces the v1 simple scorer)
- Internationalization
- macOS-native context menus
- iOS companion app (read-only sync via iCloud Drive)
