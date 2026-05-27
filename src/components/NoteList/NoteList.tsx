import { useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Plus, ArrowUpDown } from "lucide-react";
import { useVaultStore } from "@store/vaultStore";
import { useUIStore } from "@store/uiStore";
import { useEditorStore } from "@store/editorStore";
import type { NoteIndex } from "@/types/note";
import { NoteListItem } from "@components/Sidebar/NoteListItem";
import { Icon } from "@components/shared/Icon";
import { Tooltip } from "@components/shared/Tooltip";
import { groupForDate, type NoteDateGroup } from "@/lib/dateFormat";
import * as api from "@/lib/tauri";
import styles from "./NoteList.module.css";

export function NoteList() {
  const activeFolder = useUIStore((s) => s.activeFolder);
  const notes = useVaultStore((s) => s.notes);
  const refreshNotes = useVaultStore((s) => s.refreshNotes);
  const refreshFolders = useVaultStore((s) => s.refreshFolders);
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const openNote = useEditorStore((s) => s.openNote);
  const parentRef = useRef<HTMLDivElement>(null);

  const folderLabel = activeFolder === "" ? "All Notes" : activeFolder?.split("/").pop() ?? "";

  const filtered = useMemo<NoteIndex[]>(() => {
    const all = Object.values(notes);
    const list =
      activeFolder === null || activeFolder === ""
        ? all
        : all.filter((n) => n.folder === activeFolder);
    return list
      .filter((n) => n.status !== "trash")
      .sort((a, b) => +new Date(b.modified) - +new Date(a.modified));
  }, [notes, activeFolder]);

  type Row =
    | { kind: "header"; group: NoteDateGroup }
    | { kind: "note"; note: NoteIndex };

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    let lastGroup: NoteDateGroup | null = null;
    for (const note of filtered) {
      const g = groupForDate(note.modified);
      if (g !== lastGroup) {
        out.push({ kind: "header", group: g });
        lastGroup = g;
      }
      out.push({ kind: "note", note });
    }
    return out;
  }, [filtered]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => (rows[i].kind === "header" ? 28 : 56),
    overscan: 8,
  });

  const onNewNote = async () => {
    const folder = activeFolder ?? "";
    try {
      const note = await api.createNote(folder, "Untitled");
      await refreshNotes();
      await refreshFolders();
      openNote(note);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      useUIStore.getState().showToast(`Couldn't create note: ${msg}`, "error");
    }
  };

  return (
    <section className={styles.list}>
      <header className={styles.header}>
        <h2 className={styles.title}>{folderLabel || "All Notes"}</h2>
        <div className={styles.actions}>
          <Tooltip label="Sort" side="bottom">
            <button className={styles.action}>
              <Icon icon={ArrowUpDown} size={13} />
            </button>
          </Tooltip>
          <Tooltip label="New note" shortcut="⌘N" side="bottom">
            <button className={styles.action} onClick={onNewNote}>
              <Icon icon={Plus} size={13} />
            </button>
          </Tooltip>
        </div>
      </header>
      <div ref={parentRef} className={styles.scroll}>
        {rows.length === 0 && (
          <div className={styles.empty}>
            <p>No notes yet</p>
            <button className={styles.emptyBtn} onClick={onNewNote}>
              <Icon icon={Plus} size={12} /> New note
            </button>
          </div>
        )}
        <div
          style={{
            height: virtualizer.getTotalSize(),
            position: "relative",
            width: "100%",
          }}
        >
          {virtualizer.getVirtualItems().map((vi) => {
            const row = rows[vi.index];
            return (
              <div
                key={vi.key}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${vi.start}px)`,
                }}
                ref={virtualizer.measureElement}
                data-index={vi.index}
              >
                {row.kind === "header" ? (
                  <div className={styles.groupHeader}>{row.group}</div>
                ) : (
                  <NoteListItem
                    note={row.note}
                    active={row.note.id === activeTabId}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
