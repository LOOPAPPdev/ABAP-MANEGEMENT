import type { Flag, Status } from "~/domain/governance";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

/**
 * Status colours from the ABAP design system (ADR-007, bundle tokens). The status is always written,
 * so colour only reinforces it: neutral outline → selection blue → warning amber → stronger blue →
 * solid black (done with evidence) → accessible red (blocked).
 */
const statusClass: Record<Status, string> = {
  "NOT STARTED": "border border-border bg-card text-muted-foreground",
  "IN PROGRESS": "bg-sel text-foreground",
  PREPARED: "bg-sel text-foreground",
  "IN REVIEW": "border border-warn-border bg-warn text-warn-foreground",
  APPROVED: "border border-warn-border bg-warn text-warn-foreground",
  VERIFIED: "bg-sel-border text-foreground",
  DONE: "bg-primary text-primary-foreground",
  BLOCKED: "bg-destructive-strong text-destructive-foreground",
};

export function StatusBadge({ status }: { status: Status }) {
  return <Badge className={statusClass[status]}>{status}</Badge>;
}

export function FlagBadge({ flag }: { flag: Flag | null }) {
  if (!flag) return null;
  return (
    <Badge className={cn("border border-destructive text-destructive-strong", flag === "BLOCKED" && "bg-destructive-strong text-destructive-foreground")}>
      <span aria-hidden="true">⚑&nbsp;</span>
      {flag}
    </Badge>
  );
}

export function ProgressBar({ ratio, label }: { ratio: number; label: string }) {
  const value = Math.round(ratio * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-2 w-full overflow-hidden rounded bg-accent"
    >
      <div className="h-full bg-primary" style={{ width: `${value}%` }} />
    </div>
  );
}
