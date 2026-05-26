import { create } from "zustand";
import type { AIContextMode, AIMessage, AIProvider } from "@/types/ai";

interface AIState {
  messages: AIMessage[];
  provider: AIProvider;
  model: string;
  contextMode: AIContextMode;
  apiKeys: Partial<Record<AIProvider, string>>;
  isStreaming: boolean;

  appendMessage: (m: AIMessage) => void;
  updateMessage: (id: string, patch: Partial<AIMessage>) => void;
  clear: () => void;
  setProvider: (p: AIProvider) => void;
  setModel: (m: string) => void;
  setContextMode: (m: AIContextMode) => void;
  setApiKey: (provider: AIProvider, key: string) => void;
  setStreaming: (b: boolean) => void;
}

const DEFAULT_MODELS: Record<AIProvider, string> = {
  anthropic: "claude-sonnet-4-20250514",
  openai: "gpt-4o",
  ollama: "llama3.2",
  openrouter: "anthropic/claude-3.5-sonnet",
};

export const useAIStore = create<AIState>((set) => ({
  messages: [],
  provider: "anthropic",
  model: DEFAULT_MODELS.anthropic,
  contextMode: "note",
  apiKeys: {},
  isStreaming: false,

  appendMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),
  updateMessage: (id, patch) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    })),
  clear: () => set({ messages: [] }),
  setProvider: (p) =>
    set({ provider: p, model: DEFAULT_MODELS[p] }),
  setModel: (m) => set({ model: m }),
  setContextMode: (m) => set({ contextMode: m }),
  setApiKey: (provider, key) =>
    set((s) => ({ apiKeys: { ...s.apiKeys, [provider]: key } })),
  setStreaming: (b) => set({ isStreaming: b }),
}));

export { DEFAULT_MODELS };
