import { useEffect, useMemo, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, lineNumbers, highlightActiveLine, drawSelection } from "@codemirror/view";
import { history, defaultKeymap, historyKeymap } from "@codemirror/commands";
import { keymap } from "@codemirror/view";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { searchKeymap } from "@codemirror/search";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";

import { useEditorStore, type OpenTab } from "@store/editorStore";
import { useVaultStore } from "@store/vaultStore";
import { useUIStore } from "@store/uiStore";
import { notorTheme, notorSyntaxHighlighting } from "./extensions/theme";
import { autoSavePlugin } from "./extensions/autoSave";
import { checkboxWidget } from "./extensions/checkboxWidget";
import { frontMatterWidget } from "./extensions/frontMatterWidget";
import { wikilinkWidget } from "./extensions/linkWidget";
import { typewriterMode } from "./extensions/typewriterMode";
import { resolveWikilink } from "@/lib/wikilinks";
import { EmptyState } from "./EmptyState";
import styles from "./Editor.module.css";

export function Editor() {
  const activeTab: OpenTab | undefined = useEditorStore((s) =>
    s.tabs.find((t) => t.noteId === s.activeTabId)
  );

  if (!activeTab) return <EmptyState />;
  return <EditorSurface key={activeTab.noteId} tab={activeTab} />;
}

function EditorSurface({ tab }: { tab: OpenTab }) {
  const ref = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  const updateContent = useEditorStore((s) => s.updateContent);
  const saveTab = useEditorStore((s) => s.saveTab);
  const openNote = useEditorStore((s) => s.openNote);
  const notes = useVaultStore((s) => s.notes);
  const config = useVaultStore((s) => s.meta?.config);

  const extensions = useMemo(
    () => [
      history(),
      drawSelection(),
      highlightActiveLine(),
      closeBrackets(),
      EditorView.lineWrapping,
      markdown({
        base: markdownLanguage,
        codeLanguages: languages,
        addKeymap: true,
      }),
      notorTheme,
      notorSyntaxHighlighting,
      frontMatterWidget,
      checkboxWidget,
      wikilinkWidget,
      typewriterMode(config?.typewriterMode ?? false),
      config?.lineNumbers ? lineNumbers() : [],
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...historyKeymap,
        ...searchKeymap,
      ]),
      autoSavePlugin(
        (c) => updateContent(tab.noteId, c),
        () => saveTab(tab.noteId)
      ),
      EditorView.contentAttributes.of({
        spellcheck: config?.spellcheck ? "true" : "false",
        autocorrect: "off",
        autocapitalize: "off",
      }),
    ],
    [config?.typewriterMode, config?.lineNumbers, config?.spellcheck, tab.noteId, saveTab, updateContent]
  );

  useEffect(() => {
    if (!ref.current) return;
    const view = new EditorView({
      state: EditorState.create({
        doc: tab.loaded,
        extensions,
      }),
      parent: ref.current,
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab.noteId]);

  // Sync external content changes (file watcher) into the editor.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === tab.loaded) return;
    if (tab.isDirty) return; // don't clobber unsaved local changes
    view.dispatch({
      changes: { from: 0, to: current.length, insert: tab.loaded },
    });
  }, [tab.loaded, tab.isDirty]);

  // Wikilink navigation: catch the custom event from the link extension.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ target: string }>).detail;
      const dest = resolveWikilink(detail.target, Object.values(notes));
      if (dest) openNote(dest);
    };
    el.addEventListener("notor:open-link", handler);
    return () => el.removeEventListener("notor:open-link", handler);
  }, [notes, openNote]);

  // Apply config changes (typewriter / line numbers) without recreating the view.
  // For now those rebuild via key on the parent if the user changes settings,
  // so we accept that small re-mount cost in exchange for simpler code.

  if (tab.isLoading) {
    return (
      <div className={styles.loading} aria-busy>
        Loading…
      </div>
    );
  }
  if (tab.lastError) {
    return <div className={styles.error}>Failed to load: {tab.lastError}</div>;
  }

  return (
    <div className={styles.surface}>
      <div ref={ref} className={styles.cm} />
      <EditorStatusBar tab={tab} />
    </div>
  );
}

function EditorStatusBar({ tab }: { tab: OpenTab }) {
  const focusMode = useUIStore((s) => s.focusMode);
  if (focusMode) return null;
  const words = useMemo(
    () => tab.content.replace(/---[\s\S]*?---/, "").trim().split(/\s+/).filter(Boolean).length,
    [tab.content]
  );
  return (
    <footer className={styles.status}>
      <span>{words} words</span>
      <span>{tab.isDirty ? "● Unsaved" : "Saved"}</span>
    </footer>
  );
}
