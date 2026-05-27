/**
 * Tauri command bridge with typed wrappers.
 *
 * Every backend command is exposed here as a strongly-typed async function.
 * Components never call `invoke` directly — this keeps the call surface
 * discoverable and lets us mock backend calls in tests trivially.
 */

import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import type { FolderInfo, SearchFilters, SearchResult, TagInfo, VaultConfig, VaultMeta } from "@/types/vault";
import type { NoteContent, NoteIndex } from "@/types/note";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri) {
    // Helpful during pure-web preview / Vitest unit tests.
    throw new Error(`tauri command "${cmd}" called outside Tauri runtime`);
  }
  return tauriInvoke<T>(cmd, args);
}

// ── App-level state (cross-vault) ──
export interface RecentVault {
  path: string;
  name: string;
  lastOpened: string;
}
export interface WindowState {
  width?: number | null;
  height?: number | null;
  x?: number | null;
  y?: number | null;
  maximized: boolean;
}
export interface AppLevelState {
  recentVaults: RecentVault[];
  lastVault: string | null;
  lastTheme: string | null;
  window: WindowState;
}
export const getAppState = () => invoke<AppLevelState>("get_app_state");
export const forgetRecentVault = (path: string) =>
  invoke<AppLevelState>("forget_recent_vault", { path });
export const setLastTheme = (theme: string) => invoke<void>("set_last_theme", { theme });
export const saveWindowState = (state: WindowState) =>
  invoke<void>("save_window_state", { state });

// ── Vault ──
export const openVault = (path: string) => invoke<VaultMeta>("open_vault", { path });
export const closeVault = () => invoke<void>("close_vault");
export const getVaultConfig = () => invoke<VaultConfig>("get_vault_config");
export const updateVaultConfig = (config: VaultConfig) =>
  invoke<void>("update_vault_config", { config });

// ── Notes ──
export const listNotes = (folder?: string) => invoke<NoteIndex[]>("list_notes", { folder });
export const readNote = (path: string) => invoke<NoteContent>("read_note", { path });
export const writeNote = (path: string, content: string) =>
  invoke<NoteIndex>("write_note", { path, content });
export const createNote = (folder: string, title: string) =>
  invoke<NoteIndex>("create_note", { folder, title });
export const renameNote = (path: string, newTitle: string) =>
  invoke<NoteIndex>("rename_note", { path, newTitle });
export const moveNote = (path: string, destFolder: string) =>
  invoke<NoteIndex>("move_note", { path, destFolder });
export const deleteNote = (path: string) => invoke<void>("delete_note", { path });
export const duplicateNote = (path: string) =>
  invoke<NoteIndex>("duplicate_note", { path });

// ── Folders ──
export const listFolders = () => invoke<FolderInfo[]>("list_folders");
export const createFolder = (path: string) => invoke<void>("create_folder", { path });
export const renameFolder = (path: string, newName: string) =>
  invoke<void>("rename_folder", { path, newName });
export const deleteFolder = (path: string) => invoke<void>("delete_folder", { path });

// ── Search ──
export const fullTextSearch = (query: string, filters: SearchFilters = {}) =>
  invoke<SearchResult[]>("full_text_search", { query, filters });
export const rebuildIndex = () =>
  invoke<{ noteCount: number; durationMs: number }>("rebuild_index");
export const getBacklinks = (noteId: string) =>
  invoke<NoteIndex[]>("get_backlinks", { noteId });
export const getTags = () => invoke<TagInfo[]>("get_tags");

// ── Watcher ──
export const startWatching = () => invoke<void>("start_watching");
export const stopWatching = () => invoke<void>("stop_watching");

// ── Shell ──
export const revealInFinder = (path: string) =>
  invoke<void>("reveal_in_finder", { path });
export const openExternally = (path: string) =>
  invoke<void>("open_externally", { path });

export { isTauri };
