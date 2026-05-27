/**
 * Listen for backend file-watch events and merge into the vault store.
 * The store stays the source of truth for the sidebar — never poll, never
 * re-scan unless the user explicitly rebuilds the index.
 *
 * For notes that happen to be open in the editor, we re-read the body and
 * either silently adopt it (clean tab) or surface a conflict toast (dirty tab).
 */
import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useVaultStore } from "@store/vaultStore";
import { useEditorStore } from "@store/editorStore";
import type { NoteIndex } from "@/types/note";
import * as api from "@/lib/tauri";
import { isTauri } from "@/lib/tauri";

export function useVaultWatcher() {
  useEffect(() => {
    if (!isTauri) return;
    const unlisteners: Array<() => void> = [];

    const handleExternalUpdate = async (note: NoteIndex) => {
      useVaultStore.getState().upsertNote(note);
      const editor = useEditorStore.getState();
      const isOpen = editor.tabs.some((t) => t.path === note.path);
      if (!isOpen) return;
      try {
        const content = await api.readNote(note.path);
        editor.handleExternalChange(note.path, content.raw);
      } catch {
        // file likely raced a delete; ignore
      }
    };

    const setup = async () => {
      const u1 = await listen<NoteIndex>("note:created", (e) => {
        useVaultStore.getState().upsertNote(e.payload);
        useVaultStore.getState().refreshFolders();
      });
      const u2 = await listen<NoteIndex>("note:modified", (e) => {
        void handleExternalUpdate(e.payload);
      });
      const u3 = await listen<{ path: string }>("note:deleted", (e) => {
        useVaultStore.getState().removeNoteByPath(e.payload.path);
        useVaultStore.getState().refreshFolders();
      });
      unlisteners.push(u1, u2, u3);
    };
    void setup();

    return () => {
      for (const u of unlisteners) u();
    };
  }, []);
}
