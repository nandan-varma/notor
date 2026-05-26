import { useEffect, useRef, useState } from "react";
import { ArrowUp, Square } from "lucide-react";
import { useAI } from "@hooks/useAI";
import { useAIStore } from "@store/aiStore";
import { Icon } from "@components/shared/Icon";
import styles from "./AIInput.module.css";

const SLASH_COMMANDS = [
  { command: "/improve", prompt: "Suggest improvements to my current note." },
  { command: "/summarize", prompt: "Summarize this note in three bullet points." },
  { command: "/expand", prompt: "Expand the most recent heading into a full paragraph." },
  { command: "/tags", prompt: "Suggest 3–6 tags for this note based on content." },
  { command: "/title", prompt: "Suggest a better title for this note." },
  { command: "/grammar", prompt: "Fix grammar and style issues; preserve voice." },
  { command: "/template", prompt: "Generate a note template suited to this content." },
];

export function AIInput() {
  const [value, setValue] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const { send, abort } = useAI();
  const isStreaming = useAIStore((s) => s.isStreaming);

  // Auto-resize
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  }, [value]);

  const onSlash = (cmd: string) => {
    const match = SLASH_COMMANDS.find((s) => s.command === cmd);
    if (match) setValue(match.prompt);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) {
        const v = value;
        setValue("");
        void send(v);
      }
    }
  };

  const showCommands =
    value.startsWith("/") &&
    SLASH_COMMANDS.some((s) => s.command.startsWith(value));

  return (
    <div className={styles.wrap}>
      {showCommands && (
        <ul className={styles.commands}>
          {SLASH_COMMANDS.filter((s) => s.command.startsWith(value)).map((s) => (
            <li
              key={s.command}
              className={styles.cmd}
              onClick={() => onSlash(s.command)}
            >
              <span className={styles.cmdName}>{s.command}</span>
              <span className={styles.cmdHint}>{s.prompt}</span>
            </li>
          ))}
        </ul>
      )}
      <div className={styles.row}>
        <textarea
          ref={taRef}
          rows={1}
          placeholder="Write. Reflect. Discover."
          className={styles.input}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKey}
        />
        {isStreaming ? (
          <button className={styles.send} onClick={abort} aria-label="Stop">
            <Icon icon={Square} size={14} />
          </button>
        ) : (
          <button
            className={styles.send}
            onClick={() => {
              if (value.trim()) {
                const v = value;
                setValue("");
                void send(v);
              }
            }}
            aria-label="Send"
            disabled={!value.trim()}
          >
            <Icon icon={ArrowUp} size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
