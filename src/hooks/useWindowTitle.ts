/**
 * Sync the OS window title to "{Note Title} — {Vault Name}" with a leading
 * dot when the active tab has unsaved changes. Pure side-effect, no JSX.
 */
import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEditorStore } from "@store/editorStore";
import { useVaultStore } from "@store/vaultStore";
import { isTauri } from "@/lib/tauri";

export function useWindowTitle() {
  const activeTab = useEditorStore((s) =>
    s.tabs.find((t) => t.noteId === s.activeTabId)
  );
  const vaultName = useVaultStore((s) => s.meta?.config.name);

  useEffect(() => {
    if (!isTauri) return;
    const win = getCurrentWindow();
    const parts: string[] = [];
    if (activeTab) {
      parts.push((activeTab.isDirty ? "● " : "") + activeTab.title);
    }
    if (vaultName) parts.push(vaultName);
    const title = parts.length ? parts.join(" — ") : "Notor";
    win.setTitle(title).catch(() => undefined);
  }, [activeTab?.title, activeTab?.isDirty, vaultName]);
}
