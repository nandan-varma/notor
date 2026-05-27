import { create } from "zustand";
import { LazyStore } from "@tauri-apps/plugin-store";
import type { AIContextMode, AIMessage, AIProvider } from "@/types/ai";
import { isTauri } from "@/lib/tauri";

const SECRETS_FILE = "ai-secrets.json";
const lazyStore = isTauri ? new LazyStore(SECRETS_FILE) : null;

async function loadStoredKeys(): Promise<Partial<Record<AIProvider, string>>> {
  if (!lazyStore) return {};
  try {
    const raw = await lazyStore.get<Partial<Record<AIProvider, string>>>("keys");
    return raw ?? {};
  } catch {
    return {};
  }
}

async function persistKeys(keys: Partial<Record<AIProvider, string>>) {
  if (!lazyStore) return;
  try {
    await lazyStore.set("keys", keys);
    await lazyStore.save();
  } catch {
    // tauri-plugin-store may not be ready during early bootstrap
  }
}

interface AIState {
  messages: AIMessage[];
  provider: AIProvider;
  model: string;
  contextMode: AIContextMode;
  apiKeys: Partial<Record<AIProvider, string>>;
  isStreaming: boolean;
  keysLoaded: boolean;

  hydrateKeys: () => Promise<void>;
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

export const useAIStore = create<AIState>((set, get) => ({
  messages: [],
  provider: "anthropic",
  model: DEFAULT_MODELS.anthropic,
  contextMode: "note",
  apiKeys: {},
  isStreaming: false,
  keysLoaded: false,

  hydrateKeys: async () => {
    if (get().keysLoaded) return;
    const keys = await loadStoredKeys();
    set({ apiKeys: keys, keysLoaded: true });
  },

  appendMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),
  updateMessage: (id, patch) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    })),
  clear: () => set({ messages: [] }),
  setProvider: (p) => set({ provider: p, model: DEFAULT_MODELS[p] }),
  setModel: (m) => set({ model: m }),
  setContextMode: (m) => set({ contextMode: m }),
  setApiKey: (provider, key) => {
    set((s) => {
      const next = { ...s.apiKeys, [provider]: key };
      void persistKeys(next);
      return { apiKeys: next };
    });
  },
  setStreaming: (b) => set({ isStreaming: b }),
}));

export { DEFAULT_MODELS };
