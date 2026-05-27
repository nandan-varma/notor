/**
 * Markdown formatting keymap. Each command wraps or toggles the current
 * selection. If there's no selection, we insert the markers and place the
 * caret between them so the user can keep typing.
 */
import { EditorSelection } from "@codemirror/state";
import type { EditorView, KeyBinding } from "@codemirror/view";
import type { Command } from "@codemirror/view";

interface WrapOptions {
  prefix: string;
  suffix?: string;
  placeholder?: string;
}

function wrapSelection({ prefix, suffix = prefix, placeholder = "" }: WrapOptions): Command {
  return (view: EditorView) => {
    const { state } = view;
    const changes: { from: number; to: number; insert: string }[] = [];
    const ranges: { anchor: number; head: number }[] = [];

    for (const range of state.selection.ranges) {
      const text = state.doc.sliceString(range.from, range.to);
      if (text) {
        if (text.startsWith(prefix) && text.endsWith(suffix)) {
          const inner = text.slice(prefix.length, text.length - suffix.length);
          changes.push({ from: range.from, to: range.to, insert: inner });
          ranges.push({ anchor: range.from, head: range.from + inner.length });
        } else {
          const insert = `${prefix}${text}${suffix}`;
          changes.push({ from: range.from, to: range.to, insert });
          ranges.push({
            anchor: range.from + prefix.length,
            head: range.from + prefix.length + text.length,
          });
        }
      } else {
        const insert = `${prefix}${placeholder}${suffix}`;
        changes.push({ from: range.from, to: range.to, insert });
        const caret = range.from + prefix.length + placeholder.length;
        ranges.push({ anchor: caret, head: caret });
      }
    }

    view.dispatch({
      changes,
      selection: EditorSelection.create(
        ranges.map((r) => EditorSelection.range(r.anchor, r.head))
      ),
    });
    return true;
  };
}

const insertLink: Command = (view) => {
  const { state } = view;
  const range = state.selection.main;
  const selected = state.doc.sliceString(range.from, range.to);
  const text = selected || "text";
  const insert = `[${text}](url)`;
  view.dispatch({
    changes: { from: range.from, to: range.to, insert },
    selection: EditorSelection.range(
      range.from + text.length + 3,
      range.from + text.length + 6
    ),
  });
  return true;
};

const insertCodeBlock: Command = (view) => {
  const { state } = view;
  const range = state.selection.main;
  const selected = state.doc.sliceString(range.from, range.to);
  const line = state.doc.lineAt(range.from);
  const atLineStart = range.from === line.from;
  const prefix = atLineStart ? "```\n" : "\n```\n";
  const insert = `${prefix}${selected}\n\`\`\`\n`;
  view.dispatch({
    changes: { from: range.from, to: range.to, insert },
    selection: EditorSelection.range(
      range.from + prefix.length,
      range.from + prefix.length + selected.length
    ),
  });
  return true;
};

export const markdownKeymap: readonly KeyBinding[] = [
  { key: "Mod-b", run: wrapSelection({ prefix: "**" }), preventDefault: true },
  { key: "Mod-i", run: wrapSelection({ prefix: "_" }), preventDefault: true },
  { key: "Mod-Shift-k", run: insertLink, preventDefault: true },
  { key: "Mod-Shift-c", run: insertCodeBlock, preventDefault: true },
  // Quick toggle for inline code
  { key: "Mod-e", run: wrapSelection({ prefix: "`" }), preventDefault: true },
];
