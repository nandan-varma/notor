/**
 * Global keymap. Each binding is a single source of truth — we never set
 * shortcuts on individual components. This keeps conflicts visible.
 */
import { useEffect } from "react";
import { useUIStore } from "@store/uiStore";
import { useEditorStore } from "@store/editorStore";
import { useVaultStore } from "@store/vaultStore";
import { buildCommandRegistry } from "@/lib/commands";

interface Binding {
  /** mac-style accelerator, e.g. "Meta+K", "Meta+Shift+A" */
  key: string;
  run: () => void;
  /** Whether to fire even inside text inputs. */
  global?: boolean;
}

function parseAccelerator(key: string): { meta: boolean; shift: boolean; alt: boolean; ctrl: boolean; code: string } {
  const parts = key.split("+");
  const code = parts[parts.length - 1].toLowerCase();
  return {
    meta: parts.includes("Meta"),
    shift: parts.includes("Shift"),
    alt: parts.includes("Alt") || parts.includes("Option"),
    ctrl: parts.includes("Ctrl"),
    code,
  };
}

export function useKeymap() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ui = useUIStore.getState();
      const editor = useEditorStore.getState();
      const vault = useVaultStore.getState();

      const target = e.target as HTMLElement | null;
      const inField =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable ||
          !!target.closest(".cm-editor"));

      const bindings: Binding[] = [
        { key: "Meta+k", global: true, run: () => ui.openOverlay("quickOpen") },
        { key: "Meta+Shift+p", global: true, run: () => ui.openOverlay("commandPalette") },
        { key: "Meta+Shift+f", global: true, run: () => ui.openOverlay("search") },
        { key: "Meta+Shift+a", global: true, run: () => ui.toggleAIPanel() },
        { key: "Meta+Shift+s", global: true, run: () => ui.toggleSidebar() },
        { key: "Meta+Shift+l", global: true, run: () => ui.toggleNoteList() },
        { key: "Meta+,", global: true, run: () => ui.openOverlay("settings") },
        { key: "Meta+Alt+f", global: true, run: () => ui.toggleFocusMode() },
        { key: "Meta+Shift+t", global: true, run: () => toggleTheme() },
        {
          key: "Meta+n",
          global: true,
          run: () => {
            const cmds = buildCommandRegistry();
            cmds.find((c) => c.id === "newNote")?.run();
          },
        },
        {
          key: "Meta+Shift+n",
          global: true,
          run: () => {
            const cmds = buildCommandRegistry();
            cmds.find((c) => c.id === "newNoteRoot")?.run();
          },
        },
        {
          key: "Meta+w",
          global: true,
          run: () => {
            if (editor.activeTabId) editor.closeTab(editor.activeTabId);
          },
        },
        {
          key: "Escape",
          global: true,
          run: () => {
            if (ui.overlay) ui.closeOverlay();
          },
        },
        {
          key: "Meta+s",
          global: false,
          run: () => {
            if (editor.activeTabId) void editor.saveTab(editor.activeTabId);
          },
        },
        {
          key: "Meta+[",
          global: true,
          run: () => editor.navigateBack(),
        },
      ];

      // Number shortcuts 1-9 for tab switching
      for (let i = 1; i <= 9; i++) {
        bindings.push({
          key: `Meta+${i}`,
          global: true,
          run: () => {
            const tab = editor.tabs[i - 1];
            if (tab) editor.setActiveTab(tab.noteId);
          },
        });
      }

      for (const b of bindings) {
        const accel = parseAccelerator(b.key);
        const matchesKey = e.key.toLowerCase() === accel.code || e.code.toLowerCase() === accel.code;
        if (
          matchesKey &&
          e.metaKey === accel.meta &&
          e.shiftKey === accel.shift &&
          e.altKey === accel.alt &&
          e.ctrlKey === accel.ctrl
        ) {
          if (!b.global && inField) continue;
          e.preventDefault();
          b.run();
          // suppress the macOS native Cmd+W on the webview
          if (b.key === "Meta+w") e.stopPropagation();
          return;
        }
      }

      // Reference vault to silence noUnusedLocals during development
      void vault;
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

function toggleTheme() {
  const current = document.documentElement.dataset.theme;
  const next = current === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  void useVaultStore.getState().updateConfig({ theme: next as "dark" | "light" });
}
