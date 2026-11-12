/**
 * Governance vocabulary. Values are copied verbatim from the workbook
 * (DATA_Lists). Order matters: it is the display order.
 */
export const STATUSES = [
  "NOT STARTED",
  "IN PROGRESS",
  "BLOCKED",
  "PREPARED",
  "IN REVIEW",
  "APPROVED",
  "VERIFIED",
  "DONE",
] as const;
export type Status = (typeof STATUSES)[number];

export const PRIORITIES = ["Critical", "High", "Medium", "Low"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const AREAS = [
  "Product",
  "Design",
  "Engineering",
  "Documentation",
  "QA & Security",
  "Deployment",
] as const;
export type Area = (typeof AREAS)[number];

/** Flags in workbook precedence order (DATA_Activities!U). */
export const FLAGS = ["BLOCKED", "NO EVIDENCE", "DEP PENDING", "OVERDUE"] as const;
export type Flag = (typeof FLAGS)[number];

export const EVIDENCE_KINDS = ["link", "commit", "file", "text"] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

/** Minimal state the rules need. Persistence adapters map rows to this shape. */
export interface ActivityState {
  id: string;
  phase: string;
  area: Area;
  status: Status;
  dependencyId: string | null;
  /** ISO date YYYY-MM-DD or null. */
  due: string | null;
  /** Number of stored (validated) evidence records. */
  evidenceCount: number;
}

export interface EvaluatedActivity extends ActivityState {
  effectivelyDone: boolean;
  dependencySatisfied: boolean;
  flag: Flag | null;
}
