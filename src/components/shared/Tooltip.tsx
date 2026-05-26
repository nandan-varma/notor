import { type ReactNode, useState } from "react";
import styles from "./Tooltip.module.css";

interface TooltipProps {
  label: string;
  shortcut?: string;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  delay?: number;
}

export function Tooltip({ label, shortcut, children, side = "bottom", delay = 400 }: TooltipProps) {
  const [open, setOpen] = useState(false);
  let timer: ReturnType<typeof setTimeout> | null = null;

  const onEnter = () => {
    timer = setTimeout(() => setOpen(true), delay);
  };
  const onLeave = () => {
    if (timer) clearTimeout(timer);
    setOpen(false);
  };

  return (
    <span
      className={styles.wrapper}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
    >
      {children}
      {open && (
        <span className={`${styles.tip} ${styles[side]}`} role="tooltip">
          <span>{label}</span>
          {shortcut && <span className={styles.shortcut}>{shortcut}</span>}
        </span>
      )}
    </span>
  );
}
