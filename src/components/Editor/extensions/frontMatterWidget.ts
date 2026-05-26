import { Decoration, EditorView, ViewPlugin, WidgetType } from "@codemirror/view";
import type { DecorationSet, ViewUpdate } from "@codemirror/view";

class FrontMatterPill extends WidgetType {
  constructor(public summary: string) {
    super();
  }
  eq(o: FrontMatterPill) {
    return o.summary === this.summary;
  }
  toDOM() {
    const el = document.createElement("div");
    el.className = "cm-front-matter-pill";
    el.style.cssText =
      "display:inline-flex;align-items:center;gap:8px;margin:0 0 8px;padding:4px 10px;font-family:var(--font-ui);font-size:11px;color:var(--text-muted);background-color:var(--bg-overlay);border-radius:var(--radius-pill);user-select:none;";
    el.textContent = this.summary;
    return el;
  }
  ignoreEvent() {
    return true;
  }
}

function findFrontMatterRange(view: EditorView): { from: number; to: number; summary: string } | null {
  const doc = view.state.doc;
  if (doc.length === 0) return null;
  const firstLine = doc.line(1);
  if (firstLine.text.trim() !== "---") return null;
  for (let i = 2; i <= doc.lines; i++) {
    const ln = doc.line(i);
    if (ln.text.trim() === "---") {
      // Build short summary from lines between
      const fm = doc.sliceString(firstLine.from, ln.to);
      const titleMatch = fm.match(/title:\s*(.+)/i);
      const tagMatch = fm.match(/tags:\s*\[([^\]]*)\]/i);
      const parts: string[] = [];
      if (titleMatch) parts.push(`📄 ${titleMatch[1].trim().replace(/['"]/g, "")}`);
      if (tagMatch && tagMatch[1].trim()) parts.push(`# ${tagMatch[1].trim()}`);
      const summary = parts.join("  ·  ") || "metadata";
      return { from: firstLine.from, to: ln.to, summary };
    }
    if (i > 30) break;
  }
  return null;
}

function buildFM(view: EditorView): DecorationSet {
  const range = findFrontMatterRange(view);
  if (!range) return Decoration.none;
  // Hide front matter when cursor is outside it.
  const selFrom = view.state.selection.main.from;
  if (selFrom >= range.from && selFrom <= range.to) {
    // Cursor is in the front matter — show raw text.
    return Decoration.none;
  }
  return Decoration.set([
    Decoration.replace({
      widget: new FrontMatterPill(range.summary),
      block: true,
    }).range(range.from, range.to),
  ]);
}

export const frontMatterWidget = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildFM(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet) {
        this.decorations = buildFM(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations }
);
