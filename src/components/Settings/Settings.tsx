import { useState, type ReactNode } from "react";
import { X, Folder, Type, FileText, Sparkles, Keyboard, Info } from "lucide-react";
import { useUIStore } from "@store/uiStore";
import { useVaultStore } from "@store/vaultStore";
import { useAIStore } from "@store/aiStore";
import { Icon } from "@components/shared/Icon";
import type { AIProvider } from "@/types/ai";
import styles from "./Settings.module.css";

type Section = "general" | "editor" | "files" | "ai" | "shortcuts" | "about";

const SECTIONS: { id: Section; label: string; icon: typeof Folder }[] = [
  { id: "general", label: "General", icon: Folder },
  { id: "editor", label: "Editor", icon: Type },
  { id: "files", label: "Files", icon: FileText },
  { id: "ai", label: "AI", icon: Sparkles },
  { id: "shortcuts", label: "Shortcuts", icon: Keyboard },
  { id: "about", label: "About", icon: Info },
];

export function Settings() {
  const visible = useUIStore((s) => s.overlay === "settings");
  const close = useUIStore((s) => s.closeOverlay);
  const [section, setSection] = useState<Section>("general");
  if (!visible) return null;

  return (
    <div className={styles.backdrop} onClick={close}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <header className={styles.header}>
          <h2>Settings</h2>
          <button className={styles.close} onClick={close}>
            <Icon icon={X} size={14} />
          </button>
        </header>
        <div className={styles.body}>
          <nav className={styles.nav}>
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                className={`${styles.navItem} ${section === s.id ? styles.active : ""}`}
                onClick={() => setSection(s.id)}
              >
                <Icon icon={s.icon} size={13} />
                <span>{s.label}</span>
              </button>
            ))}
          </nav>
          <div className={styles.content}>
            {section === "general" && <GeneralSection />}
            {section === "editor" && <EditorSection />}
            {section === "files" && <FilesSection />}
            {section === "ai" && <AISection />}
            {section === "shortcuts" && <ShortcutsSection />}
            {section === "about" && <AboutSection />}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <div className={styles.fieldLabel}>
        <span>{label}</span>
        {hint && <span className={styles.hint}>{hint}</span>}
      </div>
      <div className={styles.fieldControl}>{children}</div>
    </div>
  );
}

function GeneralSection() {
  const meta = useVaultStore((s) => s.meta);
  const updateConfig = useVaultStore((s) => s.updateConfig);
  return (
    <>
      <h3 className={styles.h3}>Vault</h3>
      <Field label="Vault name">
        <input
          className={styles.input}
          value={meta?.config.name ?? ""}
          onChange={(e) => updateConfig({ name: e.target.value })}
        />
      </Field>
      <Field label="Vault path" hint="Read-only">
        <input className={styles.input} value={meta?.path ?? ""} readOnly />
      </Field>
      <Field label="Theme">
        <select
          className={styles.select}
          value={meta?.config.theme ?? "dark"}
          onChange={(e) => updateConfig({ theme: e.target.value as "dark" | "light" | "system" })}
        >
          <option value="dark">Dark</option>
          <option value="light">Light</option>
          <option value="system">System</option>
        </select>
      </Field>
    </>
  );
}

function EditorSection() {
  const meta = useVaultStore((s) => s.meta);
  const updateConfig = useVaultStore((s) => s.updateConfig);
  return (
    <>
      <h3 className={styles.h3}>Editor</h3>
      <Field label="Spell check">
        <input
          type="checkbox"
          checked={meta?.config.spellcheck ?? true}
          onChange={(e) => updateConfig({ spellcheck: e.target.checked })}
        />
      </Field>
      <Field label="Typewriter mode" hint="Keep cursor centered vertically">
        <input
          type="checkbox"
          checked={meta?.config.typewriterMode ?? false}
          onChange={(e) => updateConfig({ typewriterMode: e.target.checked })}
        />
      </Field>
      <Field label="Line numbers">
        <input
          type="checkbox"
          checked={meta?.config.lineNumbers ?? false}
          onChange={(e) => updateConfig({ lineNumbers: e.target.checked })}
        />
      </Field>
      <Field label="Max editor width">
        <select
          className={styles.select}
          value={meta?.config.editorWidth ?? 680}
          onChange={(e) => updateConfig({ editorWidth: Number(e.target.value) })}
        >
          <option value={560}>560px</option>
          <option value={680}>680px (default)</option>
          <option value={800}>800px</option>
          <option value={9999}>Unlimited</option>
        </select>
      </Field>
    </>
  );
}

function FilesSection() {
  return (
    <>
      <h3 className={styles.h3}>Files</h3>
      <p className={styles.muted}>
        Notes are stored as plain markdown files on disk. Renaming a note in
        Finder is safe — Notor picks up the change immediately.
      </p>
    </>
  );
}

function AISection() {
  const provider = useAIStore((s) => s.provider);
  const model = useAIStore((s) => s.model);
  const apiKey = useAIStore((s) => s.apiKeys[s.provider] ?? "");
  const setProvider = useAIStore((s) => s.setProvider);
  const setModel = useAIStore((s) => s.setModel);
  const setApiKey = useAIStore((s) => s.setApiKey);
  const contextMode = useAIStore((s) => s.contextMode);
  const setContextMode = useAIStore((s) => s.setContextMode);

  return (
    <>
      <h3 className={styles.h3}>AI</h3>
      <Field label="Provider">
        <select
          className={styles.select}
          value={provider}
          onChange={(e) => setProvider(e.target.value as AIProvider)}
        >
          <option value="anthropic">Anthropic</option>
          <option value="openai">OpenAI</option>
          <option value="ollama">Ollama (local)</option>
          <option value="openrouter">OpenRouter</option>
        </select>
      </Field>
      <Field label="API key" hint="Stored locally — never sent to Notor">
        <input
          type="password"
          className={styles.input}
          placeholder={provider === "ollama" ? "Not required" : "sk-…"}
          value={apiKey}
          disabled={provider === "ollama"}
          onChange={(e) => setApiKey(provider, e.target.value)}
        />
      </Field>
      <Field label="Model">
        <input
          className={styles.input}
          value={model}
          onChange={(e) => setModel(e.target.value)}
        />
      </Field>
      <Field label="Context mode">
        <select
          className={styles.select}
          value={contextMode}
          onChange={(e) => setContextMode(e.target.value as "note" | "vault" | "selection")}
        >
          <option value="note">Current note</option>
          <option value="vault">Vault titles + excerpts</option>
          <option value="selection">Selected text only</option>
        </select>
      </Field>
    </>
  );
}

function ShortcutsSection() {
  const shortcuts: { label: string; keys: string }[] = [
    { label: "Quick open", keys: "⌘K" },
    { label: "Command palette", keys: "⌘⇧P" },
    { label: "Full-text search", keys: "⌘⇧F" },
    { label: "Toggle AI panel", keys: "⌘⇧A" },
    { label: "Toggle sidebar", keys: "⌘⇧S" },
    { label: "Toggle note list", keys: "⌘⇧L" },
    { label: "Focus mode", keys: "⌘⌥F" },
    { label: "Settings", keys: "⌘," },
    { label: "New note", keys: "⌘N" },
    { label: "New note (root)", keys: "⌘⇧N" },
    { label: "Close tab", keys: "⌘W" },
    { label: "Save", keys: "⌘S" },
    { label: "Toggle theme", keys: "⌘⇧T" },
  ];
  return (
    <>
      <h3 className={styles.h3}>Keyboard shortcuts</h3>
      <ul className={styles.shortcuts}>
        {shortcuts.map((s) => (
          <li key={s.label}>
            <span>{s.label}</span>
            <kbd>{s.keys}</kbd>
          </li>
        ))}
      </ul>
    </>
  );
}

function AboutSection() {
  return (
    <>
      <h3 className={styles.h3}>Notor</h3>
      <p className={styles.muted}>
        Version 0.1.0 · MIT licensed · Made for people who care about their notes.
      </p>
      <p className={styles.muted}>
        <a href="https://github.com/notor" target="_blank" rel="noreferrer">
          github.com/notor
        </a>
      </p>
    </>
  );
}
