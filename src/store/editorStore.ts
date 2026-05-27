import { create } from "zustand";
import type { NoteContent, NoteIndex } from "@/types/note";
import * as api from "@/lib/tauri";

export interface OpenTab {
  noteId: string;
  path: string;
  title: string;
  /** Raw text loaded from disk (post-stamping) */
  loaded: string;
  /** Current in-memory text (dirty if !== loaded) */
  content: string;
  isDirty: boolean;
  isLoading: boolean;
  lastError?: string;
  /** Set when the file on disk changed externally while we had unsaved local
   *  changes — caller renders a conflict toast. */
  externalContent?: string;
}

interface EditorState {
  tabs: OpenTab[];
  activeTabId: string | null;
  history: string[]; // back-stack of note IDs

  openNote: (note: NoteIndex) => Promise<void>;
  closeTab: (noteId: string) => void;
  setActiveTab: (noteId: string) => void;
  updateContent: (noteId: string, content: string) => void;
  saveTab: (noteId: string) => Promise<void>;
  navigateBack: () => void;
  /** Called by the watcher when a tab's file changed on disk. */
  handleExternalChange: (path: string, newContent: string) => void;
  /** Accept the on-disk version of a conflicted file. */
  acceptDiskVersion: (noteId: string) => void;
  /** Discard the external change and keep the in-memory text. */
  keepLocalVersion: (noteId: string) => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  history: [],

  openNote: async (note) => {
    const existing = get().tabs.find((t) => t.noteId === note.id);
    if (existing) {
      set({ activeTabId: note.id });
      return;
    }

    const placeholder: OpenTab = {
      noteId: note.id,
      path: note.path,
      title: note.title,
      loaded: "",
      content: "",
      isDirty: false,
      isLoading: true,
    };
    set((s) => ({
      tabs: [...s.tabs, placeholder],
      activeTabId: note.id,
      history: [...s.history.filter((id) => id !== note.id), note.id].slice(-20),
    }));

    try {
      const data: NoteContent = await api.readNote(note.path);
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.noteId === note.id
            ? {
                ...t,
                loaded: data.raw,
                content: data.raw,
                title: data.index.title,
                isLoading: false,
              }
            : t
        ),
      }));
    } catch (e) {
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.noteId === note.id
            ? { ...t, isLoading: false, lastError: String(e) }
            : t
        ),
      }));
    }
  },

  closeTab: (noteId) =>
    set((s) => {
      const tabs = s.tabs.filter((t) => t.noteId !== noteId);
      let activeTabId = s.activeTabId;
      if (s.activeTabId === noteId) {
        const next = tabs[tabs.length - 1];
        activeTabId = next ? next.noteId : null;
      }
      return { tabs, activeTabId };
    }),

  setActiveTab: (noteId) => set({ activeTabId: noteId }),

  updateContent: (noteId, content) =>
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.noteId === noteId
          ? { ...t, content, isDirty: content !== t.loaded }
          : t
      ),
    })),

  saveTab: async (noteId) => {
    const tab = get().tabs.find((t) => t.noteId === noteId);
    if (!tab || !tab.isDirty) return;
    try {
      await api.writeNote(tab.path, tab.content);
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.noteId === noteId
            ? { ...t, loaded: t.content, isDirty: false, lastError: undefined }
            : t
        ),
      }));
    } catch (e) {
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.noteId === noteId ? { ...t, lastError: String(e) } : t
        ),
      }));
    }
  },

  navigateBack: () => {
    const history = [...get().history];
    history.pop(); // current
    const prev = history[history.length - 1];
    if (prev) set({ activeTabId: prev, history });
  },

  handleExternalChange: (path, newContent) =>
    set((s) => ({
      tabs: s.tabs.map((t) => {
        if (t.path !== path) return t;
        if (!t.isDirty) {
          // No local changes — silently adopt the new content.
          return { ...t, loaded: newContent, content: newContent };
        }
        // Surface for the UI to prompt the user.
        return { ...t, externalContent: newContent };
      }),
    })),

  acceptDiskVersion: (noteId) =>
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.noteId === noteId && t.externalContent !== undefined
          ? {
              ...t,
              loaded: t.externalContent,
              content: t.externalContent,
              isDirty: false,
              externalContent: undefined,
            }
          : t
      ),
    })),

  keepLocalVersion: (noteId) =>
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.noteId === noteId ? { ...t, externalContent: undefined } : t
      ),
    })),
}));
