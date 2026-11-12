import {
  AREAS,
  STATUSES,
  type ActivityState,
  type Area,
  type EvaluatedActivity,
  type Flag,
  type Status,
} from "./types";

/** Workbook EffDone: Status = DONE AND evidence exists. */
export function isEffectivelyDone(a: Pick<ActivityState, "status" | "evidenceCount">): boolean {
  return a.status === "DONE" && a.evidenceCount > 0;
}

/** Workbook DepOK: no dependency, or the predecessor is effectively done. Unknown predecessor = not satisfied. */
export function isDependencySatisfied(
  a: Pick<ActivityState, "dependencyId">,
  byId: ReadonlyMap<string, ActivityState>,
): boolean {
  if (!a.dependencyId) return true;
  const dep = byId.get(a.dependencyId);
  return dep ? isEffectivelyDone(dep) : false;
}

/**
 * Workbook Flag with the same precedence:
 * BLOCKED > NO EVIDENCE > DEP PENDING > OVERDUE.
 * @param today ISO date YYYY-MM-DD (server clock).
 */
export function computeFlag(
  a: ActivityState,
  byId: ReadonlyMap<string, ActivityState>,
  today: string,
): Flag | null {
  if (a.status === "BLOCKED") return "BLOCKED";
  if ((a.status === "DONE" || a.status === "VERIFIED") && a.evidenceCount === 0) return "NO EVIDENCE";
  if (!isDependencySatisfied(a, byId) && a.status !== "NOT STARTED") return "DEP PENDING";
  if (a.due && !isEffectivelyDone(a) && a.due < today) return "OVERDUE";
  return null;
}

export function indexById<T extends ActivityState>(list: readonly T[]): Map<string, T> {
  return new Map(list.map((a) => [a.id, a]));
}

export function evaluate<T extends ActivityState>(
  list: readonly T[],
  today: string,
): (T & EvaluatedActivity)[] {
  const byId = indexById(list);
  return list.map((a) => ({
    ...a,
    effectivelyDone: isEffectivelyDone(a),
    dependencySatisfied: isDependencySatisfied(a, byId),
    flag: computeFlag(a, byId, today),
  }));
}

export interface Ratio {
  done: number;
  total: number;
  /** 0..1, 0 when total = 0. */
  ratio: number;
}

const ratio = (done: number, total: number): Ratio => ({ done, total, ratio: total === 0 ? 0 : done / total });

export interface AreaSummary extends Ratio {
  area: Area;
  inProgress: number;
  blocked: number;
  gatePassed: boolean;
}

export interface PhaseGate {
  phase: string;
  activityIds: string[];
  openIds: string[];
  passed: boolean;
}

export interface Dashboard {
  overall: Ratio;
  byArea: AreaSummary[];
  byStatus: Record<Status, number>;
  flags: { id: string; flag: Flag }[];
  phaseGates: PhaseGate[];
  nextGate: PhaseGate | null;
}

/** Server-side dashboard. Mirrors the workbook Dashboard sheet (Done = DONE with evidence). */
export function computeDashboard(list: readonly ActivityState[], today: string): Dashboard {
  const ev = evaluate(list, today);

  const byArea: AreaSummary[] = AREAS.map((area) => {
    const items = ev.filter((a) => a.area === area);
    const done = items.filter((a) => a.effectivelyDone).length;
    return {
      area,
      ...ratio(done, items.length),
      inProgress: items.filter((a) => a.status === "IN PROGRESS").length,
      blocked: items.filter((a) => a.flag === "BLOCKED").length,
      gatePassed: items.length > 0 && done === items.length,
    };
  });

  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;
  for (const a of ev) byStatus[a.status] += 1;

  const phases = [...new Set(ev.map((a) => a.phase))].sort();
  const phaseGates: PhaseGate[] = phases.map((phase) => {
    const items = ev.filter((a) => a.phase === phase);
    const openIds = items.filter((a) => !a.effectivelyDone).map((a) => a.id);
    return { phase, activityIds: items.map((a) => a.id), openIds, passed: openIds.length === 0 };
  });

  return {
    overall: ratio(ev.filter((a) => a.effectivelyDone).length, ev.length),
    byArea,
    byStatus,
    flags: ev.flatMap((a) => (a.flag ? [{ id: a.id, flag: a.flag }] : [])),
    phaseGates,
    nextGate: phaseGates.find((g) => !g.passed) ?? null,
  };
}

/**
 * Policy "flag, do not reject" (mirrors the workbook; see decision log D-004).
 * Returns the warnings a status change would raise so the UI/API can show them.
 */
export function statusChangeWarnings(
  a: ActivityState,
  next: Status,
  byId: ReadonlyMap<string, ActivityState>,
): Flag[] {
  const after: ActivityState = { ...a, status: next };
  const warnings: Flag[] = [];
  if ((next === "DONE" || next === "VERIFIED") && a.evidenceCount === 0) warnings.push("NO EVIDENCE");
  if (next !== "NOT STARTED" && !isDependencySatisfied(after, byId)) warnings.push("DEP PENDING");
  return warnings;
}
