import { useMemo } from "react";
import { data, Form, Link, useNavigation, useSearchParams } from "react-router";
import { DiagramView } from "../components/canvas/diagram-view";
import { Button } from "~/components/ui/button";
import { Card, CardTitle } from "~/components/ui/card";
import { Input, Label, Textarea } from "~/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { project as projectView, type Graph, type ViewId } from "~/domain/diagram";
import {
  adaptivePlan,
  DIAGNOSTIC_TEMPLATE,
  fromDiagnostic,
  fromFlowModel,
  fromOrgModel,
  gapsOf,
  getTemplate,
  isAnswered,
  modelIdSchema,
  processOf,
  progressOf,
  toMermaid,
  type TemplateField,
} from "~/domain/models";
import { ModelError } from "~/server/models";
import { actorFrom, modelsFrom, projectFrom } from "../lib/service.server";
import type { Route } from "./+types/model";

export function meta({ data: d }: Route.MetaArgs) {
  return [{ title: `${d?.model.id ?? "Modelo"} · Modelos · ABAP` }];
}

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const id = modelIdSchema.safeParse(params.modelId);
  if (!id.success) throw data("Modelo não encontrado", { status: 404 });
  const project = await projectFrom(context, request);
  const model = await modelsFrom(context, project).get(id.data);
  if (!model) throw data("Modelo não encontrado neste projeto", { status: 404 });
  return { project: { id: project.id, code: project.code, name: project.name }, model };
}

export async function action({ context, request, params }: Route.ActionArgs) {
  const id = modelIdSchema.parse(params.modelId);
  const project = await projectFrom(context, request);
  const svc = modelsFrom(context, project);
  const form = Object.fromEntries(await request.formData()) as Record<string, string>;
  try {
    if (form.intent === "stage") {
      await svc.saveStage(id, form.stage ?? "", form, actorFrom(context));
      return { ok: `Etapa ${form.stage} salva. Respostas alteradas ficam "a validar com o cliente".` };
    }
    if (form.intent === "regenerate") {
      const m = await svc.regenerateProcess(id, actorFrom(context));
      return { ok: `Diagrama gerado a partir das respostas (${m.kind === "diagnostic" ? (m.data.process?.nodes.length ?? 0) : 0} nós).` };
    }
  } catch (e) {
    if (e instanceof ModelError) return data({ error: e.message }, { status: 400 });
    throw e;
  }
  return data({ error: "Ação desconhecida." }, { status: 400 });
}

const KIND_LABEL = { diagnostic: "Diagnóstico de processos", org: "Organograma", flow: "Fluxo operacional" } as const;

function Diagram({ graph, view }: { graph: Graph; view: ViewId }) {
  const projection = useMemo(() => projectView(graph, view), [graph, view]);
  return (
    <div className="space-y-2">
      {projection.warnings.length > 0 && <p className="rounded-md border border-warn-border bg-warn p-2 text-xs text-warn-foreground">{projection.warnings.join(" ")}</p>}
      <div className="max-h-[32rem] overflow-auto rounded-lg border border-border bg-background" data-testid="model-diagram">
        <DiagramView graph={graph} projection={projection} selectedId={null} highlight={{}} zoom={0.8} onSelect={() => {}} />
      </div>
      <p className="text-xs text-muted-foreground">Borda tracejada = não validado. <Link className="underline" to={`/canvas?dataset=${encodeURIComponent(graph.id)}&view=${view}`}>Abrir no Canvas</Link> para as 5 visões.</p>
    </div>
  );
}

function Field({ f, value }: { f: TemplateField; value: string | number | boolean | undefined }) {
  const label = `${f.label}${f.required ? " *" : ""}`;
  if (f.type === "boolean")
    return (
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name={f.id} defaultChecked={value === true} className="mt-1" />
        <span>{label}</span>
      </label>
    );
  return (
    <div className="space-y-1">
      <Label htmlFor={f.id}>{label}</Label>
      {f.type === "textarea" ? (
        <Textarea id={f.id} name={f.id} rows={5} defaultValue={value === undefined ? "" : String(value)} required={f.required} />
      ) : (
        <Input id={f.id} name={f.id} type={f.type === "number" ? "number" : f.type === "url" ? "url" : "text"} min={f.type === "number" ? 0 : undefined} step="any" defaultValue={value === undefined ? "" : String(value)} required={f.required} />
      )}
    </div>
  );
}

function DiagnosticView({ model, busy }: { model: Extract<Route.ComponentProps["loaderData"]["model"], { kind: "diagnostic" }>; busy: boolean }) {
  const template = getTemplate(model.templateId ?? DIAGNOSTIC_TEMPLATE)!;
  const [params, setParams] = useSearchParams();
  const stages = template.questionnaire.stages;
  const stage = stages.find((s) => s.id === params.get("stage")) ?? stages.find((s) => s.id === model.data.questionnaire.current_stage) ?? stages[0]!;
  const idx = stages.indexOf(stage);
  const answers = model.data.questionnaire.answers;
  const progress = progressOf(template, model.data);
  const process = processOf(model.data);
  const graph = useMemo(() => fromDiagnostic(model.data, model.id, model.title), [model]);
  const gaps = gapsOf(template, model.data);
  const plan = adaptivePlan(template, model.data);
  const extras = Object.entries(answers).filter(([k]) => !stages.some((s) => s.fields.some((f) => f.id === k)));

  return (
    <div className="grid gap-4 lg:grid-cols-[14rem_minmax(0,1fr)_minmax(0,1.2fr)]">
      <nav aria-label="Etapas do questionário" className="space-y-1" data-component-id="composite-stage-list">
        <p className="meta-label">{progress.answered} de {progress.total} campos</p>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={progress.answered} aria-valuemin={0} aria-valuemax={progress.total} aria-label="Progresso do questionário">
          <div className="h-full bg-primary" style={{ width: `${Math.round(progress.ratio * 100)}%` }} />
        </div>
        <ol className="mt-2 space-y-1">
          {stages.map((s) => {
            const done = s.fields.filter((f) => isAnswered(answers[f.id])).length;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setParams({ stage: s.id }, { replace: true, preventScrollReset: true })}
                  aria-current={s.id === stage.id ? "step" : undefined}
                  className="flex w-full items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left text-sm hover:bg-accent aria-[current=step]:border-sel-border aria-[current=step]:bg-sel"
                >
                  <span className="font-mono text-xs">{s.id}</span>
                  <span className="flex-1">{s.title}</span>
                  <span className="font-mono text-xs text-muted-foreground">{done}/{s.fields.length}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <Card>
        <p className="meta-label">Etapa {stage.id} / I · {idx + 1} de {stages.length}</p>
        <CardTitle className="mt-1">{stage.title}</CardTitle>
        <p className="text-sm text-muted-foreground">{stage.description}</p>
        <Form method="post" className="mt-4 space-y-4" key={`${model.id}-${stage.id}-${model.updatedAt}`}>
          <input type="hidden" name="intent" value="stage" />
          <input type="hidden" name="stage" value={stage.id} />
          {stage.fields.map((f) => (
            <div key={f.id}>
              <Field f={f} value={answers[f.id]?.value} />
              {answers[f.id] && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {answers[f.id]!.verification === "confirmed" ? "Confirmado" : "A validar com o cliente"} · origem {answers[f.id]!.origin.replace(/_/g, " ")}
                </p>
              )}
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy}>Salvar etapa</Button>
            {idx < stages.length - 1 && (
              <Button type="button" variant="outline" onClick={() => setParams({ stage: stages[idx + 1]!.id }, { replace: true })}>Próxima etapa</Button>
            )}
          </div>
        </Form>
        {extras.length > 0 && (
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer font-medium">Outras respostas registradas ({extras.length})</summary>
            <dl className="mt-2 space-y-2">
              {extras.map(([k, a]) => (
                <div key={k}><dt className="meta-label">{k.replace(/_/g, " ")}</dt><dd className="whitespace-pre-line">{String(a.value)}</dd></div>
              ))}
            </dl>
          </details>
        )}
      </Card>

      <Card>
        <Tabs defaultValue="diagram">
          <TabsList aria-label="Saídas do diagnóstico">
            <TabsTrigger value="diagram">Diagrama</TabsTrigger>
            <TabsTrigger value="mermaid">Mermaid</TabsTrigger>
            <TabsTrigger value="plan">Plano adaptativo</TabsTrigger>
            <TabsTrigger value="gaps">Lacunas ({gaps.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="diagram" className="space-y-3">
            {process.nodes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Preencha as atividades (etapa E · Sequência) para gerar o diagrama AS-IS.</p>
            ) : (
              <Diagram graph={graph} view={graph.lanes.length > 0 ? "bpmn" : "complex"} />
            )}
            <Form method="post">
              <input type="hidden" name="intent" value="regenerate" />
              <Button type="submit" variant="outline" size="sm" disabled={busy}>Gerar diagrama a partir das respostas</Button>
            </Form>
            <p className="text-xs text-muted-foreground">Substitui o diagrama guardado ({model.data.process ? `${model.data.process.nodes.length} nós, ${model.source}` : "nenhum"}) pelo derivado das respostas.</p>
          </TabsContent>
          <TabsContent value="mermaid">
            <pre className="max-h-[32rem] overflow-auto rounded-md border border-border bg-note p-3 font-mono text-xs" data-testid="mermaid">{toMermaid(process)}</pre>
            <p className="mt-2 text-xs text-muted-foreground">Formato de exportação (docs em Markdown). No app o diagrama segue o sistema de diagramas ABAP.</p>
          </TabsContent>
          <TabsContent value="plan">
            <ol className="space-y-2 text-sm" data-testid="adaptive-plan">
              {plan.length === 0 && <li className="text-muted-foreground">Todas as perguntas respondidas.</li>}
              {plan.map((p, i) => (
                <li key={i} className="rounded-md border border-border p-2">
                  <span className="meta-label">{p.stage} · {p.stageTitle}{p.required ? " · obrigatório" : ""}</span>
                  <span className="block">{p.question}</span>
                </li>
              ))}
            </ol>
          </TabsContent>
          <TabsContent value="gaps">
            <ul className="space-y-2 text-sm" data-testid="gaps">
              {gaps.map((g, i) => (
                <li key={i} className={`rounded-md border p-2 ${g.kind === "required" ? "border-warn-border bg-warn text-warn-foreground" : "border-border"}`}>
                  <span className="meta-label">{{ required: "Obrigatório", review: "Validar", risk: "Risco", unverified: "Diagrama" }[g.kind]}{g.stage ? ` · ${g.stage}` : ""}</span>
                  <span className="block">{g.text}</span>
                </li>
              ))}
            </ul>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}

function OrgView({ model }: { model: Extract<Route.ComponentProps["loaderData"]["model"], { kind: "org" }> }) {
  const m = model.data;
  const graph = useMemo(() => fromOrgModel(m), [m]);
  const name = (id: string | null | undefined) => (id ? (m.governance.find((g) => g.id === id)?.name ?? id) : "por confirmar");
  return (
    <div className="space-y-4">
      <Diagram graph={graph} view="orgchart" />
      <div className="grid gap-3 md:grid-cols-3">
        {m.departments.map((d) => (
          <Card key={d.id} className={!d.leader ? "border-dashed" : ""}>
            <p className="meta-label">{d.id}</p>
            <CardTitle>{d.name}</CardTitle>
            <p className="text-sm">Líder: {name(d.leader)} <span className="text-xs text-muted-foreground">({d.leader_status ?? "—"})</span></p>
            <ul className="mt-2 text-sm">{d.members.map((p) => <li key={p.id}>{p.name} · <span className="text-muted-foreground">{p.role}</span></li>)}</ul>
            <p className="mt-2 text-xs text-muted-foreground">{d.activities.join(" · ")}</p>
          </Card>
        ))}
      </div>
      {m.notes.length > 0 && <Card><CardTitle>Notas</CardTitle><ul className="list-disc pl-5 text-sm">{m.notes.map((n, i) => <li key={i}>{n}</li>)}</ul></Card>}
    </div>
  );
}

function FlowView({ model }: { model: Extract<Route.ComponentProps["loaderData"]["model"], { kind: "flow" }> }) {
  const m = model.data;
  const graph = useMemo(() => fromFlowModel(m), [m]);
  return (
    <div className="space-y-4">
      <Diagram graph={graph} view="bpmn" />
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <caption className="sr-only">Etapas do fluxo {m.id}</caption>
          <thead className="bg-muted text-left"><tr><th className="p-2">#</th><th className="p-2">Etapa</th><th className="p-2">Responsável</th><th className="p-2">Saída</th><th className="p-2">Área</th><th className="p-2">Fonte</th></tr></thead>
          <tbody>
            {m.steps.map((s) => (
              <tr key={s.id} className="border-t border-border">
                <td className="p-2 font-mono text-xs">{s.id}</td>
                <td className="p-2">{s.title}{m.decision?.after === s.id && <span className="block text-xs text-warn-foreground">Decisão {m.decision.id}: {m.decision.question} ({m.decision.status})</span>}</td>
                <td className="p-2">{s.owner}</td><td className="p-2">{s.output}</td><td className="p-2">{s.area}</td><td className="p-2 font-mono text-xs">{s.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Card><CardTitle>Documentos</CardTitle><ul className="text-sm">{m.documents.map((d) => <li key={d.id}><span className="font-mono text-xs">{d.id}</span> {d.name} · {d.handling}</li>)}</ul></Card>
        <Card><CardTitle>Pressupostos</CardTitle><ul className="list-disc pl-5 text-sm">{m.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul></Card>
        <Card><CardTitle>Pendências</CardTitle><ul className="list-disc pl-5 text-sm">{m.outstanding.map((a, i) => <li key={i}>{a}</li>)}</ul></Card>
      </div>
    </div>
  );
}

export default function ModelPage({ loaderData: d, actionData }: Route.ComponentProps) {
  const busy = useNavigation().state !== "idle";
  const m = d.model;
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="meta-label"><Link to="/models" className="underline">Modelos</Link> · {m.id} · {KIND_LABEL[m.kind]}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{m.title}</h1>
          <p className="text-xs text-muted-foreground">{m.status} · origem {m.source} · atualizado {m.updatedAt.slice(0, 16).replace("T", " ")} por {m.updatedBy}</p>
        </div>
        <a className="text-sm underline" href={`/api/v1/projects/${d.project.id}/models/${m.id}`}>JSON (API)</a>
      </header>
      {actionData && "error" in actionData && <p role="alert" className="rounded-md border border-destructive p-2 text-sm text-destructive-strong">{actionData.error}</p>}
      {actionData && "ok" in actionData && <p role="status" className="rounded-md border border-sel-border bg-sel p-2 text-sm">{actionData.ok}</p>}
      {m.kind === "diagnostic" && <DiagnosticView model={m} busy={busy} />}
      {m.kind === "org" && <OrgView model={m} />}
      {m.kind === "flow" && <FlowView model={m} />}
    </div>
  );
}
