import { describe, expect, it } from "vitest";
import { nextSnapshot, normalizeDue, parseSheetValues, planSheetSync, type AppValues, type SheetValues } from "~/domain/governance";

const HEADER = ["ID", "Phase", "Area", "Activity", "Objective", "Tutorial", "Knowledge", "Tool", "Deliverable", "Dependency", "Acceptance", "Reference", "Status", "Priority", "Owner", "Due", "Evidence", "Notes", "EffDone", "DepOK", "Flag"];
const row = (id: string, status = "NOT STARTED", extra: Partial<Record<"priority" | "owner" | "due" | "evidence" | "notes", string>> = {}) => {
  const r = Array<string>(HEADER.length).fill("");
  r[0] = id;
  r[12] = status;
  r[13] = extra.priority ?? "Medium";
  r[14] = extra.owner ?? "A DEFINIR";
  r[15] = extra.due ?? "";
  r[16] = extra.evidence ?? "";
  r[17] = extra.notes ?? "";
  return r;
};
const sheet = (...rows: string[][]) => [["DATA_Activities — tabela central"], [], HEADER, ...rows];
const app = (id: string, over: Partial<AppValues> = {}): AppValues => ({
  id,
  status: "NOT STARTED",
  priority: "Medium",
  owner: "A DEFINIR",
  due: null,
  notes: "",
  evidenceRefs: [],
  ...over,
});
const plan = (values: string[][], apps: AppValues[], snaps: Record<string, SheetValues> = {}) =>
  planSheetSync(parseSheetValues(values).rows, apps, new Map(Object.entries(snaps)));

describe("Feature: parse DATA_Activities", () => {
  it("finds the header row and reads the input columns", () => {
    const { rows, issues } = parseSheetValues(sheet(row("ACT-01", "IN PROGRESS", { owner: "Ana", due: "31/12/2026" })));
    expect(issues).toEqual([]);
    expect(rows[0]).toMatchObject({ id: "ACT-01", status: "IN PROGRESS", owner: "Ana", due: "2026-12-31", priority: "Medium" });
  });

  it("reports invalid values per field and keeps the valid fields", () => {
    const { rows, issues } = parseSheetValues(sheet(row("ACT-01", "FINISHED", { due: "31/02/2026" })));
    expect(issues.map((i) => i.field)).toEqual(["Status", "Due"]);
    expect(rows[0]).not.toHaveProperty("status");
    expect(rows[0]).toMatchObject({ owner: "A DEFINIR" });
  });

  it("rejects malformed IDs and keeps only the first duplicate", () => {
    const { rows, issues } = parseSheetValues(sheet(row("X-1"), row("ACT-01"), row("ACT-01", "DONE")));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe("NOT STARTED");
    expect(issues.map((i) => i.message)).toEqual(["ID must be ACT-nn", "duplicate ID: only the first row is used"]);
  });

  it("fails clearly when the header is missing", () => {
    expect(() => parseSheetValues([["foo"]])).toThrow(/Header row not found/);
  });

  it("normalizes due dates", () => {
    expect(normalizeDue("2026-1-5")).toBe("2026-01-05");
    expect(normalizeDue("05/01/2026")).toBe("2026-01-05");
    expect(normalizeDue("")).toBeNull();
    expect(normalizeDue("tomorrow")).toBeUndefined();
  });
});

describe("Feature: three-way sync plan", () => {
  it("GIVEN a cell changed in the sheet WHEN planning THEN the app value changes", () => {
    const p = plan(sheet(row("ACT-01", "IN PROGRESS")), [app("ACT-01")], { "ACT-01": { status: "NOT STARTED" } });
    expect(p.changes).toEqual([{ activityId: "ACT-01", field: "status", from: "NOT STARTED", to: "IN PROGRESS", base: "NOT STARTED" }]);
    expect(p.conflicts).toEqual([]);
  });

  it("GIVEN no snapshot yet WHEN the sheet differs THEN the sheet value is applied", () => {
    const p = plan(sheet(row("ACT-01", "PREPARED")), [app("ACT-01")]);
    expect(p.changes.map((c) => c.to)).toEqual(["PREPARED"]);
  });

  it("GIVEN only the app changed WHEN planning THEN the app value is kept (auto sync never reverts app edits)", () => {
    const p = plan(sheet(row("ACT-01", "NOT STARTED")), [app("ACT-01", { status: "DONE" })], { "ACT-01": { status: "NOT STARTED" } });
    expect(p.changes).toEqual([]);
    expect(p.conflicts).toEqual([]);
  });

  it("GIVEN both changed differently WHEN planning THEN it is a conflict, not a change", () => {
    const p = plan(sheet(row("ACT-01", "BLOCKED")), [app("ACT-01", { status: "DONE" })], { "ACT-01": { status: "NOT STARTED" } });
    expect(p.changes).toEqual([]);
    expect(p.conflicts).toEqual([{ activityId: "ACT-01", field: "status", from: "DONE", to: "BLOCKED", base: "NOT STARTED" }]);
  });

  it("GIVEN a new Evidence value WHEN planning THEN an evidence record is added once", () => {
    const p1 = plan(sheet(row("ACT-01", "DONE", { evidence: "https://example.org/charter" })), [app("ACT-01", { status: "DONE" })]);
    expect(p1.evidence).toEqual([{ activityId: "ACT-01", ref: "https://example.org/charter" }]);
    const p2 = plan(sheet(row("ACT-01", "DONE", { evidence: "https://example.org/charter" })), [app("ACT-01", { status: "DONE", evidenceRefs: ["https://example.org/charter"] })]);
    expect(p2.evidence).toEqual([]);
  });

  it("never creates unknown activities and reports missing ones", () => {
    const p = plan(sheet(row("ACT-99")), [app("ACT-01")]);
    expect(p.unknownIds).toEqual(["ACT-99"]);
    expect(p.missingIds).toEqual(["ACT-01"]);
    expect(p.changes).toEqual([]);
  });

  it("covers every synced field", () => {
    const p = plan(sheet(row("ACT-01", "NOT STARTED", { priority: "High", owner: "Ana", due: "2026-12-01", notes: "ok" })), [app("ACT-01")]);
    expect(p.changes.map((c) => c.field)).toEqual(["priority", "owner", "due", "notes"]);
  });
});

describe("Feature: snapshot after sync", () => {
  it("keeps the old base for unresolved conflicts so they stay visible", () => {
    const { rows } = parseSheetValues(sheet(row("ACT-01", "BLOCKED", { owner: "Ana" })));
    const s = nextSnapshot(rows[0]!, { status: "NOT STARTED", owner: "A DEFINIR" }, ["status"]);
    expect(s).toMatchObject({ status: "NOT STARTED", owner: "Ana" });
  });
});
