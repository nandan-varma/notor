import { EditorView, ViewPlugin } from "@codemirror/view";
import { Compartment } from "@codemirror/state";
import type { ViewUpdate } from "@codemirror/view";

export const typewriterCompartment = new Compartment();

export const typewriterModePlugin = ViewPlugin.fromClass(
  class {
    update(update: ViewUpdate) {
      if (!update.selectionSet && !update.docChanged) return;
      const view = update.view;
      const head = view.state.selection.main.head;
      const coords = view.coordsAtPos(head);
      if (!coords) return;
      const scroller = view.scrollDOM;
      const rect = scroller.getBoundingClientRect();
      const target = rect.height * 0.4;
      const current = coords.top - rect.top;
      const delta = current - target;
      if (Math.abs(delta) > 10) {
        scroller.scrollBy({ top: delta, behavior: "smooth" });
      }
    }
  }
);

export function typewriterMode(enabled: boolean) {
  return typewriterCompartment.of(enabled ? typewriterModePlugin : []);
}
