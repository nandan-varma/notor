import { describe, it, expect } from "vitest";
import { buildCommandRegistry } from "./commands";

describe("command registry", () => {
  it("returns the well-known commands by id", () => {
    const cmds = buildCommandRegistry();
    const ids = cmds.map((c) => c.id);
    expect(ids).toContain("quickOpen");
    expect(ids).toContain("toggleSidebar");
    expect(ids).toContain("toggleAIPanel");
    expect(ids).toContain("rebuildIndex");
    expect(ids).toContain("settings");
  });

  it("each command has a callable run", () => {
    const cmds = buildCommandRegistry();
    for (const c of cmds) {
      expect(typeof c.run).toBe("function");
    }
  });

  it("ids are unique", () => {
    const cmds = buildCommandRegistry();
    const set = new Set(cmds.map((c) => c.id));
    expect(set.size).toBe(cmds.length);
  });
});
