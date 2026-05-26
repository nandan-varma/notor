import { useCallback, useRef } from "react";
import styles from "./ResizeHandle.module.css";

interface ResizeHandleProps {
  /** Called with the new width during drag. */
  onResize: (width: number) => void;
  /** Called once at drag end (e.g. to persist). */
  onResizeEnd?: () => void;
  /** Which side of the parent panel this handle controls — affects delta sign. */
  side?: "left" | "right";
  /** Element to read base width from (defaults to previous sibling). */
  getBaseWidth?: () => number;
}

export function ResizeHandle({ onResize, onResizeEnd, side = "right", getBaseWidth }: ResizeHandleProps) {
  const startX = useRef(0);
  const startWidth = useRef(0);
  const dragging = useRef(false);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      startX.current = e.clientX;
      const base = getBaseWidth
        ? getBaseWidth()
        : (e.currentTarget.previousElementSibling as HTMLElement | null)?.offsetWidth ?? 0;
      startWidth.current = base;
      dragging.current = true;
      document.body.style.cursor = "ew-resize";
      document.body.style.userSelect = "none";

      const onMove = (ev: MouseEvent) => {
        if (!dragging.current) return;
        const delta = ev.clientX - startX.current;
        const newWidth = side === "right" ? startWidth.current + delta : startWidth.current - delta;
        onResize(newWidth);
      };
      const onUp = () => {
        dragging.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        onResizeEnd?.();
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [onResize, onResizeEnd, side, getBaseWidth]
  );

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      className={styles.handle}
      onMouseDown={onMouseDown}
    />
  );
}
