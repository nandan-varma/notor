/**
 * One-shot bootstrap that runs BEFORE React mounts. The goal is to apply
 * the persisted theme and any other render-affecting state synchronously
 * so the first paint reflects the user's preference — no light-then-dark
 * flash.
 *
 * Reading from the Tauri command is async, so we fall back to the value
 * cached in localStorage on every successful hydrate. localStorage is
 * unreliable across vault moves but is the only synchronous-readable
 * surface; the Rust state.json remains the source of truth.
 */

import { getAppState, isTauri } from "@/lib/tauri";

const THEME_KEY = "notor.theme";

export function applyCachedTheme() {
  try {
    const cached = localStorage.getItem(THEME_KEY);
    if (cached === "dark" || cached === "light") {
      document.documentElement.dataset.theme = cached;
      return;
    }
    if (cached === "system" || cached === null) {
      const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
      document.documentElement.dataset.theme = prefersLight ? "light" : "dark";
    }
  } catch {
    // localStorage may be blocked in restricted contexts. Dark is the spec default.
    document.documentElement.dataset.theme = "dark";
  }
}

/** Update both the cache (next launch) and the live DOM. */
export function persistTheme(theme: string) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // ignore
  }
  if (theme === "system") {
    const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
    document.documentElement.dataset.theme = prefersLight ? "light" : "dark";
  } else {
    document.documentElement.dataset.theme = theme;
  }
}

/** Hydrate the local cache from the canonical Rust-side state. Async. */
export async function refreshThemeCacheFromBackend() {
  if (!isTauri) return;
  try {
    const state = await getAppState();
    if (state.lastTheme) {
      try {
        localStorage.setItem(THEME_KEY, state.lastTheme);
      } catch {
        // ignore
      }
    }
  } catch {
    // first launch: file doesn't exist yet, that's fine
  }
}
