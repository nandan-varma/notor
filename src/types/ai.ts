export type AIProvider = "anthropic" | "openai" | "ollama" | "openrouter";

export type AIContextMode = "note" | "vault" | "selection";

export interface AIMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  isStreaming?: boolean;
}

export interface AIConversation {
  noteId: string | null;
  messages: AIMessage[];
  model: string;
  provider: AIProvider;
  createdAt: string;
}

export interface AIProviderConfig {
  apiKey: string;
  baseUrl?: string;
  defaultModel: string;
}
