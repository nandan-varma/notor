/**
 * useAI — streams completions from the configured provider.
 *
 * The Vercel AI SDK is set up so providers are swappable: pass an API key
 * via the AI store and we wire the right client. Streaming is done via
 * fetch + a ReadableStream so we don't depend on platform-specific SSE
 * support (the same code works under Tauri's WKWebView).
 */
import { useCallback } from "react";
import { useAIStore } from "@store/aiStore";
import { useEditorStore } from "@store/editorStore";
import { useVaultStore } from "@store/vaultStore";
import type { AIMessage } from "@/types/ai";
import { nanoid } from "nanoid";

interface Sender {
  send: (text: string) => Promise<void>;
  abort: () => void;
}

const SYSTEM_PROMPT = `You are a knowledgeable writing assistant embedded in a note-taking app called Notor.
Respond concisely. When suggesting markdown, use proper fenced code blocks.
Treat the user's note as the primary context unless asked to consider more.`;

export function useAI(): Sender {
  const provider = useAIStore((s) => s.provider);
  const model = useAIStore((s) => s.model);
  const apiKey = useAIStore((s) => s.apiKeys[s.provider] ?? "");
  const contextMode = useAIStore((s) => s.contextMode);
  const append = useAIStore((s) => s.appendMessage);
  const updateMsg = useAIStore((s) => s.updateMessage);
  const setStreaming = useAIStore((s) => s.setStreaming);
  const messages = useAIStore((s) => s.messages);

  const activeTab = useEditorStore((s) => s.tabs.find((t) => t.noteId === s.activeTabId));
  const notes = useVaultStore((s) => s.notes);

  const buildContext = useCallback(() => {
    if (!activeTab) return "";
    const noteBlock = `Current note: "${activeTab.title}"\n\n---\n${activeTab.content}\n---`;
    if (contextMode === "note") return noteBlock;
    if (contextMode === "vault") {
      const titles = Object.values(notes)
        .slice(0, 50)
        .map((n) => `- ${n.title}`)
        .join("\n");
      return `${noteBlock}\n\nOther notes in this vault:\n${titles}`;
    }
    return noteBlock;
  }, [activeTab, contextMode, notes]);

  const controllerRef: { current: AbortController | null } = { current: null };

  const abort = useCallback(() => {
    controllerRef.current?.abort();
    setStreaming(false);
  }, [setStreaming]);

  const send = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      const userMsg: AIMessage = {
        id: nanoid(),
        role: "user",
        content: text,
        createdAt: new Date().toISOString(),
      };
      append(userMsg);

      const assistantId = nanoid();
      const placeholder: AIMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
        isStreaming: true,
      };
      append(placeholder);
      setStreaming(true);

      const controller = new AbortController();
      controllerRef.current = controller;

      try {
        const context = buildContext();
        const sysPrompt = context ? `${SYSTEM_PROMPT}\n\n${context}` : SYSTEM_PROMPT;
        const stream = await callProvider({
          provider,
          model,
          apiKey,
          system: sysPrompt,
          messages: [...messages, userMsg],
          signal: controller.signal,
        });

        let buffer = "";
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          updateMsg(assistantId, { content: buffer });
        }
        updateMsg(assistantId, { content: buffer, isStreaming: false });
      } catch (e) {
        updateMsg(assistantId, {
          content: `Error: ${String(e)}`,
          isStreaming: false,
        });
      } finally {
        setStreaming(false);
        controllerRef.current = null;
      }
    },
    [append, updateMsg, setStreaming, messages, provider, model, apiKey, buildContext]
  );

  return { send, abort };
}

interface ProviderCall {
  provider: string;
  model: string;
  apiKey: string;
  system: string;
  messages: AIMessage[];
  signal: AbortSignal;
}

/** Returns a ReadableStream of raw text deltas. */
async function callProvider(p: ProviderCall): Promise<ReadableStream<Uint8Array>> {
  if (!p.apiKey && p.provider !== "ollama") {
    throw new Error(`No API key configured for ${p.provider}. Set it in Settings.`);
  }

  if (p.provider === "anthropic") {
    return anthropicStream(p);
  }
  if (p.provider === "openai") {
    return openaiStream(p);
  }
  if (p.provider === "ollama") {
    return ollamaStream(p);
  }
  if (p.provider === "openrouter") {
    return openrouterStream(p);
  }
  throw new Error(`Unknown provider: ${p.provider}`);
}

function passthrough(transform: (chunk: string) => string | null): TransformStream<Uint8Array, Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let leftover = "";
  return new TransformStream({
    transform(chunk, controller) {
      leftover += decoder.decode(chunk, { stream: true });
      const lines = leftover.split("\n");
      leftover = lines.pop() ?? "";
      for (const line of lines) {
        const out = transform(line);
        if (out !== null) controller.enqueue(encoder.encode(out));
      }
    },
    flush(controller) {
      if (leftover) {
        const out = transform(leftover);
        if (out !== null) controller.enqueue(encoder.encode(out));
      }
    },
  });
}

async function anthropicStream(p: ProviderCall): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal: p.signal,
    headers: {
      "content-type": "application/json",
      "x-api-key": p.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: p.model,
      system: p.system,
      max_tokens: 2048,
      stream: true,
      messages: p.messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  if (!res.ok || !res.body) {
    const errText = await res.text();
    throw new Error(`Anthropic ${res.status}: ${errText}`);
  }
  return res.body.pipeThrough(
    passthrough((line) => {
      if (!line.startsWith("data: ")) return null;
      const json = line.slice(6);
      if (json === "[DONE]") return null;
      try {
        const obj = JSON.parse(json);
        if (obj.type === "content_block_delta" && obj.delta?.type === "text_delta") {
          return obj.delta.text;
        }
      } catch {
        // ignore
      }
      return null;
    })
  );
}

async function openaiStream(p: ProviderCall): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    signal: p.signal,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${p.apiKey}`,
    },
    body: JSON.stringify({
      model: p.model,
      stream: true,
      messages: [
        { role: "system", content: p.system },
        ...p.messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    }),
  });
  if (!res.ok || !res.body) {
    throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  }
  return res.body.pipeThrough(
    passthrough((line) => {
      if (!line.startsWith("data: ")) return null;
      const json = line.slice(6);
      if (json === "[DONE]") return null;
      try {
        const obj = JSON.parse(json);
        return obj.choices?.[0]?.delta?.content ?? null;
      } catch {
        return null;
      }
    })
  );
}

async function ollamaStream(p: ProviderCall): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch("http://localhost:11434/api/chat", {
    method: "POST",
    signal: p.signal,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: p.model,
      stream: true,
      messages: [
        { role: "system", content: p.system },
        ...p.messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    }),
  });
  if (!res.ok || !res.body) {
    throw new Error(`Ollama ${res.status}: ${await res.text()}`);
  }
  return res.body.pipeThrough(
    passthrough((line) => {
      if (!line.trim()) return null;
      try {
        const obj = JSON.parse(line);
        return obj.message?.content ?? null;
      } catch {
        return null;
      }
    })
  );
}

async function openrouterStream(p: ProviderCall): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    signal: p.signal,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${p.apiKey}`,
    },
    body: JSON.stringify({
      model: p.model,
      stream: true,
      messages: [
        { role: "system", content: p.system },
        ...p.messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    }),
  });
  if (!res.ok || !res.body) {
    throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  }
  return res.body.pipeThrough(
    passthrough((line) => {
      if (!line.startsWith("data: ")) return null;
      const json = line.slice(6);
      if (json === "[DONE]") return null;
      try {
        const obj = JSON.parse(json);
        return obj.choices?.[0]?.delta?.content ?? null;
      } catch {
        return null;
      }
    })
  );
}
