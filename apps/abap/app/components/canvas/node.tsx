import { CircleDot, FileText, GitFork, Square, User, Users, CircleStop } from "lucide-react";
import type { Box, DiagramNode, NodeType } from "~/domain/diagram";

export const TYPE_META: Record<NodeType, { label: string; Icon: typeof Square }> = {
  start: { label: "INÍCIO", Icon: CircleDot },
  end: { label: "FIM", Icon: CircleStop },
  process: { label: "ATIVIDADE", Icon: Square },
  decision: { label: "DECISÃO", Icon: GitFork },
  document: { label: "DOCUMENTO", Icon: FileText },
  person: { label: "PESSOA", Icon: User },
  group: { label: "GRUPO", Icon: Users },
};

/** Left stripe colour from the ABAP design system status mapping (badges.tsx). */
const STRIPE: Record<string, string> = {
  "NOT STARTED": "var(--color-border)",
  "IN PROGRESS": "var(--color-sel-border)",
  PREPARED: "var(--color-sel-border)",
  "IN REVIEW": "var(--color-warn-foreground)",
  APPROVED: "var(--color-warn-foreground)",
  VERIFIED: "var(--color-muted-foreground)",
  DONE: "var(--color-primary)",
  BLOCKED: "var(--color-destructive-strong)",
};

/** camelCase data key → readable label (e.g. effectivelyDone → effectively done). */
export const humanize = (k: string) => k.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();

const truncate = (t: string, n: number) => (t.length > n ? t.slice(0, n - 1) + "…" : t);

interface Props {
  node: DiagramNode;
  box: Box;
  selected: boolean;
  dimmed: boolean;
  onSelect: (id: string) => void;
}

/**
 * Diagram node (registry: diagram-node). Same square geometry for every type;
 * the type is named by label + icon, the validation state by a dashed border.
 */
export function NodeShape({ node, box, selected, dimmed, onSelect }: Props) {
  const { label: typeLabel, Icon } = TYPE_META[node.type];
  const footer = [
    node.status,
    node.flag ? `⚑ ${node.flag}` : null,
    node.unvalidated ? "Lacuna / não validado" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <g
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${typeLabel}: ${node.subtitle ? node.subtitle + " — " : ""}${node.label}${footer ? ". " + footer : ""}`}
      data-node-id={node.id}
      data-component-id="diagram-node"
      transform={`translate(${box.x},${box.y})`}
      opacity={dimmed ? 0.3 : 1}
      className="cursor-pointer focus:outline-none [&:focus-visible>rect.frame]:stroke-[var(--color-ring)] [&:focus-visible>rect.frame]:[stroke-width:3]"
      onClick={() => onSelect(node.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(node.id);
        }
      }}
    >
      <rect
        className="frame"
        width={box.w}
        height={box.h}
        rx={4}
        fill="var(--color-card)"
        stroke={selected ? "var(--color-primary)" : node.flag === "BLOCKED" ? "var(--color-destructive-strong)" : "var(--color-border)"}
        strokeWidth={selected ? 2.5 : 1}
        strokeDasharray={node.unvalidated ? "6 4" : undefined}
      />
      {node.status && <rect width={5} height={box.h} rx={2} fill={STRIPE[node.status] ?? "var(--color-border)"} />}
      <Icon x={12} y={9} width={14} height={14} aria-hidden="true" color="var(--color-secondary-foreground)" />
      <text x={30} y={20} fontSize={10} fontWeight={700} letterSpacing={0.6} fill="var(--color-secondary-foreground)">
        {truncate(`${typeLabel}${node.subtitle ? ` · ${node.subtitle}` : ""}`, 26)}
      </text>
      <foreignObject x={12} y={26} width={box.w - 20} height={34}>
        <div className="line-clamp-2 text-[12px] leading-[15px] font-semibold text-foreground">{node.label}</div>
      </foreignObject>
      {footer && (
        <text x={12} y={box.h - 9} fontSize={10} fill={node.flag ? "var(--color-destructive-strong)" : "var(--color-muted-foreground)"}>
          {truncate(footer, 34)}
        </text>
      )}
    </g>
  );
}
