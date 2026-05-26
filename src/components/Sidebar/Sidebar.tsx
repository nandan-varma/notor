import { VaultHeader } from "./VaultHeader";
import { NavSection } from "./NavSection";
import { FolderTree } from "./FolderTree";
import { TagsSection } from "./TagsSection";
import styles from "./Sidebar.module.css";

export function Sidebar() {
  return (
    <aside className={styles.sidebar} aria-label="Vault navigation">
      <VaultHeader />
      <div className={styles.scroll}>
        <NavSection />
        <FolderTree />
        <TagsSection />
      </div>
    </aside>
  );
}
