import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fixtureSchema, STATUSES } from "~/domain/governance";

const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const fixture = fixtureSchema.parse(read("data/seed/activities.v1.json"));

describe("Feature: workbook import fixture", () => {
  it("contains ACT-01..ACT-14 exactly once", () => {
    expect(fixture.activities.map((a) => a.ID)).toEqual(
      Array.from({ length: 14 }, (_, i) => `ACT-${String(i + 1).padStart(2, "0")}`),
    );
  });
  it("preserves the eight workbook statuses in order", () => {
    expect(fixture.statuses).toEqual([...STATUSES]);
  });
  it("every activity has an acceptance criterion and a resolvable dependency", () => {
    const ids = new Set(fixture.activities.map((a) => a.ID));
    for (const a of fixture.activities) {
      expect(a.Acceptance.length).toBeGreaterThan(0);
      if (a.Dependency) expect(ids.has(a.Dependency)).toBe(true);
    }
  });
  it("matches the legacy PWA seed.json field by field", () => {
    const legacy = read("reference/xls-pwa/seed.json").rows as Record<string, string>[];
    expect(legacy).toHaveLength(fixture.activities.length);
    legacy.forEach((row, i) => {
      for (const [k, v] of Object.entries(row)) expect(fixture.activities[i]![k as keyof (typeof fixture.activities)[number]]).toBe(v);
    });
  });
  it("rejects a fixture with a dependency cycle", () => {
    const bad = structuredClone(read("data/seed/activities.v1.json"));
    bad.activities[0].Dependency = "ACT-03"; // ACT-03 -> ACT-02 -> ACT-01 -> ACT-03
    expect(fixtureSchema.safeParse(bad).success).toBe(false);
  });
});
