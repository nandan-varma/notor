import { EditorView, ViewPlugin } from "@codemirror/view";

/**
 * Auto-save plugin: fires `onSave(content)` `debounceMs` after the last
 * keystroke. The editor stays the source of truth — the consumer decides
 * how to persist.
 */
export function autoSavePlugin(
  onChange: (content: string) => void,
  onSave: (content: string) => void,
  debounceMs = 800
) {
  return ViewPlugin.fromClass(
    class {
      private timer: ReturnType<typeof setTimeout> | null = null;
      private lastSent = "";

      constructor(view: EditorView) {
        this.lastSent = view.state.doc.toString();
      }

      update(update: import("@codemirror/view").ViewUpdate) {
        if (!update.docChanged) return;
        const content = update.state.doc.toString();
        if (content === this.lastSent) return;
        onChange(content);
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(() => {
          this.lastSent = content;
          onSave(content);
        }, debounceMs);
      }

      destroy() {
        if (this.timer) clearTimeout(this.timer);
      }
    }
  );
}
