import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

/**
 * Editor theme — pulls every color from CSS custom properties so light/dark
 * switches happen instantly with no JS work.
 */
export const notorTheme = EditorView.theme(
  {
    "&": {
      color: "var(--text-primary)",
      backgroundColor: "var(--editor-bg)",
      fontFamily: "var(--font-editor)",
      fontSize: "var(--editor-font-size)",
      height: "100%",
    },
    ".cm-scroller": {
      fontFamily: "inherit",
      lineHeight: "var(--editor-line-height)",
      padding: "var(--editor-padding-y) 0",
    },
    ".cm-content": {
      caretColor: "var(--editor-cursor)",
      padding: "0 var(--editor-padding-x)",
      maxWidth: "calc(var(--editor-max-width) + var(--editor-padding-x) * 2)",
      margin: "0 auto",
      width: "100%",
    },
    ".cm-line": {
      padding: "0",
    },
    "&.cm-focused": {
      outline: "none",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "var(--editor-cursor)",
      borderLeftWidth: "2px",
    },
    ".cm-selectionBackground, ::selection, .cm-content ::selection": {
      backgroundColor: "var(--editor-selection) !important",
    },
    "&.cm-focused .cm-selectionBackground": {
      backgroundColor: "var(--editor-selection) !important",
    },
    ".cm-gutters": {
      backgroundColor: "var(--editor-gutter)",
      color: "var(--text-muted)",
      borderRight: "none",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "transparent",
      color: "var(--text-secondary)",
    },
    ".cm-activeLine": {
      backgroundColor: "transparent",
    },
    ".cm-tooltip": {
      backgroundColor: "var(--bg-elevated)",
      border: "1px solid var(--border-strong)",
      borderRadius: "var(--radius-md)",
      color: "var(--text-primary)",
      boxShadow: "var(--shadow-md)",
    },
    ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
      backgroundColor: "var(--bg-overlay)",
      color: "var(--text-primary)",
    },
    ".cm-searchMatch": {
      backgroundColor: "color-mix(in srgb, var(--accent-primary) 25%, transparent)",
    },
    ".cm-searchMatch.cm-searchMatch-selected": {
      backgroundColor: "color-mix(in srgb, var(--accent-primary) 50%, transparent)",
    },
  },
  { dark: true }
);

export const notorHighlight = HighlightStyle.define([
  { tag: t.heading1, fontSize: "1.6em", fontWeight: "700", color: "var(--syntax-heading)" },
  { tag: t.heading2, fontSize: "1.3em", fontWeight: "700", color: "var(--syntax-heading)" },
  { tag: t.heading3, fontSize: "1.15em", fontWeight: "600", color: "var(--syntax-heading)" },
  { tag: [t.heading4, t.heading5, t.heading6], fontWeight: "600", color: "var(--syntax-heading)" },
  { tag: t.strong, fontWeight: "700", color: "var(--syntax-bold)" },
  { tag: t.emphasis, fontStyle: "italic", color: "var(--syntax-italic)" },
  { tag: t.link, color: "var(--syntax-link)", textDecoration: "underline" },
  { tag: t.url, color: "var(--syntax-link)" },
  { tag: t.monospace, fontFamily: "var(--font-mono)", color: "var(--syntax-code)" },
  { tag: t.quote, color: "var(--syntax-blockquote)", fontStyle: "italic" },
  { tag: t.list, color: "var(--text-primary)" },
  { tag: t.meta, color: "var(--syntax-frontmatter)" },
  { tag: t.processingInstruction, color: "var(--text-muted)" },
  { tag: t.contentSeparator, color: "var(--text-muted)" },
  { tag: t.strikethrough, textDecoration: "line-through", color: "var(--syntax-checked)" },
  { tag: t.comment, color: "var(--text-muted)", fontStyle: "italic" },
  { tag: t.keyword, color: "var(--accent-secondary)" },
]);

export const notorSyntaxHighlighting = syntaxHighlighting(notorHighlight, { fallback: true });
