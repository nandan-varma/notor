import { useEffect, useRef } from "react";
import { useUIStore } from "@store/uiStore";
import styles from "./ContextMenu.module.css";

export function ContextMenu() {
  const cm = useUIStore((s) => s.contextMenu);
  const hide = useUIStore((s) => s.hideContextMenu);
  const ref = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!cm) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) hide();
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide();
    };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onEsc);
    };
  }, [cm, hide]);

  if (!cm) return null;
  return (
    <ul
      ref={ref}
      className={styles.menu}
      style={{ top: cm.y, left: cm.x }}
      role="menu"
    >
      {cm.items.map((item, i) => (
        <li
          key={i}
          role="menuitem"
          tabIndex={0}
          className={`${styles.item} ${item.danger ? styles.danger : ""}`}
          onClick={() => {
            item.action();
            hide();
          }}
        >
          {item.label}
        </li>
      ))}
    </ul>
  );
}
