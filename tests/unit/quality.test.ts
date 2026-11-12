import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const criteria = JSON.parse(readFileSync("data/quality/dv-criteria.v1.json", "utf8")).criteria as { id: string; obligation: string }[];
const audit = readFileSync("docs/quality/dv-audit_v0.1.md", "utf8");

describe("Feature: data-visualization quality audit", () => {
  it("imports the 33 criteria (18 MUST, 15 SHOULD)", () => {
    expect(criteria).toHaveLength(33);
    expect(criteria.filter((c) => c.obligation === "MUST")).toHaveLength(18);
  });

  it("the audit covers every criterion exactly once", () => {
    for (const c of criteria) expect(audit.match(new RegExp(`^\\| ${c.id} \\|`, "gm")) ?? [], c.id).toHaveLength(1);
  });

  it("no MUST criterion is marked as failing or partial", () => {
    for (const c of criteria.filter((x) => x.obligation === "MUST")) {
      const cells = audit.split("\n").find((l) => l.startsWith(`| ${c.id} |`))!.split("|").map((x) => x.trim());
      // cells: ["", id, obligation, criterion, dashboard, canvas, evidence, ""]
      for (const status of [cells[4], cells[5]]) expect(status, c.id).toMatch(/^(✅|N\/A|⏳)/);
    }
  });
});
