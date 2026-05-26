import { useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { useUIStore } from "@store/uiStore";
import { useSearchStore } from "@store/searchStore";
import { useEditorStore } from "@store/editorStore";
import { useVaultStore } from "@store/vaultStore";
import { Icon } from "@components/shared/Icon";
import styles from "./SearchOverlay.module.css";

export function SearchOverlay() {
  const visible = useUIStore((s) => s.overlay === "search");
  const close = useUIStore((s) => s.closeOverlay);
  const query = useSearchStore((s) => s.query);
  const results = useSearchStore((s) => s.results);
  const loading = useSearchStore((s) => s.loading);
  const setQuery = useSearchStore((s) => s.setQuery);
  const runSearch = useSearchStore((s) => s.runSearch);
  const openNote = useEditorStore((s) => s.openNote);
  const notes = useVaultStore((s) => s.notes);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (visible) requestAnimationFrame(() => ref.current?.focus());
  }, [visible]);

  useEffect(() => {
    const id = setTimeout(() => {
      if (visible) runSearch();
    }, 220);
    return () => clearTimeout(id);
  }, [query, visible, runSearch]);

  if (!visible) return null;
  return (
    <div className={styles.backdrop} onClick={close}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.inputRow}>
          <Icon icon={Search} size={14} className={styles.icon} />
          <input
            ref={ref}
            className={styles.input}
            placeholder="Search across vault…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {loading && <span className={styles.spinner} />}
        </div>
        <ul className={styles.results}>
          {!loading && results.length === 0 && query.trim() && (
            <li className={styles.empty}>No matches</li>
          )}
          {results.map((r) => (
            <li
              key={r.id}
              className={styles.row}
              onClick={() => {
                const note = notes[r.id];
                if (note) {
                  openNote(note);
                  close();
                }
              }}
            >
              <div className={styles.title}>{r.title}</div>
              <div className={styles.excerpt}>{r.excerpt}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
