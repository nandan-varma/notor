import { create } from "zustand";
import type { SearchFilters, SearchResult } from "@/types/vault";
import * as api from "@/lib/tauri";

interface SearchState {
  query: string;
  filters: SearchFilters;
  results: SearchResult[];
  loading: boolean;

  setQuery: (q: string) => void;
  setFilters: (f: SearchFilters) => void;
  runSearch: () => Promise<void>;
  clear: () => void;
}

export const useSearchStore = create<SearchState>((set, get) => ({
  query: "",
  filters: {},
  results: [],
  loading: false,

  setQuery: (q) => set({ query: q }),
  setFilters: (filters) => set({ filters }),

  runSearch: async () => {
    const { query, filters } = get();
    if (!query.trim()) {
      set({ results: [] });
      return;
    }
    set({ loading: true });
    try {
      const results = await api.fullTextSearch(query, filters);
      set({ results, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  clear: () => set({ query: "", results: [] }),
}));
