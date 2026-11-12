import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  fromCleanSea,
  fromGovernance,
  parseCleanSea,
  project,
  validateGraph,
  VIEWS,
  type Graph,
  type GovernanceActivityInput,
} from "~/domain/diagram";
import { evaluate, fixtureSchema, type Area, type Status } from "~/domain/governance";

const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const fixture = fixtureSchema.parse(read("data/seed/activities.v1.json"));
const activities: GovernanceActivityInput[] = evaluate(
  fixture.activities.map((a) => ({
    id: a.ID,
    phase: a.Phase,
    area: a.Area as Area,
    status: (a.ID === "ACT-01" ? "DONE" : a.Status) as Status,
    dependencyId: a.Dependency || null,
    due: null,
    evidenceCount: a.ID === "ACT-01" ? 1 : 0,
    title: a.Activity,
    acceptance: a.Acceptance,
    deliverable: a.Deliverable,
    owner: a.Owner,
    priority: a.Priority,
  })),
  "2026-11-12",
);
const governance = fromGovernance(activities, "Full Stack Governance System");
const cleansea = fromCleanSea(parseCleanSea(read("data/reference/cleansea.v1.json")));
const graphs: [string, Graph][] = [
  ["governance", governance],
  ["cleansea", cleansea],
];

describe("Feature: universal graph adapters", () => {
  it.each(graphs)("%s graph has referential integrity", (_, g) => {
    expect(validateGraph(g)).toEqual([]);
  });

  it("governance graph keeps the 14 ACT IDs and the 13 workbook dependencies", () => {
    const acts = governance.nodes.filter((n) => /^ACT-\d{2}$/.test(n.id));
    expect(acts).toHaveLength(14);
    expect(governance.edges.filter((e) => e.kind === "dependency")).toHaveLength(13);
    expect(governance.edges).toContainEqual(expect.objectContaining({ from: "ACT-05", to: "ACT-06", kind: "dependency" }));
    expect(governance.nodes.find((n) => n.id === "ACT-01")).toMatchObject({ done: true, href: "/activities/ACT-01" });
  });

  it("cleansea graph has 17 steps in 6 phases, 4 documents, 9 people, and is marked not validated", () => {
    expect(cleansea.nodes.filter((n) => n.type === "process" || n.type === "decision")).toHaveLength(17);
    expect(cleansea.groups).toHaveLength(6);
    expect(cleansea.nodes.filter((n) => n.type === "document")).toHaveLength(4);
    expect(cleansea.nodes.filter((n) => n.type === "person")).toHaveLength(9);
    expect(cleansea.status).toBe("não validado");
    expect(cleansea.notes[0]).toContain("23 atividades");
  });

  it("cleansea step 10 (release gateway) is a decision and gaps are unvalidated", () => {
    expect(cleansea.nodes.find((n) => n.id === "S10")).toMatchObject({ type: "decision", unvalidated: true });
    expect(cleansea.nodes.find((n) => n.id === "S01")).toMatchObject({ unvalidated: false });
  });

  it("inferred links are flagged as inferred", () => {
    const a = cleansea.edges.filter((e) => e.kind === "association");
    expect(a.length).toBeGreaterThan(0);
    expect(a.every((e) => e.inferred)).toBe(true);
    expect(a).toContainEqual(expect.objectContaining({ from: "S13", to: "D1" }));
  });
});

describe("Feature: view toggle preserves the model (ADR-003 D)", () => {
  for (const [name, g] of graphs) {
    for (const view of VIEWS) {
      it(`GIVEN ${name} WHEN view = ${view} THEN placed ∪ hidden = all nodes and edges exist`, () => {
        const before = structuredClone(g);
        const p = project(g, view);
        const shown = new Set([...Object.keys(p.placements), ...p.sequence]);
        const all = new Set(g.nodes.map((n) => n.id));
        expect(new Set([...shown, ...p.hiddenIds])).toEqual(all);
        expect(p.hiddenIds.every((id) => !shown.has(id))).toBe(true);
        const edgeIds = new Set(g.edges.map((e) => e.id));
        expect(p.edgeIds.every((id) => edgeIds.has(id))).toBe(true);
        expect(g).toEqual(before); // projection never mutates the graph
        if (p.hiddenIds.length > 0) expect(p.warnings.join(" ")).toContain("não pertencem");
      });
    }
  }

  it("placed boxes never overlap", () => {
    for (const [, g] of graphs)
      for (const view of VIEWS) {
        const boxes = Object.entries(project(g, view).placements);
        for (let i = 0; i < boxes.length; i++)
          for (let j = i + 1; j < boxes.length; j++) {
            const [, a] = boxes[i]!;
            const [, b] = boxes[j]!;
            const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
            expect(overlap, `${g.id}/${view}: ${boxes[i]![0]} overlaps ${boxes[j]![0]}`).toBe(false);
          }
      }
  });

  it("complex view shows every node and every edge", () => {
    for (const [, g] of graphs) {
      const p = project(g, "complex");
      expect(p.hiddenIds).toEqual([]);
      expect(p.edgeIds).toHaveLength(g.edges.length);
    }
  });

  it("governance orgchart warns that people data is missing and uses Project → Area → Activity", () => {
    const p = project(governance, "orgchart");
    expect(p.warnings[0]).toContain("Sem dados de pessoas");
    expect(p.placements.PROJECT!.y).toBeLessThan(p.placements["AREA:Product"]!.y);
    expect(p.placements["AREA:Product"]!.y).toBeLessThan(p.placements["ACT-01"]!.y);
  });

  it("governance infographic groups by area because 14 phases exceed 7 columns", () => {
    const p = project(governance, "infographic");
    expect(p.decorations.filter((d) => d.kind === "frame")).toHaveLength(6);
    expect(p.decorations[0]!.detail).toBe("1/3 concluídas");
    expect(p.warnings[0]).toContain("14 fases");
  });

  it("bpmn has one lane per responsibility plus start and end events", () => {
    const p = project(cleansea, "bpmn");
    expect(p.decorations.filter((d) => d.kind === "lane").map((d) => d.label)).toEqual(cleansea.lanes);
    expect(p.decorations.some((d) => d.kind === "start")).toBe(true);
    expect(p.eventLinks).toContainEqual({ from: "event:start", to: "S01" });
    expect(p.eventLinks).toContainEqual({ from: "S17", to: "event:end" });
  });

  it("cleansea bpmn uses the 6 phases as columns and stays within the lanes' width", () => {
    const p = project(cleansea, "bpmn");
    const cols = p.decorations.filter((d) => d.id.startsWith("col:"));
    expect(cols).toHaveLength(6);
    const laneRight = Math.max(...p.decorations.filter((d) => d.kind === "lane").map((d) => d.x + d.w));
    expect(Math.max(...cols.map((d) => d.x + d.w))).toBeLessThanOrEqual(laneRight);
    expect(p.width).toBeLessThan(laneRight + 100); // regression: header frames once stretched the canvas to ~3300px
  });

  it("tutorial follows the process order", () => {
    expect(project(cleansea, "tutorial").sequence.slice(0, 3)).toEqual(["S01", "S02", "S03"]);
    expect(project(governance, "tutorial").sequence[0]).toBe("ACT-01");
  });
});
