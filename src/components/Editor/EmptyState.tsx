import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { Plus, FolderOpen } from "lucide-react";
import { useVaultStore } from "@store/vaultStore";
import { useEditorStore } from "@store/editorStore";
import { Icon } from "@components/shared/Icon";
import * as api from "@/lib/tauri";
import { isTauri } from "@/lib/tauri";
import styles from "./EmptyState.module.css";

export function EmptyState() {
  const meta = useVaultStore((s) => s.meta);
  const openVault = useVaultStore((s) => s.openVault);
  const refreshNotes = useVaultStore((s) => s.refreshNotes);
  const refreshFolders = useVaultStore((s) => s.refreshFolders);
  const openNote = useEditorStore((s) => s.openNote);

  const onOpenVault = async () => {
    if (!isTauri) return;
    const selected = await openDialog({ directory: true, multiple: false });
    if (typeof selected === "string") {
      await openVault(selected);
    }
  };

  const onNewNote = async () => {
    if (!meta) return;
    const note = await api.createNote("", "Untitled");
    await refreshNotes();
    await refreshFolders();
    openNote(note);
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <h1 className={styles.title}>Notor</h1>
        <p className={styles.tagline}>Two good things per day, with enough empty space to wander.</p>

        {!meta ? (
          <button className={styles.primaryBtn} onClick={onOpenVault}>
            <Icon icon={FolderOpen} size={14} /> Open a vault
          </button>
        ) : (
          <button className={styles.primaryBtn} onClick={onNewNote}>
            <Icon icon={Plus} size={14} /> New note
          </button>
        )}

        <ul className={styles.hints}>
          <li>
            <kbd>⌘K</kbd> Quick open
          </li>
          <li>
            <kbd>⌘⇧P</kbd> Command palette
          </li>
          <li>
            <kbd>⌘N</kbd> New note
          </li>
          <li>
            <kbd>⌘⇧A</kbd> Toggle AI panel
          </li>
        </ul>
      </div>
    </div>
  );
}
