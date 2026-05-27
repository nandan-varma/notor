import { useEffect } from "react";
import { useVaultStore } from "@store/vaultStore";
import { useAppStore } from "@store/appStore";
import { persistTheme } from "@/lib/bootstrap";

export function useTheme() {
  const theme = useVaultStore((s) => s.meta?.config.theme ?? "dark");
  const persistRemote = useAppStore((s) => s.setTheme);

  useEffect(() => {
    persistTheme(theme);
    if (theme === "dark" || theme === "light" || theme === "system") {
      void persistRemote(theme);
    }
    if (theme !== "system") return;
    const mql = window.matchMedia("(prefers-color-scheme: light)");
    const apply = () => persistTheme("system");
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, [theme, persistRemote]);
}
