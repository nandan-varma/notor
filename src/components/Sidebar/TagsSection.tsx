import { useMemo } from "react";
import { Hash } from "lucide-react";
import { useVaultStore } from "@store/vaultStore";
import { Icon } from "@components/shared/Icon";
import { Badge } from "@components/shared/Badge";
import styles from "./TagsSection.module.css";

export function TagsSection() {
  const notes = useVaultStore((s) => s.notes);

  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of Object.values(notes)) {
      for (const t of n.tags) {
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 12);
  }, [notes]);

  if (tags.length === 0) return null;

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <span className={styles.title}>Tags</span>
      </div>
      <ul className={styles.list}>
        {tags.map(([name, count]) => (
          <li key={name}>
            <button className={styles.row}>
              <Icon icon={Hash} size={12} className={styles.icon} />
              <span className={styles.label}>{name}</span>
              <Badge variant="muted">{count}</Badge>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
