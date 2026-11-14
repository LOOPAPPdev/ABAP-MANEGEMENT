/**
 * Project models → universal diagram graph (ADR-003), so every model opens in the Canvas views.
 * Pure. Visual attributes of the source (colours) are never read: the diagramming system decides the look.
 */
import type { DiagramEdge, DiagramNode, Graph } from "../diagram/model";
import { processOf } from "./diagnostic";
import type { DiagnosticSession, FlowModel, OrgModel } from "./schemas";

const NOT_VALIDATED = /n[ãa]o validad|rascunho|draft|por confirmar|inferid|validar/i;

/** Flow (FLW-xx): steps in phases and areas, decision gateway, documents linked when a step cites them. */
export function fromFlowModel(m: FlowModel, graphId = m.id): Graph {
  const lanes = [...new Set(m.steps.map((s) => s.area || "sem área"))];
  const phaseOf = (n: number) => m.phases.find((p) => n >= p.span[0] && n <= p.span[1])?.id;
  const nodes: DiagramNode[] = m.steps.map((s) => ({
    id: s.id,
    type: m.decision?.after === s.id ? "decision" : "process",
    label: s.title,
    subtitle: `Etapa ${s.number}`,
    lane: s.area || "sem área",
    group: s.phase ?? phaseOf(s.number),
    order: s.number,
    unvalidated: NOT_VALIDATED.test(`${s.detail} ${s.source}`),
    data: { owner: s.owner, output: s.output, detail: s.detail, source: s.source, area: s.area },
  }));
  for (const d of m.documents) nodes.push({ id: d.id, type: "document", label: d.name, subtitle: d.id, data: { handling: d.handling ?? "", source: d.source ?? "" } });

  const sorted = [...m.steps].sort((a, b) => a.number - b.number);
  const edges: DiagramEdge[] = [];
  sorted.slice(1).forEach((s, i) => edges.push({ id: `f:${sorted[i]!.id}>${s.id}`, from: sorted[i]!.id, to: s.id, kind: "flow" }));
  if (m.decision) {
    const dec = m.decision;
    const inferred = NOT_VALIDATED.test(dec.status);
    if (nodes.some((n) => n.id === dec.no) && !edges.some((e) => e.from === dec.after && e.to === dec.no))
      edges.push({ id: `f:${dec.after}>${dec.no}:no`, from: dec.after, to: dec.no, kind: "flow", inferred });
    const decisionNode = nodes.find((n) => n.id === dec.after);
    if (decisionNode) decisionNode.data = { ...decisionNode.data, question: dec.question, yes: dec.yes, no: dec.no, decisionStatus: dec.status };
  }
  for (const s of m.steps)
    for (const d of m.documents)
      if (new RegExp(`\\b${d.id}\\b`).test(`${s.title} ${s.detail} ${s.output}`))
        edges.push({ id: `a:${s.id}>${d.id}`, from: s.id, to: d.id, kind: "association", inferred: true });

  const groups = m.phases.map((p) => ({ id: p.id, label: `${p.id} · ${p.name}` }));
  return {
    id: graphId,
    title: `${m.id} · ${m.title}`,
    status: m.status,
    nodes,
    edges,
    lanes,
    groups,
    notes: [`${m.type} · ${m.status} · v${m.version}`, ...m.assumptions.map((a) => `Pressuposto: ${a}`), ...m.outstanding.map((o) => `Pendente: ${o}`)],
  };
}

/** Org chart (ORG-xx): company → governance people → departments → members. */
export function fromOrgModel(m: OrgModel, graphId = m.id): Graph {
  const root = `ORG:${m.id}`;
  const nodes: DiagramNode[] = [{ id: root, type: "group", label: m.company, subtitle: m.title, data: { departments: m.departments.length } }];
  const edges: DiagramEdge[] = [];
  const people = new Set<string>();
  for (const g of m.governance) {
    nodes.push({ id: g.id, type: "person", label: g.name, subtitle: g.role, data: { role: g.role, areas: g.areas.join(", "), scope: g.scope ?? "" } });
    people.add(g.id);
    edges.push({ id: `h:${root}>${g.id}`, from: root, to: g.id, kind: "hierarchy" });
  }
  for (const d of m.departments) {
    const unvalidated = !d.leader || NOT_VALIDATED.test(d.leader_status ?? "");
    nodes.push({ id: d.id, type: "group", label: d.name, subtitle: `${d.members.length} pessoas`, lane: d.name, unvalidated, data: { leader: d.leader ?? "por confirmar", leaderStatus: d.leader_status ?? "", activities: d.activities.join(" · ") } });
    const parent = d.leader && people.has(d.leader) ? d.leader : root;
    edges.push({ id: `h:${parent}>${d.id}`, from: parent, to: d.id, kind: "hierarchy", ...(d.leader ? {} : { inferred: true }) });
    for (const p of d.members) {
      if (people.has(p.id)) continue;
      people.add(p.id);
      nodes.push({ id: p.id, type: "person", label: p.name, subtitle: p.role, lane: d.name, data: { role: p.role, source: p.source ?? "" } });
      edges.push({ id: `h:${d.id}>${p.id}`, from: d.id, to: p.id, kind: "hierarchy" });
    }
  }
  return {
    id: graphId,
    title: `${m.id} · ${m.title}`,
    status: m.status,
    nodes,
    edges,
    lanes: m.departments.map((d) => d.name),
    groups: [],
    notes: [`${m.type} · ${m.status} · v${m.version}`, ...m.external_parties.map((e) => `Parte externa: ${e}`), ...m.notes],
  };
}

/** Diagnostic session: its AS-IS process (stored or derived from the answers). */
export function fromDiagnostic(s: DiagnosticSession, graphId: string, title: string): Graph {
  const p = processOf(s);
  const actors = [...new Set(p.nodes.map((n) => n.actor ?? "").filter(Boolean))];
  const lanes = actors.length > 0 ? [...actors, "—"] : [];
  let order = 0;
  const nodes: DiagramNode[] = p.nodes.map((n) => ({
    id: n.id,
    type: n.type === "task" ? "process" : n.type,
    label: n.label,
    ...(n.actor ? { subtitle: n.actor } : {}),
    ...(lanes.length ? { lane: n.actor ?? "—" } : {}),
    ...(n.type === "task" || n.type === "decision" ? { order: ++order } : {}),
    unvalidated: n.verification !== "confirmed",
    data: { actor: n.actor ?? "", verification: n.verification ?? "unverified", origin: n.origin ?? "", source: n.source_ref ?? "" },
  }));
  const ids = new Set(nodes.map((n) => n.id));
  const edges: DiagramEdge[] = p.edges.filter((e) => ids.has(e.source) && ids.has(e.target)).map((e) => ({ id: e.id, from: e.source, to: e.target, kind: "flow" }));
  return {
    id: graphId,
    title,
    status: p.status,
    nodes,
    edges,
    lanes,
    groups: [],
    notes: [`Diagnóstico ${s.organization.name} · ${p.status}`, ...p.risks.map((r) => `Risco: ${r}`)],
  };
}
