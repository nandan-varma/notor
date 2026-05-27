/**
 * Persist window size + position so the next launch restores them. The
 * Tauri side handles the restore in `setup()`; we just listen for resize
 * and move events here and push them through `save_window_state`,
 * debounced so we don't write on every frame.
 */
import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri, saveWindowState } from "@/lib/tauri";

export function useWindowState() {
  useEffect(() => {
    if (!isTauri) return;
    const win = getCurrentWindow();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const persist = async () => {
      try {
        const [size, pos, maximized] = await Promise.all([
          win.outerSize(),
          win.outerPosition(),
          win.isMaximized(),
        ]);
        const scale = await win.scaleFactor();
        await saveWindowState({
          width: size.width / scale,
          height: size.height / scale,
          x: pos.x / scale,
          y: pos.y / scale,
          maximized,
        });
      } catch {
        // window might be closing; ignore
      }
    };

    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void persist(), 400);
    };

    const unlisteners: Array<Promise<() => void>> = [
      win.onResized(schedule),
      win.onMoved(schedule),
    ];

    return () => {
      if (timer) clearTimeout(timer);
      // Await each unlisten promise but discard errors.
      for (const p of unlisteners) {
        p.then((u) => u()).catch(() => undefined);
      }
    };
  }, []);
}
