/**
 * Listen for backend file-watch events and merge into the vault store.
 * The store stays the source of truth for the sidebar — never poll, never
 * re-scan unless the user explicitly rebuilds the index.
 */
import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useVaultStore } from "@store/vaultStore";
import type { NoteIndex } from "@/types/note";
import { isTauri } from "@/lib/tauri";

export function useVaultWatcher() {
  useEffect(() => {
    if (!isTauri) return;
    const unlisteners: Array<() => void> = [];

    const setup = async () => {
      const u1 = await listen<NoteIndex>("note:created", (e) => {
        useVaultStore.getState().upsertNote(e.payload);
        useVaultStore.getState().refreshFolders();
      });
      const u2 = await listen<NoteIndex>("note:modified", (e) => {
        useVaultStore.getState().upsertNote(e.payload);
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
