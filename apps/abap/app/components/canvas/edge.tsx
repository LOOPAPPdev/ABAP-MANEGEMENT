import type { Box, EdgeKind } from "~/domain/diagram";

/** Orthogonal-ish cubic path between two boxes (horizontal or vertical by relative position). */
export function edgePath(a: Box, b: Box): string {
  const ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
  const bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  const horizontal = Math.abs(bc.x - ac.x) >= Math.abs(bc.y - ac.y);
  if (horizontal) {
    const dir = bc.x >= ac.x ? 1 : -1;
    const sx = dir > 0 ? a.x + a.w : a.x;
    const tx = dir > 0 ? b.x : b.x + b.w;
    const mx = (sx + tx) / 2;
    return `M${sx},${ac.y} C${mx},${ac.y} ${mx},${bc.y} ${tx},${bc.y}`;
  }
  const dir = bc.y >= ac.y ? 1 : -1;
  const sy = dir > 0 ? a.y + a.h : a.y;
  const ty = dir > 0 ? b.y : b.y + b.h;
  // Compact org-chart children are stacked below the parent, indented by 24px: elbow from the parent's left edge.
  if (dir > 0 && Math.abs(b.x - (a.x + 24)) < 1) return `M${a.x + 12},${sy} L${a.x + 12},${bc.y} L${b.x},${bc.y}`;
  const my = (sy + ty) / 2;
  return `M${ac.x},${sy} C${ac.x},${my} ${bc.x},${my} ${bc.x},${ty}`;
}

const STYLE: Record<EdgeKind, { dash?: string; arrow: boolean; width: number; color: string }> = {
  flow: { arrow: true, width: 1.5, color: "var(--color-secondary-foreground)" },
  dependency: { arrow: true, width: 1.5, color: "var(--color-secondary-foreground)" },
  hierarchy: { arrow: false, width: 1, color: "var(--color-border)" },
  association: { dash: "4 4", arrow: false, width: 1, color: "var(--color-muted-foreground)" },
};

export function EdgeLine({ d, kind, highlighted, inferred, id }: { d: string; kind: EdgeKind; highlighted: boolean; inferred?: boolean; id: string }) {
  const s = STYLE[kind];
  return (
    <path
      d={d}
      data-edge-id={id}
      data-component-id="diagram-edge"
      fill="none"
      stroke={highlighted ? "var(--color-primary)" : s.color}
      strokeWidth={highlighted ? s.width + 1 : s.width}
      strokeDasharray={inferred ? "4 4" : s.dash}
      markerEnd={s.arrow ? (highlighted ? "url(#arrow-hl)" : "url(#arrow)") : undefined}
    />
  );
}

export function ArrowDefs() {
  return (
    <defs>
      {[
        ["arrow", "var(--color-secondary-foreground)"],
        ["arrow-hl", "var(--color-primary)"],
      ].map(([id, color]) => (
        <marker key={id} id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill={color} />
        </marker>
      ))}
    </defs>
  );
}
