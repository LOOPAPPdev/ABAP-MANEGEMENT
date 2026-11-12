import type { Flag, Status } from "~/domain/governance";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

/** Status colours from the workbook tokens status.* */
const statusClass: Record<Status, string> = {
  "NOT STARTED": "bg-muted text-muted-foreground",
  "IN PROGRESS": "bg-brand-tint text-brand-fg",
  PREPARED: "bg-brand-tint text-brand-fg",
  "IN REVIEW": "bg-brand-tint-2 text-brand-fg",
  APPROVED: "bg-brand-tint-2 text-brand-fg",
  VERIFIED: "bg-primary text-primary-foreground",
  DONE: "bg-foreground text-card",
  BLOCKED: "bg-destructive text-destructive-foreground",
};

export function StatusBadge({ status }: { status: Status }) {
  return <Badge className={statusClass[status]}>{status}</Badge>;
}

export function FlagBadge({ flag }: { flag: Flag | null }) {
  if (!flag) return null;
  return (
    <Badge className={cn("border border-destructive text-destructive", flag === "BLOCKED" && "bg-destructive text-destructive-foreground")}>
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
