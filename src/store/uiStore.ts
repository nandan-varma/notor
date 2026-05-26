import { create } from "zustand";

type Overlay = "quickOpen" | "commandPalette" | "search" | "settings" | null;

export interface ContextMenuState {
  x: number;
  y: number;
  items: { label: string; action: () => void; danger?: boolean }[];
}

interface UIState {
  /** Persisted in vault config but mirrored here for instant access. */
  sidebarWidth: number;
  noteListWidth: number;
  aiPanelWidth: number;

  sidebarVisible: boolean;
  noteListVisible: boolean;
  aiPanelVisible: boolean;
  focusMode: boolean;

  /** A single overlay-at-a-time controller. */
  overlay: Overlay;

  /** Currently selected folder (for the NoteList column). */
  activeFolder: string | null;

  toast: { message: string; kind?: "info" | "success" | "error" } | null;

  contextMenu: ContextMenuState | null;

  setSidebarWidth: (w: number) => void;
  setNoteListWidth: (w: number) => void;
  setAIPanelWidth: (w: number) => void;
  toggleSidebar: () => void;
  toggleAIPanel: () => void;
  toggleNoteList: () => void;
  toggleFocusMode: () => void;
  setActiveFolder: (folder: string | null) => void;
  openOverlay: (o: Overlay) => void;
  closeOverlay: () => void;
  showToast: (message: string, kind?: "info" | "success" | "error") => void;
  dismissToast: () => void;
  showContextMenu: (state: ContextMenuState) => void;
  hideContextMenu: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarWidth: 240,
  noteListWidth: 260,
  aiPanelWidth: 380,

  sidebarVisible: true,
  noteListVisible: false,
  aiPanelVisible: true,
  focusMode: false,

  overlay: null,
  activeFolder: null,
  toast: null,
  contextMenu: null,

  setSidebarWidth: (w) => set({ sidebarWidth: clamp(w, 180, 420) }),
  setNoteListWidth: (w) => set({ noteListWidth: clamp(w, 200, 420) }),
  setAIPanelWidth: (w) => set({ aiPanelWidth: clamp(w, 280, 560) }),

  toggleSidebar: () => set((s) => ({ sidebarVisible: !s.sidebarVisible })),
  toggleAIPanel: () => set((s) => ({ aiPanelVisible: !s.aiPanelVisible })),
  toggleNoteList: () => set((s) => ({ noteListVisible: !s.noteListVisible })),
  toggleFocusMode: () =>
    set((s) => ({
      focusMode: !s.focusMode,
      sidebarVisible: s.focusMode ? true : false,
      aiPanelVisible: s.focusMode ? true : false,
    })),

  setActiveFolder: (folder) =>
    set({ activeFolder: folder, noteListVisible: folder !== null }),

  openOverlay: (o) => set({ overlay: o }),
  closeOverlay: () => set({ overlay: null }),
  showToast: (message, kind = "info") => set({ toast: { message, kind } }),
  dismissToast: () => set({ toast: null }),
  showContextMenu: (cm) => set({ contextMenu: cm }),
  hideContextMenu: () => set({ contextMenu: null }),
}));

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}
