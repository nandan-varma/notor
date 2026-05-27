import { useEditorStore } from "@store/editorStore";
import styles from "./ConflictToast.module.css";

/**
 * Rendered when the file on disk changed while we had unsaved local edits.
 * The user picks between disk and local; we never silently overwrite.
 */
export function ConflictToast() {
  const conflicted = useEditorStore((s) =>
    s.tabs.find((t) => t.noteId === s.activeTabId && t.externalContent !== undefined)
  );
  const accept = useEditorStore((s) => s.acceptDiskVersion);
  const keep = useEditorStore((s) => s.keepLocalVersion);
  if (!conflicted) return null;
  return (
    <div role="alert" className={styles.toast}>
      <div className={styles.body}>
        <strong>{conflicted.title}</strong> changed on disk while you had unsaved edits.
      </div>
      <div className={styles.actions}>
        <button className={styles.secondary} onClick={() => keep(conflicted.noteId)}>
          Keep mine
        </button>
        <button className={styles.primary} onClick={() => accept(conflicted.noteId)}>
          Use disk version
        </button>
      </div>
    </div>
  );
}
