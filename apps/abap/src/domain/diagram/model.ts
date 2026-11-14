/**
 * Universal diagram model (ADR-003). One graph, many views.
 * Pure TypeScript: no React, no persistence.
 *
 * Diagramming system (docs/design/diagramming-system.md): every node is drawn
 * with the same square geometry; the type is shown by label + icon + border,
 * never by shape or colour alone.
 */
export const NODE_TYPES = ["start", "end", "process", "decision", "document", "person", "group"] as const;
export type NodeType = (typeof NODE_TYPES)[number];

export const EDGE_KINDS = ["flow", "dependency", "hierarchy", "association"] as const;
export type EdgeKind = (typeof EDGE_KINDS)[number];

export const VIEWS = ["infographic", "tutorial", "bpmn", "orgchart", "complex"] as const;
export type ViewId = (typeof VIEWS)[number];

export const VIEW_LABELS: Record<ViewId, string> = {
  infographic: "Infográfico",
  tutorial: "Tutorial",
  bpmn: "BPMN",
  orgchart: "Organograma",
  complex: "Diagrama complexo",
};

export type DataValue = string | number | boolean | null;

export interface DiagramNode {
  id: string;
  type: NodeType;
  label: string;
  subtitle?: string;
  /** Responsibility lane (BPMN). */
  lane?: string;
  /** Phase / stage group id. */
  group?: string;
  /** Position in the process sequence (process and decision nodes). */
  order?: number;
  status?: string;
  flag?: string | null;
  /** 0..1 completion, when the dataset has one. */
  done?: boolean;
  /** True when the source marks the item as a gap or not validated. Drawn with a dashed border. */
  unvalidated?: boolean;
  /** Link to the editable record, if any. */
  href?: string;
  data: Record<string, DataValue>;
}

export interface DiagramEdge {
  id: string;
  from: string;
  to: string;
  kind: EdgeKind;
  /** Inferred from free text rather than stated in the source. */
  inferred?: boolean;
}

export interface DiagramGroup {
  id: string;
  label: string;
}

export interface Graph {
  id: string;
  title: string;
  /** Source status, e.g. "operacional" or "não validado". */
  status: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  lanes: string[];
  groups: DiagramGroup[];
  /** Dataset-level notes shown in every view. */
  notes: string[];
}

export const isStep = (n: DiagramNode) => n.type === "process" || n.type === "decision";

/** Validates referential integrity. Returns a list of problems (empty = valid). */
export function validateGraph(g: Graph): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const n of g.nodes) {
    if (ids.has(n.id)) problems.push(`duplicate node ${n.id}`);
    ids.add(n.id);
    if (n.group && !g.groups.some((gr) => gr.id === n.group)) problems.push(`${n.id}: unknown group ${n.group}`);
    if (n.lane && !g.lanes.includes(n.lane)) problems.push(`${n.id}: unknown lane ${n.lane}`);
  }
  const edgeIds = new Set<string>();
  for (const e of g.edges) {
    if (edgeIds.has(e.id)) problems.push(`duplicate edge ${e.id}`);
    edgeIds.add(e.id);
    if (!ids.has(e.from)) problems.push(`${e.id}: unknown source ${e.from}`);
    if (!ids.has(e.to)) problems.push(`${e.id}: unknown target ${e.to}`);
  }
  return problems;
}

export function neighbours(g: Graph, id: string) {
  return {
    incoming: g.edges.filter((e) => e.to === id),
    outgoing: g.edges.filter((e) => e.from === id),
  };
}
