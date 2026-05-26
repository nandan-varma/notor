import { useMemo, useState } from "react";
import { ChevronRight, Folder, FolderOpen, Plus } from "lucide-react";
import { useVaultStore } from "@store/vaultStore";
import { useUIStore } from "@store/uiStore";
import type { FolderInfo } from "@/types/vault";
import { Icon } from "@components/shared/Icon";
import { Badge } from "@components/shared/Badge";
import * as api from "@/lib/tauri";
import styles from "./FolderTree.module.css";

export function FolderTree() {
  const folders = useVaultStore((s) => s.folders);
  const refreshFolders = useVaultStore((s) => s.refreshFolders);

  const onNewFolder = async () => {
    const name = window.prompt("Folder name");
    if (!name) return;
    await api.createFolder(name);
    refreshFolders();
  };

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <span className={styles.title}>Notes</span>
        <button
          className={styles.add}
          onClick={onNewFolder}
          aria-label="New folder"
        >
          <Icon icon={Plus} size={12} />
        </button>
      </div>
      <ul className={styles.tree} role="tree">
        {folders.map((f) => (
          <FolderRow key={f.absolutePath} folder={f} depth={0} />
        ))}
      </ul>
    </section>
  );
}

function FolderRow({ folder, depth }: { folder: FolderInfo; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 1);
  const activeFolder = useUIStore((s) => s.activeFolder);
  const setActiveFolder = useUIStore((s) => s.setActiveFolder);
  const showContextMenu = useUIStore((s) => s.showContextMenu);
  const refreshFolders = useVaultStore((s) => s.refreshFolders);

  const isActive = activeFolder === folder.relativePath;
  const indent = useMemo(() => ({ paddingLeft: 8 + depth * 16 }), [depth]);

  const onContext = (e: React.MouseEvent) => {
    e.preventDefault();
    showContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          label: "Rename folder",
          action: async () => {
            const name = window.prompt("New folder name", folder.name);
            if (name && name !== folder.name) {
              await api.renameFolder(folder.relativePath, name);
              refreshFolders();
            }
          },
        },
        {
          label: "Delete folder",
          danger: true,
          action: async () => {
            if (window.confirm(`Move "${folder.name}" to trash?`)) {
              await api.deleteFolder(folder.relativePath);
              refreshFolders();
            }
          },
        },
      ],
    });
  };

  return (
    <li className={styles.item} role="treeitem" aria-expanded={expanded}>
      <button
        className={`${styles.row} ${isActive ? styles.active : ""}`}
        style={indent}
        onClick={() => {
          setActiveFolder(folder.relativePath);
          if (folder.children.length) setExpanded((e) => !e);
        }}
        onContextMenu={onContext}
      >
        <span
          className={`${styles.chevron} ${expanded ? styles.expanded : ""}`}
          aria-hidden
        >
          {folder.children.length > 0 && <Icon icon={ChevronRight} size={10} />}
        </span>
        <Icon
          icon={expanded ? FolderOpen : Folder}
          size={12}
          className={styles.folderIcon}
        />
        <span className={styles.label}>{folder.name}</span>
        {!expanded && folder.noteCount > 0 && (
          <Badge variant="muted">{folder.noteCount}</Badge>
        )}
      </button>
      {expanded && folder.children.length > 0 && (
        <ul className={styles.tree}>
          {folder.children.map((child) => (
            <FolderRow
              key={child.absolutePath}
              folder={child}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
