import { useEffect, useMemo, useRef, useState } from "react";
import { Command } from "lucide-react";
import { useUIStore } from "@store/uiStore";
import { buildCommandRegistry } from "@/lib/commands";
import { fuzzyMatch } from "@/lib/fuzzy";
import { Icon } from "@components/shared/Icon";
import styles from "./CommandPalette.module.css";

export function CommandPalette() {
  const visible = useUIStore((s) => s.overlay === "commandPalette");
  const close = useUIStore((s) => s.closeOverlay);

  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (visible) {
      setQuery("");
      setSelectedIdx(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [visible]);

  const commands = useMemo(() => (visible ? buildCommandRegistry() : []), [visible]);

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const scored = commands
      .map((cmd) => {
        const hay = [cmd.title, cmd.category, ...(cmd.keywords ?? [])].join(" ");
        const m = fuzzyMatch(query, hay);
        return m ? { cmd, score: m.score } : null;
      })
      .filter((x): x is { cmd: typeof commands[number]; score: number } => x !== null)
      .sort((a, b) => b.score - a.score);
    return scored.map((x) => x.cmd);
  }, [commands, query]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = filtered[selectedIdx];
      if (cmd) {
        close();
        void cmd.run();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  if (!visible) return null;
  return (
    <div className={styles.backdrop} onClick={close}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()} onKeyDown={onKey}>
        <div className={styles.inputRow}>
          <Icon icon={Command} size={14} className={styles.icon} />
          <input
            ref={inputRef}
            className={styles.input}
            placeholder="Run a command…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIdx(0);
            }}
          />
        </div>
        <ul className={styles.results}>
          {filtered.length === 0 && (
            <li className={styles.empty}>No commands match "{query}"</li>
          )}
          {filtered.map((cmd, i) => (
            <li
              key={cmd.id}
              className={`${styles.row} ${i === selectedIdx ? styles.selected : ""}`}
              onMouseEnter={() => setSelectedIdx(i)}
              onClick={() => {
                close();
                void cmd.run();
              }}
            >
              {cmd.icon && <Icon icon={cmd.icon} size={13} className={styles.rowIcon} />}
              <div className={styles.titleCol}>
                <span className={styles.title}>{cmd.title}</span>
                {cmd.category && (
                  <span className={styles.category}>{cmd.category}</span>
                )}
              </div>
              {cmd.shortcut && <kbd className={styles.kbd}>{cmd.shortcut}</kbd>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
