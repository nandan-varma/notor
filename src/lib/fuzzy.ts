/**
 * Lightweight fuzzy matching for QuickOpen. Scores favor:
 *  - Match at the start of a word
 *  - Sequential consecutive matches
 *  - Shorter target strings (more "precise" matches)
 *
 * Returns null when no match. Match positions are returned for UI highlighting.
 */

export interface FuzzyMatch {
  score: number;
  positions: number[];
}

export function fuzzyMatch(query: string, target: string): FuzzyMatch | null {
  if (!query) return { score: 0, positions: [] };
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  const positions: number[] = [];
  let ti = 0;
  let score = 0;
  let lastMatch = -2;
  let consecutive = 0;

  for (const qc of q) {
    let found = false;
    while (ti < t.length) {
      const tc = t[ti];
      if (tc === qc) {
        positions.push(ti);
        // Boost for consecutive matches
        if (lastMatch === ti - 1) {
          consecutive += 1;
          score += 3 + consecutive;
        } else {
          consecutive = 0;
          score += 1;
        }
        // Boost for word-boundary match
        if (ti === 0 || /[\s\-_/.]/.test(t[ti - 1])) {
          score += 4;
        }
        lastMatch = ti;
        ti += 1;
        found = true;
        break;
      }
      ti += 1;
    }
    if (!found) return null;
  }

  // Penalty for unmatched characters in target
  score -= (t.length - positions.length) * 0.05;
  return { score, positions };
}
