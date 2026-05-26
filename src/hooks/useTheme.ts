import { useEffect } from "react";
import { useVaultStore } from "@store/vaultStore";

export function useTheme() {
  const theme = useVaultStore((s) => s.meta?.config.theme ?? "dark");

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") {
      const mql = window.matchMedia("(prefers-color-scheme: light)");
      const apply = () => {
        root.dataset.theme = mql.matches ? "light" : "dark";
      };
      apply();
      mql.addEventListener("change", apply);
      return () => mql.removeEventListener("change", apply);
    }
    root.dataset.theme = theme;
  }, [theme]);
}
