import { X, Plus } from "lucide-react";
import { useEditorStore } from "@store/editorStore";
import { useUIStore } from "@store/uiStore";
import { useVaultStore } from "@store/vaultStore";
import { Icon } from "@components/shared/Icon";
import * as api from "@/lib/tauri";
import styles from "./TabBar.module.css";

export function TabBar() {
  const tabs = useEditorStore((s) => s.tabs);
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const setActive = useEditorStore((s) => s.setActiveTab);
  const closeTab = useEditorStore((s) => s.closeTab);
  const openNote = useEditorStore((s) => s.openNote);

  const activeFolder = useUIStore((s) => s.activeFolder);
  const refreshNotes = useVaultStore((s) => s.refreshNotes);
  const refreshFolders = useVaultStore((s) => s.refreshFolders);

  if (tabs.length === 0) return null;

  const onNewTab = async () => {
    const note = await api.createNote(activeFolder ?? "", "Untitled");
    await refreshNotes();
    await refreshFolders();
    openNote(note);
  };

  return (
    <div className={styles.bar} role="tablist">
      {tabs.map((t) => (
        <div
          key={t.noteId}
          role="tab"
          aria-selected={t.noteId === activeTabId}
          className={`${styles.tab} ${t.noteId === activeTabId ? styles.active : ""}`}
          onClick={() => setActive(t.noteId)}
          onAuxClick={(e) => {
            if (e.button === 1) closeTab(t.noteId);
          }}
        >
          <span className={styles.title} title={t.title}>
            {t.title}
          </span>
          {t.isDirty && <span className={styles.dirty} aria-label="Unsaved" />}
          <button
            className={styles.close}
            onClick={(e) => {
              e.stopPropagation();
              closeTab(t.noteId);
            }}
            aria-label={`Close ${t.title}`}
          >
            <Icon icon={X} size={11} />
          </button>
        </div>
      ))}
      <button className={styles.newTab} onClick={onNewTab} aria-label="New tab">
        <Icon icon={Plus} size={12} />
      </button>
    </div>
  );
}
