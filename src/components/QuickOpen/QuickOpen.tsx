import { useEffect, useMemo, useRef, useState } from "react";
import { Search, FileText, Star } from "lucide-react";
import { useUIStore } from "@store/uiStore";
import { useVaultStore } from "@store/vaultStore";
import { useEditorStore } from "@store/editorStore";
import { fuzzyMatch } from "@/lib/fuzzy";
import { useFocusTrap } from "@hooks/useFocusTrap";
import { Icon } from "@components/shared/Icon";
import { formatNoteDate } from "@/lib/dateFormat";
import type { NoteIndex } from "@/types/note";
import styles from "./QuickOpen.module.css";

const MAX_RESULTS = 30;

export function QuickOpen() {
  const visible = useUIStore((s) => s.overlay === "quickOpen");
  const close = useUIStore((s) => s.closeOverlay);
  const notes = useVaultStore((s) => s.notes);
  const openNote = useEditorStore((s) => s.openNote);
  const history = useEditorStore((s) => s.history);

  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(visible, panelRef);

  useEffect(() => {
    if (visible) {
      setQuery("");
      setSelectedIdx(0);
      // focus on next tick so the input is in the DOM
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [visible]);

  const noteArray = useMemo(() => Object.values(notes), [notes]);

  const recents = useMemo<NoteIndex[]>(() => {
    if (query) return [];
    const seen = new Set<string>();
    const out: NoteIndex[] = [];
    for (const id of [...history].reverse()) {
      const n = notes[id];
      if (n && !seen.has(n.id)) {
        out.push(n);
        seen.add(n.id);
      }
      if (out.length >= 6) break;
    }
    // Fill remaining with pinned notes if there's room
    if (out.length < 6) {
      for (const n of noteArray) {
        if (!seen.has(n.id) && n.pinned) {
          out.push(n);
          seen.add(n.id);
        }
        if (out.length >= 6) break;
      }
    }
    return out;
  }, [history, notes, noteArray, query]);

  const results = useMemo<NoteIndex[]>(() => {
    if (!query.trim()) return [];
    const scored: { note: NoteIndex; score: number }[] = [];
    for (const note of noteArray) {
      const match = fuzzyMatch(query, note.title);
      if (!match) continue;
      let score = match.score;
      if (note.pinned) score += 2;
      scored.push({ note, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, MAX_RESULTS).map((s) => s.note);
  }, [noteArray, query]);

  const items = query ? results : recents;

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const note = items[selectedIdx];
      if (note) {
        openNote(note);
        close();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  if (!visible) return null;
  return (
    <div className={styles.backdrop} onClick={close} role="presentation">
      <div
        ref={panelRef}
        className={styles.panel}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKey}
        role="dialog"
        aria-modal="true"
        aria-label="Quick open"
      >
        <div className={styles.inputRow}>
          <Icon icon={Search} size={14} className={styles.searchIcon} />
          <input
            ref={inputRef}
            className={styles.input}
            placeholder="Search notes…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIdx(0);
            }}
          />
          <kbd className={styles.kbd}>esc</kbd>
        </div>
        <ul className={styles.results} role="listbox">
          {!query && recents.length > 0 && (
            <li className={styles.section}>Recent</li>
          )}
          {query && results.length === 0 && (
            <li className={styles.empty}>No matches for "{query}"</li>
          )}
          {items.map((note, i) => (
            <li
              key={note.id}
              role="option"
              aria-selected={i === selectedIdx}
              className={`${styles.row} ${i === selectedIdx ? styles.selected : ""}`}
              onMouseEnter={() => setSelectedIdx(i)}
              onClick={() => {
                openNote(note);
                close();
              }}
            >
              <Icon
                icon={note.pinned ? Star : FileText}
                size={13}
                className={styles.rowIcon}
              />
              <span className={styles.title}>{note.title}</span>
              <span className={styles.meta}>
                {note.folder || "—"} · {formatNoteDate(note.modified)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
