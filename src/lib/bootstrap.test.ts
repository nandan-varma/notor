import { describe, it, expect, beforeEach } from "vitest";
import { applyCachedTheme, persistTheme } from "./bootstrap";

const KEY = "notor.theme";

describe("bootstrap theme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("defaults to dark when nothing cached and OS prefers dark", () => {
    // jsdom matchMedia stubs default to matches=false → not light → dark.
    applyCachedTheme();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("respects explicit light cache", () => {
    localStorage.setItem(KEY, "light");
    applyCachedTheme();
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("persistTheme updates the DOM and localStorage", () => {
    persistTheme("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem(KEY)).toBe("light");

    persistTheme("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem(KEY)).toBe("dark");
  });

  it("system mode resolves through matchMedia", () => {
    persistTheme("system");
    // jsdom prefers-color-scheme: light returns false by default → dark
    expect(["light", "dark"]).toContain(document.documentElement.dataset.theme);
    expect(localStorage.getItem(KEY)).toBe("system");
  });
});
