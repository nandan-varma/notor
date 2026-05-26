import type { NoteIndex } from "@/types/note";

const WIKILINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

export interface WikilinkMatch {
  /** Raw matched text including brackets */
  raw: string;
  /** Target title or alias */
  target: string;
  /** Optional display text */
  display: string;
  /** char offsets within source */
  start: number;
  end: number;
}

export function extractWikilinks(text: string): WikilinkMatch[] {
  const out: WikilinkMatch[] = [];
  let m: RegExpExecArray | null;
  WIKILINK_RE.lastIndex = 0;
  while ((m = WIKILINK_RE.exec(text)) !== null) {
    out.push({
      raw: m[0],
      target: m[1].trim(),
      display: (m[2] ?? m[1]).trim(),
      start: m.index,
      end: m.index + m[0].length,
    });
  }
  return out;
}

/**
 * Resolve a wikilink target to a note. Matches against title (case-insensitive)
 * and aliases. Returns the best match or null.
 */
export function resolveWikilink(target: string, notes: NoteIndex[]): NoteIndex | null {
  const lc = target.toLowerCase().trim();
  // Exact title match wins.
  const exact = notes.find((n) => n.title.toLowerCase() === lc);
  if (exact) return exact;
  // Then try ID match.
  const byId = notes.find((n) => n.id.toLowerCase() === lc);
  if (byId) return byId;
  // Then prefix match.
  const prefix = notes.find((n) => n.title.toLowerCase().startsWith(lc));
  return prefix ?? null;
}
