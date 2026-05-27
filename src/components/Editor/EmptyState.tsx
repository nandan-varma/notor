import { useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { Plus, FolderOpen, FilePlus, Clock, X, ChevronRight } from "lucide-react";
import { useVaultStore } from "@store/vaultStore";
import { useEditorStore } from "@store/editorStore";
import { useAppStore } from "@store/appStore";
import { useUIStore } from "@store/uiStore";
import { Icon } from "@components/shared/Icon";
import * as api from "@/lib/tauri";
import { isTauri } from "@/lib/tauri";
import { formatNoteDate } from "@/lib/dateFormat";
import styles from "./EmptyState.module.css";

export function EmptyState() {
  const meta = useVaultStore((s) => s.meta);
  if (!meta) return <Welcome />;
  return <NoTabSelected />;
}

/** First-run / no-vault state. Three primary actions + recents. */
function Welcome() {
  const openVault = useVaultStore((s) => s.openVault);
  const recents = useAppStore((s) => s.recentVaults);
  const forget = useAppStore((s) => s.forgetVault);
  const showToast = useUIStore((s) => s.showToast);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);

  const onOpenExisting = async () => {
    if (!isTauri) {
      showToast("Vault picking requires the desktop build", "info");
      return;
    }
    try {
      setBusy(true);
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: "Choose a folder to use as your vault",
      });
      if (typeof selected === "string") {
        await openVault(selected);
      }
    } catch (e) {
      showToast(`Couldn't open vault: ${humanize(e)}`, "error");
    } finally {
      setBusy(false);
    }
  };

  const onOpenRecent = (path: string) => openVault(path);

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.logo} aria-hidden>
          <svg viewBox="0 0 64 64" width="48" height="48">
            <rect width="64" height="64" rx="14" fill="var(--accent-primary)" />
            <path
              d="M18 16 L18 48 M18 16 L42 48 M42 16 L42 48"
              stroke="var(--bg-base)"
              strokeWidth="4.5"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        </div>
        <h1 className={styles.title}>Welcome to Notor</h1>
        <p className={styles.tagline}>
          Plain markdown files. Native speed. Beautiful by default.
        </p>

        {!creating ? (
          <div className={styles.primaryActions}>
            <button
              className={styles.primaryBtn}
              onClick={() => setCreating(true)}
              disabled={busy}
            >
              <Icon icon={FilePlus} size={14} /> Create new vault
            </button>
            <button
              className={styles.secondaryBtn}
              onClick={onOpenExisting}
              disabled={busy}
            >
              <Icon icon={FolderOpen} size={14} /> Open existing folder
            </button>
          </div>
        ) : (
          <CreateVaultForm onCancel={() => setCreating(false)} />
        )}

        <p className={styles.explain}>
          A vault is any folder on your Mac. Notor stores notes as <code>.md</code>{" "}
          files inside it — you can edit them in any other app, sync them via
          iCloud, or commit them to git.
        </p>

        {!creating && recents.length > 0 && (
          <section className={styles.recents}>
            <div className={styles.recentsTitle}>
              <Icon icon={Clock} size={11} /> Recent vaults
            </div>
            <ul>
              {recents.slice(0, 5).map((r) => (
                <li key={r.path} className={styles.recentRow}>
                  <button
                    className={styles.recentBtn}
                    onClick={() => onOpenRecent(r.path)}
                    title={r.path}
                  >
                    <span className={styles.recentName}>{r.name}</span>
                    <span className={styles.recentMeta}>
                      {formatNoteDate(r.lastOpened)}
                    </span>
                  </button>
                  <button
                    className={styles.recentForget}
                    onClick={() => forget(r.path)}
                    aria-label={`Forget ${r.name}`}
                  >
                    <Icon icon={X} size={10} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <ul className={styles.hints}>
          <li>
            <kbd>⌘K</kbd> Quick open
          </li>
          <li>
            <kbd>⌘⇧P</kbd> Command palette
          </li>
          <li>
            <kbd>⌘N</kbd> New note
          </li>
          <li>
            <kbd>⌘⇧A</kbd> Toggle AI
          </li>
        </ul>
      </div>
    </div>
  );
}

/** Inline form for the create-vault flow. Avoids the ugly window.prompt. */
function CreateVaultForm({ onCancel }: { onCancel: () => void }) {
  const openVault = useVaultStore((s) => s.openVault);
  const showToast = useUIStore((s) => s.showToast);
  const [parent, setParent] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const pickParent = async () => {
    if (!isTauri) return;
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: "Where should the vault folder live?",
      });
      if (typeof selected === "string") setParent(selected);
    } catch (e) {
      showToast(`Couldn't open picker: ${humanize(e)}`, "error");
    }
  };

  const submit = async () => {
    if (!parent || !name.trim() || busy) return;
    try {
      setBusy(true);
      const path = await api.createVault(parent, name.trim());
      await openVault(path);
    } catch (e) {
      showToast(`Couldn't create vault: ${humanize(e)}`, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Location</span>
        <button
          type="button"
          className={styles.fieldBtn}
          onClick={pickParent}
          disabled={busy}
        >
          {parent ? (
            <span className={styles.fieldValue} title={parent}>
              {parent}
            </span>
          ) : (
            <span className={styles.fieldPlaceholder}>Choose a folder…</span>
          )}
          <Icon icon={ChevronRight} size={12} />
        </button>
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Name</span>
        <input
          className={styles.input}
          placeholder="My Vault"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          disabled={busy}
        />
      </label>
      <div className={styles.formActions}>
        <button
          type="button"
          className={styles.secondaryBtn}
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </button>
        <button
          type="submit"
          className={styles.primaryBtn}
          disabled={!parent || !name.trim() || busy}
        >
          {busy ? "Creating…" : "Create vault"}
        </button>
      </div>
    </form>
  );
}

/** Shown when a vault is open but no note is active. */
function NoTabSelected() {
  const meta = useVaultStore((s) => s.meta);
  const refreshNotes = useVaultStore((s) => s.refreshNotes);
  const refreshFolders = useVaultStore((s) => s.refreshFolders);
  const openNote = useEditorStore((s) => s.openNote);
  const showToast = useUIStore((s) => s.showToast);
  const openOverlay = useUIStore((s) => s.openOverlay);
  const hasNotes = useVaultStore((s) => Object.keys(s.notes).length > 0);

  const onNewNote = async () => {
    if (!meta) return;
    try {
      const note = await api.createNote("", "Untitled");
      await refreshNotes();
      await refreshFolders();
      openNote(note);
    } catch (e) {
      showToast(`Couldn't create note: ${humanize(e)}`, "error");
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <h2 className={styles.subtitle}>{meta?.config.name}</h2>
        <p className={styles.tagline}>
          {hasNotes
            ? "Pick a note from the sidebar or jump straight to one."
            : "An empty vault. Let's add your first note."}
        </p>
        <div className={styles.primaryActions}>
          <button className={styles.primaryBtn} onClick={onNewNote}>
            <Icon icon={Plus} size={14} /> New note
          </button>
          {hasNotes && (
            <button
              className={styles.secondaryBtn}
              onClick={() => openOverlay("quickOpen")}
            >
              <Icon icon={FolderOpen} size={14} /> Quick open <kbd>⌘K</kbd>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function humanize(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return JSON.stringify(e);
}
