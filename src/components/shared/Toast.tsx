import { useEffect } from "react";
import { useUIStore } from "@store/uiStore";
import styles from "./Toast.module.css";

export function Toast() {
  const toast = useUIStore((s) => s.toast);
  const dismiss = useUIStore((s) => s.dismissToast);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(dismiss, 3500);
    return () => clearTimeout(id);
  }, [toast, dismiss]);

  if (!toast) return null;
  return (
    <div className={`${styles.toast} ${styles[toast.kind ?? "info"]}`} role="status">
      {toast.message}
    </div>
  );
}
