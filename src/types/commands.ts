import type { LucideIcon } from "lucide-react";

export interface AppCommand {
  id: string;
  title: string;
  /** Optional short subtitle shown to the right of the title */
  subtitle?: string;
  /** Optional keyboard shortcut hint, e.g. "⌘K" */
  shortcut?: string;
  /** Lucide icon component */
  icon?: LucideIcon;
  /** Category for grouping in the palette */
  category?: string;
  /** Synonyms to expand matchable terms */
  keywords?: string[];
  /** Runs the command */
  run: () => void | Promise<void>;
}
