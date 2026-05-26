import { Sparkles, Plus, Settings, X } from "lucide-react";
import { useAIStore } from "@store/aiStore";
import { useUIStore } from "@store/uiStore";
import { Icon } from "@components/shared/Icon";
import { Tooltip } from "@components/shared/Tooltip";
import { AIMessage } from "./AIMessage";
import { AIInput } from "./AIInput";
import { ModelSelector } from "./ModelSelector";
import styles from "./AIPanel.module.css";

export function AIPanel() {
  const messages = useAIStore((s) => s.messages);
  const clear = useAIStore((s) => s.clear);
  const toggleAI = useUIStore((s) => s.toggleAIPanel);
  const openSettings = () => useUIStore.getState().openOverlay("settings");

  return (
    <aside className={styles.panel} aria-label="AI assistant">
      <header className={styles.header}>
        <div className={styles.headerTitle}>
          <Icon icon={Sparkles} size={13} className={styles.sparkle} />
          <span>Recent Chats</span>
        </div>
        <div className={styles.actions}>
          <Tooltip label="New chat" side="bottom">
            <button className={styles.actionBtn} onClick={clear} aria-label="New chat">
              <Icon icon={Plus} size={14} />
            </button>
          </Tooltip>
          <Tooltip label="Settings" side="bottom">
            <button className={styles.actionBtn} onClick={openSettings} aria-label="Settings">
              <Icon icon={Settings} size={14} />
            </button>
          </Tooltip>
          <Tooltip label="Hide AI panel" shortcut="⌘⇧A" side="bottom">
            <button className={styles.actionBtn} onClick={toggleAI} aria-label="Hide AI panel">
              <Icon icon={X} size={14} />
            </button>
          </Tooltip>
        </div>
      </header>

      <div className={styles.messages}>
        {messages.length === 0 && <AIEmpty />}
        {messages.map((m) => (
          <AIMessage key={m.id} message={m} />
        ))}
      </div>

      <div className={styles.footer}>
        <AIInput />
        <ModelSelector />
      </div>
    </aside>
  );
}

function AIEmpty() {
  return (
    <div className={styles.empty}>
      <div className={styles.emptyTitle}>Write. Reflect. Discover.</div>
      <p className={styles.emptyHint}>
        Ask anything about the current note. Try <code>/summarize</code>,{" "}
        <code>/improve</code>, or <code>/tags</code>.
      </p>
    </div>
  );
}
