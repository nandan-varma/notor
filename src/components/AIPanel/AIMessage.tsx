import { memo, useMemo } from "react";
import type { AIMessage as AIMessageType } from "@/types/ai";
import styles from "./AIMessage.module.css";

interface Block {
  kind: "text" | "code";
  content: string;
  lang?: string;
}

/** Naive split into text and ``` fenced code blocks. Good enough for streaming. */
function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  const re = /```(\w+)?\n([\s\S]*?)(```|$)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      blocks.push({ kind: "text", content: text.slice(last, m.index) });
    }
    blocks.push({
      kind: "code",
      content: m[2],
      lang: m[1] ?? "",
    });
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    blocks.push({ kind: "text", content: text.slice(last) });
  }
  if (blocks.length === 0) blocks.push({ kind: "text", content: text });
  return blocks;
}

interface AIMessageProps {
  message: AIMessageType;
}

function AIMessageImpl({ message }: AIMessageProps) {
  const blocks = useMemo(() => parseBlocks(message.content), [message.content]);
  const isUser = message.role === "user";

  return (
    <div className={`${styles.row} ${isUser ? styles.user : styles.assistant}`}>
      {blocks.map((b, i) =>
        b.kind === "code" ? (
          <pre key={i} className={styles.code} data-lang={b.lang || "text"}>
            <span className={styles.lang}>{b.lang?.toUpperCase() || "TEXT"}</span>
            <button
              className={styles.copy}
              onClick={() => navigator.clipboard.writeText(b.content)}
            >
              copy
            </button>
            <code>{b.content}</code>
          </pre>
        ) : (
          <span key={i} className={styles.text}>
            {b.content}
            {message.isStreaming && i === blocks.length - 1 && (
              <span className={styles.cursor} />
            )}
          </span>
        )
      )}
    </div>
  );
}

export const AIMessage = memo(AIMessageImpl);
