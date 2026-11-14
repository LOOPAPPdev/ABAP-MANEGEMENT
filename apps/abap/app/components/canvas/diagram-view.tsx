import type { Graph, Projection } from "~/domain/diagram";
import { ArrowDefs, EdgeLine, edgePath } from "./edge";
import { NodeShape } from "./node";

interface Props {
  graph: Graph;
  projection: Projection;
  selectedId: string | null;
  highlight: { lane?: string; group?: string };
  zoom: number;
  onSelect: (id: string) => void;
}

/** SVG renderer for every spatial view (infographic, BPMN, org chart, complex). */
export function DiagramView({ graph, projection: p, selectedId, highlight, zoom, onSelect }: Props) {
  const nodes = graph.nodes.filter((n) => n.id in p.placements);
  const edges = graph.edges.filter((e) => p.edgeIds.includes(e.id));
  const dim = (n: (typeof nodes)[number]) =>
    (highlight.lane !== undefined && n.lane !== highlight.lane) || (highlight.group !== undefined && n.group !== highlight.group);
  const eventBoxes = Object.fromEntries(p.decorations.filter((d) => d.kind === "start" || d.kind === "end").map((d) => [d.id, d]));
  const boxOf = (id: string) => p.placements[id] ?? eventBoxes[id];

  return (
    <svg
      role="group"
      aria-label={`Diagrama: ${graph.title}`}
      width={p.width * zoom}
      height={p.height * zoom}
      viewBox={`0 0 ${p.width} ${p.height}`}
      className="block"
    >
      <ArrowDefs />
      {p.decorations.map((d) => {
        if (d.kind === "lane")
          return (
            <g key={d.id} data-component-id="lane-band">
              <rect x={d.x} y={d.y} width={d.w} height={d.h} fill="none" stroke="var(--color-border)" />
              <rect x={d.x} y={d.y} width={124} height={d.h} fill="var(--color-muted)" stroke="var(--color-border)" />
              <foreignObject x={d.x + 8} y={d.y + 8} width={110} height={d.h - 16}>
                <div className="text-[12px] font-semibold text-secondary-foreground">{d.label}</div>
              </foreignObject>
            </g>
          );
        if (d.kind === "frame")
          return (
            <g key={d.id} data-component-id="phase-frame">
              <rect x={d.x} y={d.y} width={d.w} height={d.h} rx={4} fill="var(--color-muted)" opacity={0.6} />
              <text x={d.x + 10} y={d.y + 20} fontSize={12} fontWeight={700} fill="var(--color-foreground)">
                {d.label.length > 28 ? d.label.slice(0, 27) + "…" : d.label}
              </text>
              {d.detail && (
                <text x={d.x + 10} y={d.y + 36} fontSize={11} fill="var(--color-secondary-foreground)">
                  {d.detail}
                </text>
              )}
            </g>
          );
        return (
          <g key={d.id} data-component-id="bpmn-event" aria-label={d.label}>
            <rect x={d.x} y={d.y} width={d.w} height={d.h} rx={4} fill="var(--color-card)" stroke="var(--color-foreground)" strokeWidth={d.kind === "end" ? 3 : 1.5} />
            <text x={d.x + d.w / 2} y={d.y + d.h / 2 + 4} fontSize={10} fontWeight={700} textAnchor="middle" fill="var(--color-foreground)">
              {d.kind === "start" ? "INÍCIO" : "FIM"}
            </text>
          </g>
        );
      })}
      {p.eventLinks.map((l) => {
        const a = boxOf(l.from);
        const b = boxOf(l.to);
        return a && b ? <EdgeLine key={`${l.from}>${l.to}`} id={`event:${l.from}>${l.to}`} d={edgePath(a, b)} kind="flow" highlighted={false} /> : null;
      })}
      {edges.map((e) => (
        <EdgeLine
          key={e.id}
          id={e.id}
          d={edgePath(p.placements[e.from]!, p.placements[e.to]!)}
          kind={e.kind}
          inferred={e.inferred}
          highlighted={selectedId !== null && (e.from === selectedId || e.to === selectedId)}
        />
      ))}
      {nodes.map((n) => (
        <NodeShape key={n.id} node={n} box={p.placements[n.id]!} selected={n.id === selectedId} dimmed={dim(n)} onSelect={onSelect} />
      ))}
    </svg>
  );
}
