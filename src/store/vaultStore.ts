import { create } from "zustand";
import type { FolderInfo, VaultConfig, VaultMeta } from "@/types/vault";
import type { NoteIndex } from "@/types/note";
import * as api from "@/lib/tauri";

interface VaultState {
  meta: VaultMeta | null;
  notes: Record<string, NoteIndex>;
  folders: FolderInfo[];
  loading: boolean;
  error: string | null;

  openVault: (path: string) => Promise<void>;
  closeVault: () => Promise<void>;
  refreshNotes: () => Promise<void>;
  refreshFolders: () => Promise<void>;
  upsertNote: (note: NoteIndex) => void;
  removeNoteByPath: (path: string) => void;
  updateConfig: (patch: Partial<VaultConfig>) => Promise<void>;
}

export const useVaultStore = create<VaultState>((set, get) => ({
  meta: null,
  notes: {},
  folders: [],
  loading: false,
  error: null,

  openVault: async (path) => {
    set({ loading: true, error: null });
    try {
      const meta = await api.openVault(path);
      const notes = await api.listNotes();
      const folders = await api.listFolders();
      const noteMap: Record<string, NoteIndex> = {};
      for (const n of notes) noteMap[n.id] = n;
      set({ meta, notes: noteMap, folders, loading: false });
      await api.startWatching().catch(() => undefined);
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  closeVault: async () => {
    await api.stopWatching().catch(() => undefined);
    await api.closeVault().catch(() => undefined);
    set({ meta: null, notes: {}, folders: [] });
  },

  refreshNotes: async () => {
    const notes = await api.listNotes();
    const map: Record<string, NoteIndex> = {};
    for (const n of notes) map[n.id] = n;
    set({ notes: map });
  },

  refreshFolders: async () => {
    const folders = await api.listFolders();
    set({ folders });
  },

  upsertNote: (note) =>
    set((s) => ({ notes: { ...s.notes, [note.id]: note } })),

  removeNoteByPath: (path) =>
    set((s) => {
      const next = { ...s.notes };
      for (const [id, n] of Object.entries(next)) {
        if (n.path === path) delete next[id];
      }
      return { notes: next };
    }),

  updateConfig: async (patch) => {
    const current = get().meta?.config;
    if (!current) return;
    const next: VaultConfig = { ...current, ...patch };
    await api.updateVaultConfig(next);
    set((s) => (s.meta ? { meta: { ...s.meta, config: next } } : s));
  },
}));
