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
