import { Decoration, EditorView, ViewPlugin, WidgetType } from "@codemirror/view";
import type { DecorationSet, ViewUpdate } from "@codemirror/view";

class CheckboxWidget extends WidgetType {
  constructor(public checked: boolean, public from: number, public to: number) {
    super();
  }
  eq(other: CheckboxWidget) {
    return other.checked === this.checked && other.from === this.from;
  }
  toDOM(view: EditorView) {
    const wrap = document.createElement("span");
    wrap.setAttribute("aria-hidden", "true");
    wrap.className = "cm-checkbox" + (this.checked ? " cm-checkbox--checked" : "");
    wrap.style.cssText =
      "display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;border:1.5px solid var(--text-muted);border-radius:3px;margin-right:6px;cursor:pointer;vertical-align:middle;transition:background-color 80ms;";
    if (this.checked) {
      wrap.style.backgroundColor = "var(--accent-primary)";
      wrap.style.borderColor = "var(--accent-primary)";
      wrap.innerHTML =
        '<svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="white" stroke-width="2"><polyline points="2.5,6 5,8.5 9.5,3.5"/></svg>';
    }
    wrap.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const newText = this.checked ? "[ ]" : "[x]";
      view.dispatch({
        changes: { from: this.from, to: this.to, insert: newText },
      });
    };
    return wrap;
  }
  ignoreEvent() {
    return false;
  }
}

const CHECKBOX_RE = /\[( |x|X)\]/g;

function buildCheckboxes(view: EditorView): DecorationSet {
  const widgets: import("@codemirror/state").Range<Decoration>[] = [];
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    let m: RegExpExecArray | null;
    CHECKBOX_RE.lastIndex = 0;
    while ((m = CHECKBOX_RE.exec(text)) !== null) {
      const start = from + m.index;
      const end = start + m[0].length;
      // Only apply when this looks like a list item: preceding "- " or "* "
      const lineStart = view.state.doc.lineAt(start).from;
      const prefix = view.state.doc.sliceString(lineStart, start);
      if (!/^\s*[-*+]\s+$/.test(prefix)) continue;
      widgets.push(
        Decoration.replace({
          widget: new CheckboxWidget(m[1].toLowerCase() === "x", start, end),
        }).range(start, end)
      );
    }
  }
  return Decoration.set(widgets, true);
}

export const checkboxWidget = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildCheckboxes(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = buildCheckboxes(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations }
);
