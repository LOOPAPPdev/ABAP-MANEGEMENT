/**
 * View projectors (ADR-003 "View Toggle"). Each projector receives the SAME graph and
 * returns a layout. Projectors never copy or change node data, so switching views
 * keeps IDs, entities and relationships (acceptance criterion D of ADR-003).
 *
 * Invariant (tested): placed ∪ hidden = all node IDs, and every shown edge exists in the graph.
 */
import { isStep, VIEW_LABELS, type DiagramNode, type EdgeKind, type Graph, type ViewId } from "./model";

export const NODE_W = 184;
export const NODE_H = 80;
const GAP_X = 48;
const GAP_Y = 24;
const PAD = 32;
const HEADER = 40;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Decoration extends Box {
  id: string;
  kind: "lane" | "frame" | "start" | "end";
  label: string;
  /** Extra text, e.g. progress of a frame. */
  detail?: string;
}

export interface Projection {
  view: ViewId;
  placements: Record<string, Box>;
  hiddenIds: string[];
  edgeIds: string[];
  decorations: Decoration[];
  /** Synthetic BPMN links from the start event / to the end event (not graph edges). */
  eventLinks: { from: string; to: string }[];
  /** Ordered node IDs for sequential views (tutorial). */
  sequence: string[];
  width: number;
  height: number;
  warnings: string[];
}

const byOrder = (a: DiagramNode, b: DiagramNode) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id);

function finish(
  g: Graph,
  view: ViewId,
  placements: Record<string, Box>,
  kinds: EdgeKind[],
  rest: Partial<Projection> = {},
): Projection {
  const hiddenIds = g.nodes.filter((n) => !(n.id in placements) && !(rest.sequence ?? []).includes(n.id)).map((n) => n.id);
  const shown = new Set(g.nodes.map((n) => n.id).filter((id) => !hiddenIds.includes(id)));
  const edgeIds = g.edges.filter((e) => kinds.includes(e.kind) && shown.has(e.from) && shown.has(e.to)).map((e) => e.id);
  const boxes = [...Object.values(placements), ...(rest.decorations ?? [])];
  const width = Math.max(0, ...boxes.map((b) => b.x + b.w)) + PAD;
  const height = Math.max(0, ...boxes.map((b) => b.y + b.h)) + PAD;
  const warnings = [...(rest.warnings ?? [])];
  if (hiddenIds.length > 0) {
    const types = [...new Set(g.nodes.filter((n) => hiddenIds.includes(n.id)).map((n) => n.type))];
    warnings.push(
      `${hiddenIds.length} elemento(s) (${types.join(", ")}) não pertencem à visão ${VIEW_LABELS[view]}. Continuam no modelo: veja o Diagrama complexo.`,
    );
  }
  return { view, placements, hiddenIds, edgeIds, decorations: [], eventLinks: [], sequence: [], width, height, ...rest, warnings };
}

/** All nodes: groups and people on the left, one column per phase, documents on the right. */
function complex(g: Graph): Projection {
  const placements: Record<string, Box> = {};
  const decorations: Decoration[] = [];
  let x = PAD;
  const column = (nodes: DiagramNode[], label?: string, id?: string) => {
    if (nodes.length === 0) return;
    const top = PAD + (label ? HEADER : 0);
    nodes.forEach((n, i) => (placements[n.id] = { x, y: top + i * (NODE_H + GAP_Y), w: NODE_W, h: NODE_H }));
    if (label && id) {
      decorations.push({ id: `frame:${id}`, kind: "frame", label, x: x - 8, y: PAD - 8, w: NODE_W + 16, h: HEADER + nodes.length * (NODE_H + GAP_Y) });
    }
    x += NODE_W + GAP_X;
  };
  column(g.nodes.filter((n) => n.type === "group"), "Estrutura", "structure");
  column(g.nodes.filter((n) => n.type === "person"), "Pessoas", "people");
  for (const gr of g.groups) column(g.nodes.filter((n) => isStep(n) && n.group === gr.id).sort(byOrder), gr.label, gr.id);
  column(g.nodes.filter((n) => isStep(n) && !n.group).sort(byOrder), "Sem fase", "nogroup");
  column(g.nodes.filter((n) => n.type === "document"), "Documentos", "documents");
  column(g.nodes.filter((n) => n.type === "start" || n.type === "end"), "Eventos", "events");
  return finish(g, "complex", placements, ["flow", "dependency", "hierarchy", "association"], { decorations });
}

/** Lanes = responsibility; columns = sequence rank. Start and end events are decorations. */
function bpmn(g: Graph): Projection {
  const steps = g.nodes.filter(isStep).sort(byOrder);
  if (g.lanes.length === 0 || steps.length === 0) {
    return { ...complex(g), view: "bpmn", warnings: ["O conjunto de dados não tem raias ou etapas: mostrando o Diagrama complexo como alternativa."] };
  }
  // Columns = phases when every step has one (compact, like the source prototype); otherwise the sequence order.
  const byPhase = g.groups.length > 0 && steps.every((s) => g.groups.some((gr) => gr.id === s.group));
  const rankOf = (s: DiagramNode) => (byPhase ? g.groups.findIndex((gr) => gr.id === s.group) : (s.order ?? 0));
  const ranks = [...new Set(steps.map(rankOf))].sort((a, b) => a - b);
  const LANE_LABEL = 132;
  const colX = (rank: number) => PAD + LANE_LABEL + NODE_W * 0.6 + GAP_X + ranks.indexOf(rank) * (NODE_W + GAP_X);
  const placements: Record<string, Box> = {};
  const decorations: Decoration[] = [];
  let y = PAD;
  for (const lane of g.lanes) {
    const inLane = steps.filter((s) => s.lane === lane);
    const stackDepth = Math.max(1, ...ranks.map((r) => inLane.filter((s) => rankOf(s) === r).length));
    const laneH = stackDepth * (NODE_H + GAP_Y) + GAP_Y;
    for (const r of ranks) {
      inLane.filter((s) => rankOf(s) === r).forEach((s, i) => {
        placements[s.id] = { x: colX(r), y: y + GAP_Y + i * (NODE_H + GAP_Y), w: NODE_W, h: NODE_H };
      });
    }
    decorations.push({ id: `lane:${lane}`, kind: "lane", label: lane, x: PAD, y, w: 0, h: laneH });
    y += laneH;
  }
  const lastX = colX(ranks[ranks.length - 1]!) + NODE_W + GAP_X;
  if (byPhase) {
    // Phase headers above the lanes; lanes shift down by the header height.
    for (const b of [...Object.values(placements), ...decorations]) b.y += HEADER;
    for (const r of ranks)
      decorations.push({ id: `col:${g.groups[r]!.id}`, kind: "frame", label: g.groups[r]!.label, x: colX(r) - 8, y: PAD - 8, w: NODE_W + 16, h: HEADER - 8 });
  }
  for (const d of decorations) if (d.kind === "lane") d.w = lastX + NODE_W * 0.6 - PAD;
  const stepIds = new Set(steps.map((s) => s.id));
  const seq = g.edges.filter((e) => (e.kind === "flow" || e.kind === "dependency") && stepIds.has(e.from) && stepIds.has(e.to));
  const entries = steps.filter((s) => !seq.some((e) => e.to === s.id));
  const exits = steps.filter((s) => !seq.some((e) => e.from === s.id));
  const ev = NODE_H * 0.6;
  const first = placements[entries[0]!.id]!;
  const last = placements[exits[exits.length - 1]!.id]!;
  decorations.push({ id: "event:start", kind: "start", label: "Início", x: PAD + LANE_LABEL, y: first.y + (NODE_H - ev) / 2, w: ev, h: ev });
  decorations.push({ id: "event:end", kind: "end", label: "Fim", x: lastX, y: last.y + (NODE_H - ev) / 2, w: ev, h: ev });
  const eventLinks = [
    ...entries.map((s) => ({ from: "event:start", to: s.id })),
    ...exits.map((s) => ({ from: s.id, to: "event:end" })),
  ];
  return finish(g, "bpmn", placements, ["flow", "dependency"], { decorations, eventLinks });
}

/** Top-down hierarchy. A parent whose children are all leaves stacks them vertically (compact). */
function orgchart(g: Graph): Projection {
  const h = g.edges.filter((e) => e.kind === "hierarchy");
  const children = (id: string) => h.filter((e) => e.from === id).map((e) => e.to);
  const inTree = new Set(h.flatMap((e) => [e.from, e.to]));
  if (inTree.size === 0) {
    return { ...complex(g), view: "orgchart", warnings: ["O conjunto de dados não tem relações de hierarquia: mostrando o Diagrama complexo como alternativa."] };
  }
  const roots = g.nodes.filter((n) => inTree.has(n.id) && !h.some((e) => e.to === n.id)).map((n) => n.id);
  const INDENT = 24;
  const widthOf = (id: string): number => {
    const c = children(id);
    if (c.length === 0) return NODE_W;
    if (c.every((k) => children(k).length === 0)) return NODE_W + INDENT;
    return Math.max(NODE_W, c.reduce((s, k) => s + widthOf(k), 0) + GAP_X * (c.length - 1));
  };
  const placements: Record<string, Box> = {};
  const place = (id: string, x: number, y: number) => {
    const w = widthOf(id);
    placements[id] = { x: x + (w - NODE_W) / 2, y, w: NODE_W, h: NODE_H };
    const c = children(id);
    if (c.length === 0) return;
    if (c.every((k) => children(k).length === 0)) {
      placements[id]!.x = x;
      c.forEach((k, i) => (placements[k] = { x: x + INDENT, y: y + (i + 1) * (NODE_H + GAP_Y), w: NODE_W, h: NODE_H }));
      return;
    }
    let cx = x;
    for (const k of c) {
      place(k, cx, y + NODE_H + GAP_Y * 2);
      cx += widthOf(k) + GAP_X;
    }
  };
  let x = PAD;
  for (const r of roots) {
    place(r, x, PAD);
    x += widthOf(r) + GAP_X;
  }
  const warnings = g.nodes.some((n) => n.type === "person")
    ? []
    : ["Sem dados de pessoas (Owner = A DEFINIR). Organograma alternativo: Projeto → Área → Atividade."];
  return finish(g, "orgchart", placements, ["hierarchy"], { warnings });
}

/** Cards grouped in at most 7 columns: phases, or lanes when there are too many phases. */
function infographic(g: Graph): Projection {
  const steps = g.nodes.filter(isStep).sort(byOrder);
  const usePhases = g.groups.length > 0 && g.groups.length <= 7;
  const buckets = usePhases
    ? g.groups.map((gr) => ({ id: gr.id, label: gr.label, nodes: steps.filter((s) => s.group === gr.id) }))
    : g.lanes.map((l) => ({ id: l, label: l, nodes: steps.filter((s) => s.lane === l) }));
  const placements: Record<string, Box> = {};
  const decorations: Decoration[] = [];
  buckets.forEach((b, i) => {
    const x = PAD + i * (NODE_W + GAP_X);
    b.nodes.forEach((n, j) => (placements[n.id] = { x, y: PAD + HEADER + 8 + j * (NODE_H + GAP_Y), w: NODE_W, h: NODE_H }));
    const done = b.nodes.filter((n) => n.done).length;
    const gaps = b.nodes.filter((n) => n.unvalidated).length;
    const detail = b.nodes.some((n) => n.done !== undefined)
      ? `${done}/${b.nodes.length} concluídas`
      : `${b.nodes.length} etapas${gaps ? ` · ${gaps} lacuna(s)` : ""}`;
    decorations.push({ id: `frame:${b.id}`, kind: "frame", label: `${String(i + 1).padStart(2, "0")} · ${b.label}`, detail, x: x - 8, y: PAD - 8, w: NODE_W + 16, h: HEADER + 16 + Math.max(1, b.nodes.length) * (NODE_H + GAP_Y) });
  });
  const warnings = usePhases ? [] : [`${g.groups.length} fases excedem 7 colunas: o infográfico agrupa por área/raia.`];
  return finish(g, "infographic", placements, [], { decorations, warnings });
}

/** Ordered steps for the guided tutorial (stepper). No spatial layout. */
function tutorial(g: Graph): Projection {
  const sequence = g.nodes.filter(isStep).sort(byOrder).map((n) => n.id);
  return finish(g, "tutorial", {}, ["flow", "dependency"], { sequence });
}

const PROJECTORS: Record<ViewId, (g: Graph) => Projection> = { infographic, tutorial, bpmn, orgchart, complex };

export function project(g: Graph, view: ViewId): Projection {
  return PROJECTORS[view](g);
}
