import { Decoration, EditorView, ViewPlugin } from "@codemirror/view";
import type { DecorationSet, ViewUpdate } from "@codemirror/view";

const WIKILINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

/**
 * Style [[wiki-links]] and emit a `notor:open-link` DOM event on click.
 * The link is rendered as text decoration only — clicking is handled by the
 * containing Editor component.
 */
function buildLinks(view: EditorView): DecorationSet {
  const widgets: import("@codemirror/state").Range<Decoration>[] = [];
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    let m: RegExpExecArray | null;
    WIKILINK_RE.lastIndex = 0;
    while ((m = WIKILINK_RE.exec(text)) !== null) {
      const start = from + m.index;
      const end = start + m[0].length;
      widgets.push(
        Decoration.mark({
          class: "cm-wikilink",
          attributes: { "data-target": m[1].trim() },
        }).range(start, end)
      );
    }
  }
  return Decoration.set(widgets, true);
}

export const wikilinkWidget = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildLinks(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildLinks(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
    eventHandlers: {
      mousedown(event, view) {
        const target = event.target as HTMLElement;
        const link = target.closest(".cm-wikilink") as HTMLElement | null;
        if (!link) return false;
        if (!(event.metaKey || event.ctrlKey)) return false;
        const dest = link.getAttribute("data-target");
        if (!dest) return false;
        event.preventDefault();
        view.dom.dispatchEvent(
          new CustomEvent("notor:open-link", {
            detail: { target: dest },
            bubbles: true,
          })
        );
        return true;
      },
    },
  }
);
