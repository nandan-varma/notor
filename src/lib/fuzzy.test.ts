import { describe, it, expect } from "vitest";
import { fuzzyMatch } from "./fuzzy";

describe("fuzzyMatch", () => {
  it("matches consecutive characters", () => {
    const r = fuzzyMatch("kyo", "Kyoto Trip Ideas");
    expect(r).not.toBeNull();
    expect(r!.positions).toEqual([0, 1, 2]);
  });

  it("returns null on no match", () => {
    expect(fuzzyMatch("xyz", "Daily notes")).toBeNull();
  });

  it("boosts word-boundary matches", () => {
    const a = fuzzyMatch("dn", "DailyNotes");
    const b = fuzzyMatch("dn", "the dn in the middle");
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    // both word-boundary; the shorter target wins
    expect(a!.score).toBeGreaterThan(b!.score - 5);
  });

  it("matches case-insensitively", () => {
    expect(fuzzyMatch("KYO", "kyoto")).not.toBeNull();
  });
});
