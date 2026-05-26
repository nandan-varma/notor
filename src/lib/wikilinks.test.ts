import { describe, it, expect } from "vitest";
import { extractWikilinks, resolveWikilink } from "./wikilinks";
import type { NoteIndex } from "@/types/note";

const makeNote = (overrides: Partial<NoteIndex>): NoteIndex => ({
  id: "id1",
  title: "Untitled",
  path: "/notes/untitled.md",
  relativePath: "untitled.md",
  folder: "",
  tags: [],
  collection: null,
  status: "active",
  pinned: false,
  created: new Date().toISOString(),
  modified: new Date().toISOString(),
  wordCount: 0,
  excerpt: "",
  backlinks: [],
  ...overrides,
});

describe("wikilinks", () => {
  it("extracts simple [[wikilinks]]", () => {
    const out = extractWikilinks("See [[Kyoto Trip Ideas]] for more.");
    expect(out).toHaveLength(1);
    expect(out[0].target).toBe("Kyoto Trip Ideas");
    expect(out[0].display).toBe("Kyoto Trip Ideas");
  });

  it("extracts piped alias", () => {
    const out = extractWikilinks("Read [[Kyoto Trip Ideas|the trip notes]].");
    expect(out[0].target).toBe("Kyoto Trip Ideas");
    expect(out[0].display).toBe("the trip notes");
  });

  it("resolves by exact title", () => {
    const notes = [makeNote({ title: "Kyoto Trip Ideas" })];
    expect(resolveWikilink("Kyoto Trip Ideas", notes)?.title).toBe("Kyoto Trip Ideas");
  });

  it("resolves case-insensitively", () => {
    const notes = [makeNote({ title: "Kyoto Trip Ideas" })];
    expect(resolveWikilink("kyoto trip ideas", notes)?.title).toBe("Kyoto Trip Ideas");
  });

  it("returns null when no match", () => {
    const notes = [makeNote({ title: "Other Note" })];
    expect(resolveWikilink("Nonexistent", notes)).toBeNull();
  });
});
