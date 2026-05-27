import {
  Command,
  FileText,
  FolderOpen,
  PanelLeft,
  PanelRight,
  Settings,
  Plus,
  Sun,
  Moon,
  Search,
  Focus,
  RotateCw,
} from "lucide-react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import type { AppCommand } from "@/types/commands";
import { useUIStore } from "@store/uiStore";
import { useVaultStore } from "@store/vaultStore";
import { useEditorStore } from "@store/editorStore";
import { useAIStore } from "@store/aiStore";
import * as api from "@/lib/tauri";
import { isTauri } from "@/lib/tauri";

/**
 * Build the full app command registry. The registry is rebuilt cheaply on
 * each call because consumers only invoke it when the palette opens.
 */
export function buildCommandRegistry(): AppCommand[] {
  const ui = useUIStore.getState();
  const vault = useVaultStore.getState();
  const editor = useEditorStore.getState();
  const ai = useAIStore.getState();

  const commands: AppCommand[] = [
    {
      id: "quickOpen",
      title: "Quick open",
      shortcut: "⌘K",
      icon: Search,
      category: "Navigate",
      keywords: ["find", "open", "switch"],
      run: () => ui.openOverlay("quickOpen"),
    },
    {
      id: "search",
      title: "Search vault",
      shortcut: "⌘⇧F",
      icon: Search,
      category: "Navigate",
      run: () => ui.openOverlay("search"),
    },
    {
      id: "newNote",
      title: "New note",
      shortcut: "⌘N",
      icon: Plus,
      category: "Notes",
      run: async () => {
        if (!vault.meta) {
          ui.showToast("Open a vault first to create notes", "info");
          return;
        }
        const folder = ui.activeFolder ?? "";
        try {
          const note = await api.createNote(folder, "Untitled");
          await vault.refreshNotes();
          await vault.refreshFolders();
          editor.openNote(note);
        } catch (e) {
          ui.showToast(`Couldn't create note: ${humanize(e)}`, "error");
        }
      },
    },
    {
      id: "newNoteRoot",
      title: "New note in vault root",
      shortcut: "⌘⇧N",
      icon: Plus,
      category: "Notes",
      run: async () => {
        if (!vault.meta) {
          ui.showToast("Open a vault first to create notes", "info");
          return;
        }
        try {
          const note = await api.createNote("", "Untitled");
          await vault.refreshNotes();
          editor.openNote(note);
        } catch (e) {
          ui.showToast(`Couldn't create note: ${humanize(e)}`, "error");
        }
      },
    },
    {
      id: "openVault",
      title: "Open vault…",
      icon: FolderOpen,
      category: "Vault",
      run: async () => {
        if (!isTauri) {
          ui.showToast("Vault picking requires the desktop build", "info");
          return;
        }
        try {
          const selected = await openDialog({ directory: true, multiple: false });
          if (typeof selected === "string") await vault.openVault(selected);
        } catch (e) {
          ui.showToast(`Couldn't open vault: ${humanize(e)}`, "error");
        }
      },
    },
    {
      id: "createVault",
      title: "Create new vault…",
      icon: FolderOpen,
      category: "Vault",
      keywords: ["new", "init"],
      run: async () => {
        if (!isTauri) {
          ui.showToast("Vault creation requires the desktop build", "info");
          return;
        }
        try {
          const parent = await openDialog({
            directory: true,
            multiple: false,
            title: "Choose a parent folder for the new vault",
          });
          if (typeof parent !== "string") return;
          const name = window.prompt("Name your vault", "My Vault");
          if (!name || !name.trim()) return;
          const created = await api.createVault(parent, name.trim());
          await vault.openVault(created);
        } catch (e) {
          ui.showToast(`Couldn't create vault: ${humanize(e)}`, "error");
        }
      },
    },
    {
      id: "toggleSidebar",
      title: "Toggle sidebar",
      shortcut: "⌘⇧S",
      icon: PanelLeft,
      category: "View",
      run: () => ui.toggleSidebar(),
    },
    {
      id: "toggleAIPanel",
      title: "Toggle AI panel",
      shortcut: "⌘⇧A",
      icon: PanelRight,
      category: "View",
      run: () => ui.toggleAIPanel(),
    },
    {
      id: "toggleNoteList",
      title: "Toggle note list column",
      shortcut: "⌘⇧L",
      icon: FileText,
      category: "View",
      run: () => ui.toggleNoteList(),
    },
    {
      id: "toggleFocus",
      title: "Toggle focus mode",
      shortcut: "⌘⌥F",
      icon: Focus,
      category: "View",
      run: () => ui.toggleFocusMode(),
    },
    {
      id: "themeDark",
      title: "Theme: Dark",
      icon: Moon,
      category: "Appearance",
      run: () => {
        document.documentElement.dataset.theme = "dark";
        vault.updateConfig({ theme: "dark" });
      },
    },
    {
      id: "themeLight",
      title: "Theme: Light",
      icon: Sun,
      category: "Appearance",
      run: () => {
        document.documentElement.dataset.theme = "light";
        vault.updateConfig({ theme: "light" });
      },
    },
    {
      id: "rebuildIndex",
      title: "Rebuild search index",
      icon: RotateCw,
      category: "Vault",
      run: async () => {
        if (!vault.meta) {
          ui.showToast("Open a vault first", "info");
          return;
        }
        try {
          const stats = await api.rebuildIndex();
          ui.showToast(
            `Reindexed ${stats.noteCount} notes in ${stats.durationMs}ms`,
            "success"
          );
          await vault.refreshNotes();
        } catch (e) {
          ui.showToast(`Reindex failed: ${humanize(e)}`, "error");
        }
      },
    },
    {
      id: "settings",
      title: "Settings",
      shortcut: "⌘,",
      icon: Settings,
      category: "App",
      run: () => ui.openOverlay("settings"),
    },
    {
      id: "aiClear",
      title: "AI: Clear conversation",
      icon: Command,
      category: "AI",
      run: () => ai.clear(),
    },
  ];

  return commands;
}

function humanize(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return JSON.stringify(e);
}
