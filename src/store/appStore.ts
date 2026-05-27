import { create } from "zustand";
import type { AppLevelState, RecentVault } from "@/lib/tauri";
import * as api from "@/lib/tauri";

interface AppState {
  recentVaults: RecentVault[];
  lastVault: string | null;
  lastTheme: string | null;
  loaded: boolean;

  hydrate: () => Promise<AppLevelState | null>;
  forgetVault: (path: string) => Promise<void>;
  setTheme: (theme: string) => Promise<void>;
}

export const useAppStore = create<AppState>((set) => ({
  recentVaults: [],
  lastVault: null,
  lastTheme: null,
  loaded: false,

  hydrate: async () => {
    if (!api.isTauri) return null;
    try {
      const state = await api.getAppState();
      set({
        recentVaults: state.recentVaults,
        lastVault: state.lastVault,
        lastTheme: state.lastTheme,
        loaded: true,
      });
      return state;
    } catch {
      set({ loaded: true });
      return null;
    }
  },

  forgetVault: async (path) => {
    const next = await api.forgetRecentVault(path);
    set({ recentVaults: next.recentVaults, lastVault: next.lastVault });
  },

  setTheme: async (theme) => {
    set({ lastTheme: theme });
    if (api.isTauri) {
      await api.setLastTheme(theme).catch(() => undefined);
    }
  },
}));
