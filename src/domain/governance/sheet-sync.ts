/**
 * Spreadsheet → app synchronization rules (pure).
 *
 * Direction: Google Sheets (DATA_Activities, input columns M:R) → app. Read-only on the sheet.
 * Three-way merge per field: base = last value read from the sheet (snapshot).
 *   sheet === app                       → nothing to do
 *   no base, or app === base            → the sheet changed: apply
 *   sheet === base                      → only the app changed: keep the app value
 *   sheet, app and base all different   → conflict (never applied automatically)
 * Evidence is additive: a new value in the Evidence column creates an evidence record; nothing is deleted.
 */
import { PRIORITIES, STATUSES, type Priority, type Status } from "./types";

export const SYNC_FIELDS = ["status", "priority", "owner", "due", "notes"] as const;
export type SyncField = (typeof SYNC_FIELDS)[number];

export const SYNC_MODES = ["auto", "preview"] as const;
export type SyncMode = (typeof SYNC_MODES)[number];

/** Values of one activity as written in the sheet (only valid fields are present). */
export interface SheetValues {
  status?: Status;
  priority?: Priority;
  owner?: string;
  due?: string | null;
  notes?: string;
  evidence?: string;
}

export interface SheetRow extends SheetValues {
  id: string;
  /** 1-based row number in the sheet, for messages. */
  row: number;
}

export interface SheetIssue {
  id: string;
  row: number;
  field: string;
  value: string;
  message: string;
}

export interface AppValues {
  id: string;
  status: Status;
  priority: Priority;
  owner: string;
  due: string | null;
  notes: string;
  evidenceRefs: string[];
}

export interface FieldChange {
  activityId: string;
  field: SyncField;
  from: string | null;
  to: string | null;
  base: string | null | undefined;
}

export interface EvidenceAddition {
  activityId: string;
  ref: string;
}

export interface SyncPlan {
  changes: FieldChange[];
  conflicts: FieldChange[];
  evidence: EvidenceAddition[];
  issues: SheetIssue[];
  /** IDs in the sheet that do not exist in the app (never created automatically). */
  unknownIds: string[];
  /** IDs in the app missing from the sheet. */
  missingIds: string[];
}

const COLUMN_BY_FIELD = { status: "Status", priority: "Priority", owner: "Owner", due: "Due", notes: "Notes", evidence: "Evidence" } as const;

/** Normalizes a due date: YYYY-MM-DD, DD/MM/YYYY or empty. Returns undefined when invalid. */
export function normalizeDue(raw: string): string | null | undefined {
  const v = raw.trim();
  if (v === "") return null;
  let y: number, m: number, d: number;
  let match = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else if ((match = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else return undefined;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return undefined;
  return date.toISOString().slice(0, 10);
}

/**
 * Parses the raw values of the DATA_Activities sheet (header row included).
 * The header row is the first row whose first cell is "ID" and that contains "Status".
 */
export function parseSheetValues(values: readonly (readonly unknown[])[]): { rows: SheetRow[]; issues: SheetIssue[] } {
  const str = (v: unknown) => (v === undefined || v === null ? "" : String(v)).trim();
  const headerIndex = values.findIndex((r) => str(r[0]) === "ID" && r.some((c) => str(c) === "Status"));
  if (headerIndex < 0) throw new Error('Header row not found (expected a row starting with "ID" and containing "Status").');
  const header = values[headerIndex]!.map(str);
  const col = (name: string) => header.indexOf(name);
  for (const name of ["ID", ...Object.values(COLUMN_BY_FIELD)])
    if (col(name) < 0) throw new Error(`Column "${name}" not found in the header row.`);

  const rows: SheetRow[] = [];
  const issues: SheetIssue[] = [];
  values.slice(headerIndex + 1).forEach((r, i) => {
    const id = str(r[col("ID")]);
    if (!id) return;
    const rowNumber = i + 1; // relative; caller adds the range offset
    if (!/^ACT-\d{2}$/.test(id)) {
      issues.push({ id, row: rowNumber, field: "ID", value: id, message: "ID must be ACT-nn" });
      return;
    }
    const cell = (f: keyof typeof COLUMN_BY_FIELD) => str(r[col(COLUMN_BY_FIELD[f])]);
    const row: SheetRow = { id, row: rowNumber };
    const fail = (field: string, value: string, message: string) => issues.push({ id, row: rowNumber, field, value, message });

    const status = cell("status");
    if ((STATUSES as readonly string[]).includes(status)) row.status = status as Status;
    else fail("Status", status, `must be one of ${STATUSES.join(", ")}`);

    const priority = cell("priority");
    if ((PRIORITIES as readonly string[]).includes(priority)) row.priority = priority as Priority;
    else fail("Priority", priority, `must be one of ${PRIORITIES.join(", ")}`);

    const owner = cell("owner");
    if (owner.length <= 100) row.owner = owner;
    else fail("Owner", owner.slice(0, 40) + "…", "max 100 characters");

    const due = normalizeDue(cell("due"));
    if (due !== undefined) row.due = due;
    else fail("Due", cell("due"), "expected YYYY-MM-DD or DD/MM/YYYY");

    const notes = cell("notes");
    if (notes.length <= 2000) row.notes = notes;
    else fail("Notes", notes.slice(0, 40) + "…", "max 2000 characters");

    row.evidence = cell("evidence");
    rows.push(row);
  });
  const seen = new Set<string>();
  for (const r of rows) {
    if (seen.has(r.id)) issues.push({ id: r.id, row: r.row, field: "ID", value: r.id, message: "duplicate ID: only the first row is used" });
    seen.add(r.id);
  }
  return { rows: rows.filter((r, i) => rows.findIndex((x) => x.id === r.id) === i), issues };
}

/** Plans the sync. Pure: same input, same output. */
export function planSheetSync(
  rows: readonly SheetRow[],
  app: readonly AppValues[],
  snapshots: ReadonlyMap<string, SheetValues>,
): SyncPlan {
  const appById = new Map(app.map((a) => [a.id, a]));
  const plan: SyncPlan = {
    changes: [],
    conflicts: [],
    evidence: [],
    issues: [],
    unknownIds: rows.filter((r) => !appById.has(r.id)).map((r) => r.id),
    missingIds: app.filter((a) => !rows.some((r) => r.id === a.id)).map((a) => a.id),
  };
  for (const row of rows) {
    const current = appById.get(row.id);
    if (!current) continue;
    const base = snapshots.get(row.id);
    for (const field of SYNC_FIELDS) {
      if (!(field in row)) continue; // invalid in the sheet: reported by the parser
      const sheet = (row[field] ?? null) as string | null;
      const value = (current[field] ?? null) as string | null;
      if (sheet === value) continue;
      const b = base && field in base ? ((base[field] ?? null) as string | null) : undefined;
      const change: FieldChange = { activityId: row.id, field, from: value, to: sheet, base: b };
      if (b === undefined || b === value) plan.changes.push(change);
      else if (sheet === b) continue; // only the app changed
      else plan.conflicts.push(change);
    }
    const ev = row.evidence ?? "";
    if (ev && ev !== (base?.evidence ?? "") && !current.evidenceRefs.includes(ev)) plan.evidence.push({ activityId: row.id, ref: ev });
  }
  return plan;
}

/**
 * Snapshot to store after applying a plan. Conflicting fields that were not
 * resolved keep their previous base, so the conflict stays visible.
 */
export function nextSnapshot(row: SheetRow, previous: SheetValues | undefined, unresolved: readonly SyncField[]): SheetValues {
  const next: SheetValues = { ...previous };
  for (const field of SYNC_FIELDS) {
    if (!(field in row) || unresolved.includes(field)) continue;
    (next as Record<string, unknown>)[field] = row[field] ?? null;
  }
  if (row.evidence !== undefined) next.evidence = row.evidence;
  return next;
}
