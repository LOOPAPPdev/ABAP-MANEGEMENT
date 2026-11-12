import { describe, expect, it } from "vitest";
import {
  computeDashboard,
  computeFlag,
  indexById,
  isDependencySatisfied,
  isEffectivelyDone,
  statusChangeWarnings,
  type ActivityState,
} from "~/domain/governance";

const TODAY = "2026-11-12";
const act = (over: Partial<ActivityState> & { id: string }): ActivityState => ({
  phase: "01 Project Charter",
  area: "Product",
  status: "NOT STARTED",
  dependencyId: null,
  due: null,
  evidenceCount: 0,
  ...over,
});

describe("Feature: effective completion", () => {
  it("GIVEN status DONE and one evidence WHEN evaluated THEN it is effectively done", () => {
    expect(isEffectivelyDone(act({ id: "ACT-01", status: "DONE", evidenceCount: 1 }))).toBe(true);
  });
  it("GIVEN status DONE and no evidence WHEN evaluated THEN it is not done and flagged NO EVIDENCE", () => {
    const a = act({ id: "ACT-01", status: "DONE" });
    expect(isEffectivelyDone(a)).toBe(false);
    expect(computeFlag(a, indexById([a]), TODAY)).toBe("NO EVIDENCE");
  });
  it("GIVEN status VERIFIED and no evidence THEN flag is NO EVIDENCE", () => {
    const a = act({ id: "ACT-01", status: "VERIFIED" });
    expect(computeFlag(a, indexById([a]), TODAY)).toBe("NO EVIDENCE");
  });
  it("GIVEN evidence but status APPROVED THEN it is not effectively done", () => {
    expect(isEffectivelyDone(act({ id: "ACT-01", status: "APPROVED", evidenceCount: 3 }))).toBe(false);
  });
});

describe("Feature: dependencies", () => {
  const pre = act({ id: "ACT-01", status: "DONE" }); // no evidence
  const dep = act({ id: "ACT-02", dependencyId: "ACT-01", status: "IN PROGRESS" });

  it("GIVEN predecessor DONE without evidence WHEN dependent is started THEN flag is DEP PENDING", () => {
    const byId = indexById([pre, dep]);
    expect(isDependencySatisfied(dep, byId)).toBe(false);
    expect(computeFlag(dep, byId, TODAY)).toBe("DEP PENDING");
  });
  it("GIVEN predecessor effectively done THEN dependency is satisfied and no flag", () => {
    const byId = indexById([{ ...pre, evidenceCount: 1 }, dep]);
    expect(isDependencySatisfied(dep, byId)).toBe(true);
    expect(computeFlag(dep, byId, TODAY)).toBeNull();
  });
  it("GIVEN dependent NOT STARTED THEN DEP PENDING is not raised (workbook rule)", () => {
    const idle = { ...dep, status: "NOT STARTED" as const };
    expect(computeFlag(idle, indexById([pre, idle]), TODAY)).toBeNull();
  });
  it("GIVEN an unknown predecessor THEN dependency is not satisfied", () => {
    expect(isDependencySatisfied(act({ id: "ACT-05", dependencyId: "ACT-99" }), new Map())).toBe(false);
  });
});

describe("Feature: flag precedence BLOCKED > NO EVIDENCE > DEP PENDING > OVERDUE", () => {
  it("BLOCKED wins over every other condition", () => {
    const a = act({ id: "ACT-02", status: "BLOCKED", dependencyId: "ACT-01", due: "2020-01-01" });
    expect(computeFlag(a, indexById([act({ id: "ACT-01" }), a]), TODAY)).toBe("BLOCKED");
  });
  it("OVERDUE when due date passed and not effectively done", () => {
    const a = act({ id: "ACT-01", status: "IN PROGRESS", due: "2026-11-11" });
    expect(computeFlag(a, indexById([a]), TODAY)).toBe("OVERDUE");
  });
  it("no OVERDUE when due today", () => {
    const a = act({ id: "ACT-01", status: "IN PROGRESS", due: TODAY });
    expect(computeFlag(a, indexById([a]), TODAY)).toBeNull();
  });
  it("no OVERDUE when effectively done", () => {
    const a = act({ id: "ACT-01", status: "DONE", evidenceCount: 1, due: "2020-01-01" });
    expect(computeFlag(a, indexById([a]), TODAY)).toBeNull();
  });
});

describe("Feature: dashboard", () => {
  const list: ActivityState[] = [
    act({ id: "ACT-01", status: "DONE", evidenceCount: 1 }),
    act({ id: "ACT-02", phase: "02 Product Discovery", status: "DONE", dependencyId: "ACT-01" }),
    act({ id: "ACT-04", phase: "04 UX/UI Design", area: "Design", status: "BLOCKED" }),
    act({ id: "ACT-07", phase: "07 Development", area: "Engineering", status: "IN PROGRESS" }),
  ];
  const d = computeDashboard(list, TODAY);

  it("counts only DONE with evidence in overall progress", () => {
    expect(d.overall).toEqual({ done: 1, total: 4, ratio: 0.25 });
  });
  it("summarises areas like the workbook Dashboard sheet", () => {
    const product = d.byArea.find((a) => a.area === "Product")!;
    expect(product).toMatchObject({ done: 1, total: 2, ratio: 0.5, gatePassed: false });
    expect(d.byArea.find((a) => a.area === "Design")!.blocked).toBe(1);
    expect(d.byArea.find((a) => a.area === "Engineering")!.inProgress).toBe(1);
    expect(d.byArea.find((a) => a.area === "Deployment")).toMatchObject({ total: 0, ratio: 0, gatePassed: false });
  });
  it("the next gate is the first phase with an open activity", () => {
    expect(d.phaseGates[0]).toMatchObject({ phase: "01 Project Charter", passed: true });
    expect(d.nextGate).toMatchObject({ phase: "02 Product Discovery", openIds: ["ACT-02"] });
  });
  it("lists flags", () => {
    expect(d.flags).toEqual([
      { id: "ACT-02", flag: "NO EVIDENCE" },
      { id: "ACT-04", flag: "BLOCKED" },
    ]);
  });
  it("counts statuses", () => {
    expect(d.byStatus.DONE).toBe(2);
    expect(d.byStatus["NOT STARTED"]).toBe(0);
  });
});

describe("Feature: status change warnings (flag, do not reject)", () => {
  it("warns NO EVIDENCE and DEP PENDING when moving to DONE too early", () => {
    const pre = act({ id: "ACT-01" });
    const a = act({ id: "ACT-02", dependencyId: "ACT-01" });
    expect(statusChangeWarnings(a, "DONE", indexById([pre, a]))).toEqual(["NO EVIDENCE", "DEP PENDING"]);
  });
  it("no warnings for a valid move", () => {
    const a = act({ id: "ACT-01", evidenceCount: 1 });
    expect(statusChangeWarnings(a, "DONE", indexById([a]))).toEqual([]);
  });
});
