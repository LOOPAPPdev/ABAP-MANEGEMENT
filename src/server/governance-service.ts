/**
 * Application use cases. Coordinates persistence (Drizzle/D1) and the pure
 * governance domain. Framework-agnostic: used by Hono routes and React Router loaders/actions.
 */
import { and, asc, count, desc, eq } from "drizzle-orm";
import {
  computeDashboard,
  evaluate,
  indexById,
  statusChangeWarnings,
  type ActivityState,
  type Area,
  type EvidenceKind,
  type Status,
} from "~/domain/governance";
import type { Db } from "./db/client";
import { activities, activityEvents, evidence } from "./db/schema";
import { DEFAULT_PROJECT_ID } from "./db/seed";

export type Clock = () => Date;
export const systemClock: Clock = () => new Date();
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export class NotFoundError extends Error {}

type ActivityRow = typeof activities.$inferSelect;
export type ActivityRecord = ActivityRow & ActivityState;

function toState(row: ActivityRow, evidenceCount: number): ActivityRecord {
  return {
    ...row,
    area: row.area as Area,
    status: row.status as Status,
    evidenceCount,
  };
}

export class GovernanceService {
  constructor(
    private readonly db: Db,
    private readonly clock: Clock = systemClock,
    private readonly projectId: string = DEFAULT_PROJECT_ID,
  ) {}

  private today() {
    return isoDay(this.clock());
  }

  async listActivities() {
    const [rows, counts] = await Promise.all([
      this.db.select().from(activities).where(eq(activities.projectId, this.projectId)).orderBy(asc(activities.id)),
      this.db
        .select({ activityId: evidence.activityId, n: count() })
        .from(evidence)
        .where(eq(evidence.projectId, this.projectId))
        .groupBy(evidence.activityId),
    ]);
    const byId = new Map(counts.map((c) => [c.activityId, c.n]));
    return rows.map((r) => toState(r, byId.get(r.id) ?? 0));
  }

  async listEvaluated() {
    return evaluate(await this.listActivities(), this.today());
  }

  async dashboard() {
    return computeDashboard(await this.listActivities(), this.today());
  }

  async getActivity(id: string) {
    const all = await this.listEvaluated();
    const activity = all.find((a) => a.id === id);
    if (!activity) throw new NotFoundError(`activity ${id} not found`);
    const [evidenceRows, events] = await Promise.all([
      this.db
        .select()
        .from(evidence)
        .where(and(eq(evidence.projectId, this.projectId), eq(evidence.activityId, id)))
        .orderBy(desc(evidence.createdAt)),
      this.db
        .select()
        .from(activityEvents)
        .where(and(eq(activityEvents.projectId, this.projectId), eq(activityEvents.activityId, id)))
        .orderBy(desc(activityEvents.id)),
    ]);
    const dependency = activity.dependencyId ? (all.find((a) => a.id === activity.dependencyId) ?? null) : null;
    const dependents = all.filter((a) => a.dependencyId === id);
    return { activity, dependency, dependents, evidence: evidenceRows, events };
  }

  async listEvidence() {
    return this.db
      .select()
      .from(evidence)
      .where(eq(evidence.projectId, this.projectId))
      .orderBy(desc(evidence.createdAt));
  }

  /** Changes status and appends an audit event atomically. Policy: flag, do not reject. */
  async changeStatus(id: string, next: Status, actor: string) {
    const all = await this.listActivities();
    const current = all.find((a) => a.id === id);
    if (!current) throw new NotFoundError(`activity ${id} not found`);
    const warnings = statusChangeWarnings(current, next, indexById(all));
    if (current.status !== next) {
      const at = this.clock().toISOString();
      await this.db.batch([
        this.db
          .update(activities)
          .set({ status: next, updatedAt: at, updatedBy: actor })
          .where(and(eq(activities.projectId, this.projectId), eq(activities.id, id))),
        this.db.insert(activityEvents).values({
          projectId: this.projectId,
          activityId: id,
          actor,
          action: "status.changed",
          fromValue: current.status,
          toValue: next,
          at,
        }),
      ]);
    }
    return { ...(await this.getActivity(id)), warnings };
  }

  /** Stores a validated evidence record and its audit event atomically. */
  async addEvidence(id: string, input: { kind: EvidenceKind; ref: string; note?: string }, actor: string) {
    const all = await this.listActivities();
    if (!all.some((a) => a.id === id)) throw new NotFoundError(`activity ${id} not found`);
    const at = this.clock().toISOString();
    const evidenceId = crypto.randomUUID();
    await this.db.batch([
      this.db.insert(evidence).values({
        id: evidenceId,
        projectId: this.projectId,
        activityId: id,
        kind: input.kind,
        ref: input.ref,
        note: input.note ?? "",
        createdBy: actor,
        createdAt: at,
      }),
      this.db.update(activities).set({ updatedAt: at, updatedBy: actor })
        .where(and(eq(activities.projectId, this.projectId), eq(activities.id, id))),
      this.db.insert(activityEvents).values({
        projectId: this.projectId,
        activityId: id,
        actor,
        action: "evidence.added",
        fromValue: null,
        toValue: `${input.kind}:${input.ref}`,
        at,
      }),
    ]);
    return { evidenceId, ...(await this.getActivity(id)) };
  }
}
