export interface VaultConfig {
  version: number;
  name: string;
  avatar: string;
  theme: "dark" | "light" | "system";
  defaultFont: string;
  aiProvider: "anthropic" | "openai" | "ollama" | "openrouter";
  aiModel: string;
  collections: string[];
  sidebarWidth: number;
  editorWidth: number;
  aiPanelWidth: number;
  spellcheck: boolean;
  typewriterMode: boolean;
  lineNumbers: boolean;
  focusMode: boolean;
  openTabs?: string[];
  activeTab?: string | null;
}

export interface VaultMeta {
  path: string;
  config: VaultConfig;
  noteCount: number;
}

export interface FolderInfo {
  name: string;
  relativePath: string;
  absolutePath: string;
  noteCount: number;
  children: FolderInfo[];
}

export interface SearchFilters {
  tags?: string[];
  folder?: string | null;
  collection?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  wordCountMin?: number | null;
  wordCountMax?: number | null;
  hasBacklinks?: boolean | null;
}

export interface SearchResult {
  id: string;
  title: string;
  path: string;
  excerpt: string;
  score: number;
  highlights: { start: number; end: number }[];
}

export interface TagInfo {
  name: string;
  count: number;
}
