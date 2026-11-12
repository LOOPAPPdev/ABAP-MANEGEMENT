import { and, desc, eq } from "drizzle-orm";
import {
  nextSnapshot,
  parseSheetValues,
  planSheetSync,
  SYNC_MODES,
  type FieldChange,
  type SheetValues,
  type SyncField,
  type SyncMode,
  type SyncPlan,
} from "~/domain/governance";
import { evidenceInputSchema } from "../api/schemas";
import type { Db } from "../db/client";
import { activities, activityEvents, appSettings, evidence, sheetSnapshots, syncRuns } from "../db/schema";
import { DEFAULT_PROJECT_ID } from "../db/seed";
import type { Clock } from "../governance-service";
import { SheetsNotConnectedError, type SheetSource } from "./sources";

export const SYNC_MODE_KEY = "sheets.syncMode";
export const AUTO_SYNC_MIN_INTERVAL_S = 30;

const COLUMN: Record<SyncField, "status" | "priority" | "owner" | "due" | "notes"> = {
  status: "status",
  priority: "priority",
  owner: "owner",
  due: "due",
  notes: "notes",
};

export const conflictKey = (c: Pick<FieldChange, "activityId" | "field">) => `${c.activityId}:${c.field}`;

export interface SyncPreview {
  source: { kind: SheetSource["kind"]; label: string };
  readAt: string;
  plan: SyncPlan;
  /** Evidence values from the sheet rejected by the evidence rules. */
  invalidEvidence: { activityId: string; ref: string; message: string }[];
  rowCount: number;
}

export interface SyncResult extends SyncPreview {
  mode: "auto" | "manual";
  applied: { changes: number; evidence: number };
  skippedConflicts: FieldChange[];
}

export class SheetSyncService {
  constructor(
    private readonly db: Db,
    private readonly source: SheetSource,
    private readonly clock: Clock,
    private readonly projectId = DEFAULT_PROJECT_ID,
  ) {}

  async getMode(): Promise<SyncMode> {
    const [r] = await this.db.select().from(appSettings).where(eq(appSettings.key, SYNC_MODE_KEY));
    return (SYNC_MODES as readonly string[]).includes(r?.value ?? "") ? (r!.value as SyncMode) : "auto";
  }

  async setMode(mode: SyncMode, actor: string) {
    const row = { key: SYNC_MODE_KEY, value: mode, updatedAt: this.clock().toISOString(), updatedBy: actor };
    await this.db.insert(appSettings).values(row).onConflictDoUpdate({ target: appSettings.key, set: row });
  }

  async lastRun() {
    const [r] = await this.db.select().from(syncRuns).where(eq(syncRuns.projectId, this.projectId)).orderBy(desc(syncRuns.id)).limit(1);
    return r ?? null;
  }

  private async load() {
    const [values, acts, evs, snaps] = await Promise.all([
      this.source.read(),
      this.db.select().from(activities).where(eq(activities.projectId, this.projectId)),
      this.db.select({ activityId: evidence.activityId, ref: evidence.ref }).from(evidence).where(eq(evidence.projectId, this.projectId)),
      this.db.select().from(sheetSnapshots).where(eq(sheetSnapshots.projectId, this.projectId)),
    ]);
    const { rows, issues } = parseSheetValues(values);
    const app = acts.map((a) => ({
      id: a.id,
      status: a.status as never,
      priority: a.priority as never,
      owner: a.owner,
      due: a.due,
      notes: a.notes,
      evidenceRefs: evs.filter((e) => e.activityId === a.id).map((e) => e.ref),
    }));
    const snapshots = new Map(snaps.map((s) => [s.activityId, JSON.parse(s.valuesJson) as SheetValues]));
    const plan = planSheetSync(rows, app, snapshots);
    plan.issues.push(...issues);
    const invalidEvidence = plan.evidence
      .map((e) => ({ ...e, check: evidenceInputSchema.safeParse({ kind: /^https?:\/\//i.test(e.ref) ? "link" : "text", ref: e.ref }) }))
      .filter((e) => !e.check.success)
      .map((e) => ({ activityId: e.activityId, ref: e.ref, message: e.check.error!.issues.map((i) => i.message).join("; ") }));
    return { rows, snapshots, plan, invalidEvidence };
  }

  /** Reads the sheet and plans the sync. No writes. */
  async preview(): Promise<SyncPreview> {
    const { rows, plan, invalidEvidence } = await this.load();
    return { source: { kind: this.source.kind, label: this.source.label }, readAt: this.clock().toISOString(), plan, invalidEvidence, rowCount: rows.length };
  }

  /**
   * Reads, plans and applies in ONE D1 batch: field updates, evidence, audit events, snapshots, sync run.
   * Conflicts are applied only when listed in `resolve` (manual mode). Auto mode never applies conflicts.
   */
  async sync(p: { mode: "auto" | "manual"; actor: string; resolve?: string[] }): Promise<SyncResult> {
    const { rows, snapshots, plan, invalidEvidence } = await this.load();
    const now = this.clock().toISOString();
    const resolve = new Set(p.mode === "manual" ? (p.resolve ?? []) : []);
    const chosen = [...plan.changes, ...plan.conflicts.filter((c) => resolve.has(conflictKey(c)))];
    const skipped = plan.conflicts.filter((c) => !resolve.has(conflictKey(c)));
    const invalidRefs = new Set(invalidEvidence.map((e) => `${e.activityId}|${e.ref}`));
    const newEvidence = plan.evidence.filter((e) => !invalidRefs.has(`${e.activityId}|${e.ref}`));
    const actor = p.mode === "auto" ? `${p.actor} (sheets auto)` : `${p.actor} (sheets)`;

    const ops: unknown[] = [];
    const byActivity = new Map<string, FieldChange[]>();
    for (const c of chosen) byActivity.set(c.activityId, [...(byActivity.get(c.activityId) ?? []), c]);
    for (const [activityId, changes] of byActivity) {
      const set: Record<string, string | null> = { updatedAt: now, updatedBy: actor };
      for (const c of changes) set[COLUMN[c.field]] = c.to;
      ops.push(this.db.update(activities).set(set).where(and(eq(activities.projectId, this.projectId), eq(activities.id, activityId))));
      for (const c of changes)
        ops.push(
          this.db.insert(activityEvents).values({ projectId: this.projectId, activityId, actor, action: c.field === "status" ? "status.changed" : `sheet.${c.field}`, fromValue: c.from, toValue: c.to, at: now }),
        );
    }
    for (const e of newEvidence) {
      const kind = /^https?:\/\//i.test(e.ref) ? "link" : "text";
      ops.push(
        this.db.insert(evidence).values({ id: crypto.randomUUID(), projectId: this.projectId, activityId: e.activityId, kind, ref: e.ref, note: "Importado da planilha", createdBy: actor, createdAt: now }),
        this.db.insert(activityEvents).values({ projectId: this.projectId, activityId: e.activityId, actor, action: "evidence.added", fromValue: null, toValue: `${kind}:${e.ref}`, at: now }),
      );
    }
    for (const row of rows) {
      if (plan.unknownIds.includes(row.id)) continue;
      const unresolved = skipped.filter((c) => c.activityId === row.id).map((c) => c.field);
      const prev = snapshots.get(row.id);
      const next = nextSnapshot(row, prev, unresolved);
      // Invalid evidence is not marked as seen, so it is reported again until fixed in the sheet.
      if (invalidRefs.has(`${row.id}|${row.evidence}`)) next.evidence = prev?.evidence ?? "";
      const values = { projectId: this.projectId, activityId: row.id, valuesJson: JSON.stringify(next), syncedAt: now };
      ops.push(this.db.insert(sheetSnapshots).values(values).onConflictDoUpdate({ target: [sheetSnapshots.projectId, sheetSnapshots.activityId], set: values }));
    }
    ops.push(
      this.db.insert(syncRuns).values({
        projectId: this.projectId,
        mode: p.mode,
        actor: p.actor,
        source: this.source.kind,
        readAt: now,
        applied: chosen.length + newEvidence.length,
        conflicts: skipped.length,
        invalid: plan.issues.length + invalidEvidence.length,
        status: "ok",
        message: "",
      }),
    );
    await this.db.batch(ops as [never, ...never[]]);
    return {
      source: { kind: this.source.kind, label: this.source.label },
      readAt: now,
      plan,
      invalidEvidence,
      rowCount: rows.length,
      mode: p.mode,
      applied: { changes: chosen.length, evidence: newEvidence.length },
      skippedConflicts: skipped,
    };
  }

  /** Records a failed read so the UI can show it; never throws. */
  async recordFailure(mode: "auto" | "manual", actor: string, message: string) {
    await this.db.insert(syncRuns).values({ projectId: this.projectId, mode, actor, source: this.source.kind, readAt: this.clock().toISOString(), applied: 0, conflicts: 0, invalid: 0, status: "error", message: message.slice(0, 500) });
  }

  /**
   * Auto mode: sync when the page opens, at most every AUTO_SYNC_MIN_INTERVAL_S seconds unless forced.
   * Returns null when nothing ran. Errors are returned, not thrown, so pages still render.
   */
  async autoSyncIfDue(actor: string, force = false): Promise<{ result?: SyncResult; error?: string; notConnected?: boolean } | null> {
    if ((await this.getMode()) !== "auto") return null;
    const last = await this.lastRun();
    if (!force && last && Date.parse(last.readAt) > this.clock().getTime() - AUTO_SYNC_MIN_INTERVAL_S * 1000) return null;
    try {
      return { result: await this.sync({ mode: "auto", actor }) };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      // "Not connected yet" is a setup state, not a failure: do not log a run every 30 s.
      if (e instanceof SheetsNotConnectedError) return { error: message, notConnected: true };
      await this.recordFailure("auto", actor, message);
      return { error: message };
    }
  }
}
