import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { Plus, FolderOpen, Clock, X } from "lucide-react";
import { useVaultStore } from "@store/vaultStore";
import { useEditorStore } from "@store/editorStore";
import { useAppStore } from "@store/appStore";
import { Icon } from "@components/shared/Icon";
import * as api from "@/lib/tauri";
import { isTauri } from "@/lib/tauri";
import { formatNoteDate } from "@/lib/dateFormat";
import styles from "./EmptyState.module.css";

export function EmptyState() {
  const meta = useVaultStore((s) => s.meta);
  const openVault = useVaultStore((s) => s.openVault);
  const refreshNotes = useVaultStore((s) => s.refreshNotes);
  const refreshFolders = useVaultStore((s) => s.refreshFolders);
  const openNote = useEditorStore((s) => s.openNote);
  const recents = useAppStore((s) => s.recentVaults);
  const forget = useAppStore((s) => s.forgetVault);

  const onOpenVault = async () => {
    if (!isTauri) return;
    const selected = await openDialog({ directory: true, multiple: false });
    if (typeof selected === "string") {
      await openVault(selected);
    }
  };

  const onOpenRecent = async (path: string) => {
    await openVault(path);
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

        {!meta && recents.length > 0 && (
          <section className={styles.recents}>
            <div className={styles.recentsTitle}>
              <Icon icon={Clock} size={11} /> Recent
            </div>
            <ul>
              {recents.slice(0, 5).map((r) => (
                <li key={r.path} className={styles.recentRow}>
                  <button
                    className={styles.recentBtn}
                    onClick={() => onOpenRecent(r.path)}
                    title={r.path}
                  >
                    <span className={styles.recentName}>{r.name}</span>
                    <span className={styles.recentMeta}>
                      {formatNoteDate(r.lastOpened)}
                    </span>
                  </button>
                  <button
                    className={styles.recentForget}
                    onClick={() => forget(r.path)}
                    aria-label={`Forget ${r.name}`}
                  >
                    <Icon icon={X} size={10} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
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
