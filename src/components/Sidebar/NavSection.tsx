import { Home, FileText, Layers, Tag } from "lucide-react";
import { useVaultStore } from "@store/vaultStore";
import { useUIStore } from "@store/uiStore";
import { Icon } from "@components/shared/Icon";
import { Badge } from "@components/shared/Badge";
import styles from "./NavSection.module.css";

type NavId = "home" | "all" | "collections" | "tags";

interface NavItem {
  id: NavId;
  label: string;
  icon: typeof Home;
}

const NAV_ITEMS: NavItem[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "all", label: "All Notes", icon: FileText },
  { id: "collections", label: "Collections", icon: Layers },
  { id: "tags", label: "Tags", icon: Tag },
];

export function NavSection() {
  const noteCount = useVaultStore((s) => Object.keys(s.notes).length);
  const activeFolder = useUIStore((s) => s.activeFolder);
  const setActiveFolder = useUIStore((s) => s.setActiveFolder);

  // The "All Notes" view is represented by activeFolder === "" (root virtual)
  const activeId: NavId | null = activeFolder === "" ? "all" : null;

  return (
    <nav className={styles.nav}>
      {NAV_ITEMS.map((item) => {
        const isActive = item.id === activeId;
        return (
          <button
            key={item.id}
            className={`${styles.row} ${isActive ? styles.active : ""}`}
            onClick={() => {
              if (item.id === "all") setActiveFolder("");
              else setActiveFolder(null);
            }}
          >
            <Icon icon={item.icon} size={14} className={styles.icon} />
            <span className={styles.label}>{item.label}</span>
            {item.id === "all" && noteCount > 0 && (
              <Badge variant="default">{noteCount}</Badge>
            )}
          </button>
        );
      })}
    </nav>
  );
}
