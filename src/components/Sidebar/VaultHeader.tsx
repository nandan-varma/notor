import { useVaultStore } from "@store/vaultStore";
import { useUIStore } from "@store/uiStore";
import { Search } from "lucide-react";
import { Icon } from "@components/shared/Icon";
import { Tooltip } from "@components/shared/Tooltip";
import styles from "./VaultHeader.module.css";

export function VaultHeader() {
  const meta = useVaultStore((s) => s.meta);
  const openOverlay = useUIStore((s) => s.openOverlay);

  const name = meta?.config.name ?? "Open a vault";
  const avatar = meta?.config.avatar ?? "?";

  return (
    <header className={styles.header}>
      <div className={styles.identity}>
        <div className={styles.avatar} aria-hidden>
          {avatar.slice(0, 2).toUpperCase()}
        </div>
        <div className={styles.name} title={name}>
          {name}
        </div>
      </div>
      <Tooltip label="Quick open" shortcut="⌘K" side="bottom">
        <button
          className={styles.searchBtn}
          aria-label="Search notes"
          onClick={() => openOverlay("quickOpen")}
        >
          <Icon icon={Search} size={14} />
        </button>
      </Tooltip>
    </header>
  );
}
