import { useCallback } from "react";
import { FileText } from "lucide-react";
import type { NoteIndex } from "@/types/note";
import { Icon } from "@components/shared/Icon";
import { useEditorStore } from "@store/editorStore";
import { useUIStore } from "@store/uiStore";
import { formatNoteDate } from "@/lib/dateFormat";
import * as api from "@/lib/tauri";
import { useVaultStore } from "@store/vaultStore";
import styles from "./NoteListItem.module.css";

interface NoteListItemProps {
  note: NoteIndex;
  active?: boolean;
}

export function NoteListItem({ note, active }: NoteListItemProps) {
  const openNote = useEditorStore((s) => s.openNote);
  const isDirty = useEditorStore((s) =>
    s.tabs.some((t) => t.noteId === note.id && t.isDirty)
  );
  const showContextMenu = useUIStore((s) => s.showContextMenu);
  const refreshNotes = useVaultStore((s) => s.refreshNotes);
  const refreshFolders = useVaultStore((s) => s.refreshFolders);

  const onContext = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      showContextMenu({
        x: e.clientX,
        y: e.clientY,
        items: [
          {
            label: "Rename",
            action: async () => {
              const name = window.prompt("New title", note.title);
              if (name && name !== note.title) {
                await api.renameNote(note.path, name);
                refreshNotes();
              }
            },
          },
          {
            label: "Duplicate",
            action: async () => {
              await api.duplicateNote(note.path);
              refreshNotes();
            },
          },
          {
            label: "Delete",
            danger: true,
            action: async () => {
              if (window.confirm(`Move "${note.title}" to trash?`)) {
                await api.deleteNote(note.path);
                refreshNotes();
                refreshFolders();
              }
            },
          },
        ],
      });
    },
    [note, refreshNotes, refreshFolders, showContextMenu]
  );

  return (
    <button
      className={`${styles.item} ${active ? styles.active : ""}`}
      onClick={() => openNote(note)}
      onContextMenu={onContext}
    >
      <Icon icon={FileText} size={12} className={styles.icon} />
      <div className={styles.body}>
        <div className={styles.title}>{note.title}</div>
        <div className={styles.meta}>
          <span>{formatNoteDate(note.modified)}</span>
          <span className={styles.dot}>·</span>
          <span>{note.wordCount}w</span>
          {note.tags.slice(0, 2).map((t) => (
            <span key={t} className={styles.tag}>
              {t}
            </span>
          ))}
        </div>
      </div>
      {isDirty && <span className={styles.unsaved} aria-label="Unsaved" />}
    </button>
  );
}
