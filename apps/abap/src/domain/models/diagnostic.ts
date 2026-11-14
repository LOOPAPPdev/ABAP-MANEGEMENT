/**
 * "Diagnóstico de processos" template logic (pure): answers → AS-IS process → Mermaid, gaps, adaptive plan.
 * Re-implemented from the bundle's data contract (template.json + session schema), not from its code.
 */
import type { Answer, DiagnosticSession, Process, Template, TemplateField } from "./schemas";

export const allFields = (t: Template): (TemplateField & { stage: string })[] =>
  t.questionnaire.stages.flatMap((s) => s.fields.map((f) => ({ ...f, stage: s.id })));

export const isAnswered = (a: Answer | undefined) =>
  a !== undefined && !(typeof a.value === "string" && a.value.trim() === "") && !(typeof a.value === "boolean" && a.value === false);

export function emptySession(company: string, sessionId: string, today: string): DiagnosticSession {
  return {
    schema_version: "1.0.0",
    session_id: sessionId,
    organization: { name: company },
    questionnaire: { current_stage: "A", answers: { company_name: { value: company, origin: "consultant", verification: "needs_review", updated_at: today } } },
    research: { state: "idle", suggestions: [] },
    sources: [],
  };
}

/** Coerces a submitted form value according to the field type. Empty → undefined (answer removed). */
export function coerceField(field: TemplateField, raw: string | undefined): string | number | boolean | undefined {
  const v = (raw ?? "").trim();
  if (field.type === "boolean") return raw === "on" || raw === "true";
  if (v === "") return undefined;
  if (field.type === "number") {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  }
  if (field.type === "url" && !/^https?:\/\//i.test(v)) return `https://${v}`;
  return v.slice(0, 10_000);
}

/** Applies one stage's answers. Changed answers become origin "consultant" / "needs_review". */
export function applyStageAnswers(
  session: DiagnosticSession,
  template: Template,
  stageId: string,
  form: Record<string, string | undefined>,
  today: string,
): DiagnosticSession {
  const stage = template.questionnaire.stages.find((s) => s.id === stageId);
  if (!stage) throw new Error(`etapa ${stageId} não existe`);
  const answers = { ...session.questionnaire.answers };
  for (const f of stage.fields) {
    const value = coerceField(f, form[f.id]);
    if (value === undefined) {
      delete answers[f.id];
      continue;
    }
    if (answers[f.id]?.value === value) continue;
    answers[f.id] = { value, origin: "consultant", verification: f.id === "confirmation" && value === true ? "confirmed" : "needs_review", updated_at: today };
  }
  const name = typeof answers.company_name?.value === "string" ? answers.company_name.value : session.organization.name;
  return { ...session, organization: { ...session.organization, name }, questionnaire: { ...session.questionnaire, current_stage: stageId, answers } };
}

const str = (a: Answer | undefined) => (a === undefined ? "" : String(a.value).trim());
const lines = (a: Answer | undefined) =>
  str(a)
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(\d+[.)]|[-*•])\s*/, "").trim())
    .filter(Boolean);

/** Builds the AS-IS process from the answers: start (trigger) → activities in order → end (deliverable). */
export function buildProcess(session: DiagnosticSession): Process {
  const a = session.questionnaire.answers;
  const acts = lines(a.activities);
  const nodes: Process["nodes"] = [];
  const edges: Process["edges"] = [];
  const verification = (k: string) => (a[k]?.verification === "confirmed" ? "confirmed" : "unverified");
  if (acts.length === 0) return { id: `proc-${session.session_id}`, name: str(a.process_name) || "Processo AS-IS", version: 1, status: "draft", nodes, edges, risks: [] };
  nodes.push({ id: "N_start", type: "start", label: str(a.trigger) || "Início", verification: verification("trigger"), origin: a.trigger?.origin });
  acts.forEach((label, i) => {
    const [title, actor] = label.split(/\s+[—–-]\s+(?=[^—–-]+$)/);
    nodes.push({ id: `N_${String(i + 1).padStart(2, "0")}`, type: "task", label: title ?? label, ...(actor ? { actor } : {}), verification: verification("activities"), origin: a.activities?.origin });
  });
  nodes.push({ id: "N_end", type: "end", label: str(a.deliverable) || "Fim", verification: verification("deliverable"), origin: a.deliverable?.origin });
  for (let i = 1; i < nodes.length; i++) edges.push({ id: `E_${String(i - 1).padStart(2, "0")}`, source: nodes[i - 1]!.id, target: nodes[i]!.id, kind: "sequence" });
  const risks = [...lines(a.exceptions), ...lines(a.bottlenecks)];
  return { id: `proc-${session.session_id}`, name: str(a.process_name) || "Processo AS-IS", version: 1, status: a.confirmation?.value === true ? "confirmed" : "review_required", nodes, edges, risks };
}

/** Process shown for a session: the stored (imported/regenerated) one, else derived live from the answers. */
export const processOf = (session: DiagnosticSession): Process => (session.process && session.process.nodes.length > 0 ? session.process : buildProcess(session));

const mmd = (s: string) => s.replace(/"/g, "'").replace(/[\r\n]+/g, " ").slice(0, 120);

/** Mermaid export (flowchart). Export format only: the ABAP renderer keeps the square-geometry diagramming system. */
export function toMermaid(p: Process): string {
  const out = ["flowchart TD"];
  for (const n of p.nodes) {
    const label = mmd(n.actor ? `${n.label} · ${n.actor}` : n.label);
    out.push(n.type === "start" || n.type === "end" ? `  ${n.id}(["${label}"])` : n.type === "decision" ? `  ${n.id}{"${label}"}` : `  ${n.id}["${label}"]`);
  }
  for (const e of p.edges) out.push(e.label ? `  ${e.source} -->|${mmd(e.label)}| ${e.target}` : `  ${e.source} --> ${e.target}`);
  return out.join("\n");
}

export interface Gap {
  kind: "required" | "review" | "risk" | "unverified";
  text: string;
  stage?: string;
}

/** Gaps ("Lacunas"): missing required answers, answers to validate, process risks, unverified nodes. */
export function gapsOf(template: Template, session: DiagnosticSession): Gap[] {
  const a = session.questionnaire.answers;
  const fields = allFields(template);
  const out: Gap[] = [];
  for (const f of fields) if (f.required && !isAnswered(a[f.id])) out.push({ kind: "required", stage: f.stage, text: `Obrigatório sem resposta: ${f.label}` });
  for (const [k, v] of Object.entries(a)) {
    if (v.verification !== "needs_review") continue;
    const f = fields.find((x) => x.id === k);
    out.push({ kind: "review", stage: f?.stage, text: `A validar com o cliente: ${f?.label ?? k.replace(/_/g, " ")}` });
  }
  const p = processOf(session);
  for (const r of p.risks) out.push({ kind: "risk", text: r });
  const unverified = p.nodes.filter((n) => n.verification !== "confirmed").length;
  if (unverified > 0) out.push({ kind: "unverified", text: `${unverified} de ${p.nodes.length} nós do diagrama ainda não confirmados` });
  return out;
}

export interface PlanItem {
  stage: string;
  stageTitle: string;
  question: string;
  required: boolean;
}

/** Adaptive plan: next questions to ask, required first, in stage order; extra prompts derived from answers. */
export function adaptivePlan(template: Template, session: DiagnosticSession): PlanItem[] {
  const a = session.questionnaire.answers;
  const items: PlanItem[] = [];
  for (const s of template.questionnaire.stages)
    for (const f of s.fields) if (!isAnswered(a[f.id])) items.push({ stage: s.id, stageTitle: s.title, question: f.label, required: f.required });
  if (isAnswered(a.exceptions) && !isAnswered(a.decisions))
    items.push({ stage: "F", stageTitle: "Condições", question: "As exceções descritas geram decisões no fluxo? Quem decide e com que critério?", required: false });
  if (isAnswered(a.frequency_month) && !isAnswered(a.cost_per_operation))
    items.push({ stage: "H", stageTitle: "Fricção e valor", question: "Com o volume mensal conhecido, qual é o custo médio por operação?", required: false });
  return items.sort((x, y) => Number(y.required) - Number(x.required) || x.stage.localeCompare(y.stage));
}

export function progressOf(template: Template, session: DiagnosticSession) {
  const fields = allFields(template);
  const answered = fields.filter((f) => isAnswered(session.questionnaire.answers[f.id])).length;
  return { answered, total: fields.length, ratio: fields.length ? answered / fields.length : 0 };
}
