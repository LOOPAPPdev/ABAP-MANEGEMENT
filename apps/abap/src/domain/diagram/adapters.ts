import type { EvaluatedActivity } from "../governance";
import type { DiagramEdge, DiagramNode, Graph } from "./model";

/** Minimum activity shape the adapter needs (evaluated governance activity + text fields). */
export type GovernanceActivityInput = EvaluatedActivity & {
  title: string;
  acceptance: string;
  deliverable: string;
  owner: string;
  priority: string;
};

const areaNodeId = (area: string) => `AREA:${area}`;
export const GOVERNANCE_ROOT = "PROJECT";

/**
 * Governance → graph.
 * Nodes: one per ACT-xx (process), one per area (group) and the project root (group).
 * Edges: predecessor → dependent (dependency), project → area → activity (hierarchy).
 */
export function fromGovernance(activities: readonly GovernanceActivityInput[], projectName: string): Graph {
  const phases = [...new Set(activities.map((a) => a.phase))].sort();
  const areas = [...new Set(activities.map((a) => a.area))];

  const nodes: DiagramNode[] = [
    { id: GOVERNANCE_ROOT, type: "group", label: projectName, subtitle: "Projeto", data: { activities: activities.length } },
    ...areas.map<DiagramNode>((area) => ({
      id: areaNodeId(area),
      type: "group",
      label: area,
      subtitle: "Área",
      lane: area,
      data: {
        activities: activities.filter((a) => a.area === area).length,
        done: activities.filter((a) => a.area === area && a.effectivelyDone).length,
        owner: "A DEFINIR",
      },
    })),
    ...activities.map<DiagramNode>((a) => ({
      id: a.id,
      type: "process",
      label: a.title,
      subtitle: a.id,
      lane: a.area,
      group: a.phase,
      order: Number.parseInt(a.phase.slice(0, 2), 10),
      status: a.status,
      flag: a.flag,
      done: a.effectivelyDone,
      href: `/activities/${a.id}`,
      data: {
        phase: a.phase,
        area: a.area,
        status: a.status,
        flag: a.flag,
        evidence: a.evidenceCount,
        effectivelyDone: a.effectivelyDone,
        dependency: a.dependencyId,
        dependencySatisfied: a.dependencySatisfied,
        owner: a.owner,
        priority: a.priority,
        deliverable: a.deliverable,
        acceptance: a.acceptance,
      },
    })),
  ];

  const edges: DiagramEdge[] = [
    ...areas.map<DiagramEdge>((area) => ({ id: `h:${GOVERNANCE_ROOT}>${area}`, from: GOVERNANCE_ROOT, to: areaNodeId(area), kind: "hierarchy" })),
    ...activities.map<DiagramEdge>((a) => ({ id: `h:${a.area}>${a.id}`, from: areaNodeId(a.area), to: a.id, kind: "hierarchy" })),
    ...activities
      .filter((a) => a.dependencyId)
      .map<DiagramEdge>((a) => ({ id: `d:${a.dependencyId}>${a.id}`, from: a.dependencyId!, to: a.id, kind: "dependency" })),
  ];

  return {
    id: "governance",
    title: projectName,
    status: "operacional",
    nodes,
    edges,
    lanes: areas,
    groups: phases.map((p) => ({ id: p, label: p })),
    notes: ["Dados operacionais do D1. Progresso = DONE com evidência."],
  };
}

/** Shape of data/reference/cleansea.v1.json (validated in src/domain/diagram/cleansea.ts). */
export interface CleanSeaModel {
  status: string;
  note: string;
  metadata: { name: string; version: string };
  people: {
    founders: { name: string; roles: string[] }[];
    sales: string[];
    operations: { name: string; role: string }[];
    drivers: string[];
  };
  phases: { id: string; title: string; short: string; range: [number, number] }[];
  steps: { id: number; phase: string; task: string; owner: string; channel: string; control: string; lane: string; gap?: boolean }[];
  documents: { id: string; title: string; method: string }[];
  unresolved: string[];
}

const stepId = (n: number) => `S${String(n).padStart(2, "0")}`;
const personId = (name: string) => `P:${name}`;

/**
 * CleanSea → graph. Data is NOT validated (see fixture note).
 * Owner and document links are inferred from free text and flagged `inferred`.
 */
export function fromCleanSea(m: CleanSeaModel): Graph {
  const [felipe, cecilia] = m.people.founders;
  const teams = [
    { id: "T:vendas", label: "Equipe de vendas", lead: cecilia?.name, members: m.people.sales.map((n) => ({ name: n, role: "Comercial" })) },
    { id: "T:operacao", label: "Equipe operacional", lead: felipe?.name, members: m.people.operations.map((p) => ({ name: p.name, role: p.role })) },
    { id: "T:transporte", label: "Equipe de transporte", lead: felipe?.name, members: m.people.drivers.map((n) => ({ name: n, role: "Motorista" })) },
  ];
  const people = [
    ...m.people.founders.map((f) => ({ name: f.name, role: f.roles.slice(0, 2).join(" · "), team: undefined as string | undefined })),
    ...teams.flatMap((t) => t.members.map((p) => ({ ...p, team: t.id }))),
  ];

  const lanes = [...new Set(m.steps.map((s) => s.lane))];
  const nodes: DiagramNode[] = [
    ...m.steps.map<DiagramNode>((s) => ({
      id: stepId(s.id),
      type: /gateway|liberação/i.test(s.control) ? "decision" : "process",
      label: s.task,
      subtitle: `Etapa ${s.id}`,
      lane: s.lane,
      group: s.phase,
      order: s.id,
      unvalidated: Boolean(s.gap),
      data: { phase: s.phase, owner: s.owner, channel: s.channel, control: s.control, gap: Boolean(s.gap) },
    })),
    ...m.documents.map<DiagramNode>((d) => ({
      id: d.id,
      type: "document",
      label: d.title,
      subtitle: d.id,
      data: { method: d.method },
    })),
    ...teams.map<DiagramNode>((t) => ({ id: t.id, type: "group", label: t.label, subtitle: `${t.members.length} pessoas`, data: { lead: t.lead ?? null } })),
    ...people.map<DiagramNode>((p) => ({ id: personId(p.name), type: "person", label: p.name, subtitle: p.role, data: { role: p.role } })),
  ];

  const edges: DiagramEdge[] = [];
  const sorted = [...m.steps].sort((a, b) => a.id - b.id);
  sorted.slice(1).forEach((s, i) => edges.push({ id: `f:${sorted[i]!.id}>${s.id}`, from: stepId(sorted[i]!.id), to: stepId(s.id), kind: "flow" }));
  for (const t of teams) {
    if (t.lead) edges.push({ id: `h:${t.lead}>${t.id}`, from: personId(t.lead), to: t.id, kind: "hierarchy" });
    for (const p of t.members) edges.push({ id: `h:${t.id}>${p.name}`, from: t.id, to: personId(p.name), kind: "hierarchy" });
  }
  for (const s of m.steps) {
    for (const p of people) {
      if (new RegExp(`\\b${p.name}\\b`).test(s.owner) || new RegExp(`^${p.name}\\b`).test(s.task))
        edges.push({ id: `a:${p.name}>${s.id}`, from: personId(p.name), to: stepId(s.id), kind: "association", inferred: true });
    }
    for (const d of m.documents) {
      if (new RegExp(`\\b${d.id}\\b`).test(`${s.task} ${s.channel}`))
        edges.push({ id: `a:${s.id}>${d.id}`, from: stepId(s.id), to: d.id, kind: "association", inferred: true });
    }
  }

  return {
    id: "cleansea",
    title: m.metadata.name,
    status: m.status,
    nodes,
    edges,
    lanes,
    groups: m.phases.map((p) => ({ id: p.id, label: `${p.id} · ${p.title}` })),
    notes: [m.note, ...m.unresolved.map((u) => `Lacuna: ${u}`)],
  };
}
