import { data, Form, Link, redirect, useNavigation } from "react-router";
import { Button } from "~/components/ui/button";
import { Card, CardTitle } from "~/components/ui/card";
import { Label, Textarea } from "~/components/ui/input";
import { TEMPLATES } from "~/domain/models";
import { ModelError } from "~/server/models";
import { actorFrom, modelsFrom, projectFrom } from "../lib/service.server";
import type { Route } from "./+types/models";

export function meta() {
  return [{ title: "Modelos · ABAP" }];
}

const KIND_LABEL = { diagnostic: "Diagnóstico", org: "Organograma", flow: "Fluxo operacional" } as const;
const MAX_IMPORT = 512 * 1024;

export async function loader({ context, request }: Route.LoaderArgs) {
  const project = await projectFrom(context, request);
  return {
    project: { id: project.id, code: project.code, name: project.name },
    models: await modelsFrom(context, project).list(),
    templates: TEMPLATES.map((t) => ({ id: t.id, name: t.name, version: t.templateVersion, outputs: t.outputs, stages: t.questionnaire.stages.map((s) => `${s.id} · ${s.title}`) })),
  };
}

export async function action({ context, request }: Route.ActionArgs) {
  const project = await projectFrom(context, request);
  const svc = modelsFrom(context, project);
  const form = await request.formData();
  try {
    if (form.get("intent") === "template") {
      const m = await svc.createFromTemplate(String(form.get("template") ?? ""), project.name, actorFrom(context));
      throw redirect(`/models/${m.id}`);
    }
    if (form.get("intent") === "import") {
      const file = form.get("file");
      let text = String(form.get("json") ?? "").trim();
      let source = "colado no app";
      if (file instanceof File && file.size > 0) {
        if (file.size > MAX_IMPORT) return data({ error: "Arquivo acima de 512 KB." }, { status: 400 });
        text = await file.text();
        source = `import:${file.name.replace(/[^\w.@-]/g, "_").slice(0, 80)}`;
      }
      if (!text) return data({ error: "Escolha um arquivo JSON ou cole o conteúdo." }, { status: 400 });
      if (text.length > MAX_IMPORT) return data({ error: "Conteúdo acima de 512 KB." }, { status: 400 });
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        return data({ error: "JSON inválido." }, { status: 400 });
      }
      const m = await svc.importModel(raw, source, actorFrom(context), form.get("replace") === "on");
      throw redirect(`/models/${m.id}`);
    }
  } catch (e) {
    if (e instanceof ModelError) return data({ error: e.message }, { status: e.code === "model_exists" ? 409 : 400 });
    throw e;
  }
  return data({ error: "Ação desconhecida." }, { status: 400 });
}

export default function Models({ loaderData: d, actionData }: Route.ComponentProps) {
  const busy = useNavigation().state !== "idle";
  return (
    <div className="space-y-6">
      <header>
        <p className="meta-label">{d.project.code ?? "Plataforma"} · Modelos do projeto</p>
        <h1 className="text-2xl font-semibold tracking-tight">Modelos · {d.project.name}</h1>
        <p className="text-sm text-muted-foreground">Diagnósticos, organogramas e fluxos deste projeto. Todos usam o design system ABAP; cores de material importado são descartadas.</p>
      </header>
      {actionData && "error" in actionData && <p role="alert" className="rounded-md border border-destructive p-2 text-sm text-destructive-strong">{actionData.error}</p>}

      <section aria-labelledby="list-title" className="space-y-2">
        <h2 id="list-title" className="text-lg font-semibold">Modelos ({d.models.length})</h2>
        {d.models.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">Nenhum modelo ainda. Comece pelo modelo de interface abaixo ou importe um JSON.</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-3" data-testid="model-list">
            {d.models.map((m) => (
              <li key={m.id}>
                <Link to={`/models/${m.id}`} className="block h-full rounded-lg border border-border bg-card p-4 shadow-sm hover:border-sel-border hover:bg-sel" data-component-id="composite-model-card">
                  <span className="meta-label">{m.id} · {KIND_LABEL[m.kind as keyof typeof KIND_LABEL] ?? m.kind}</span>
                  <span className="mt-1 block font-medium">{m.title}</span>
                  <span className="mt-2 block text-xs text-muted-foreground">{m.status} · atualizado {m.updatedAt.slice(0, 10)} por {m.updatedBy}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Modelos de interface disponíveis</CardTitle>
          {d.templates.map((t) => (
            <Form method="post" key={t.id} className="mt-3 space-y-2">
              <input type="hidden" name="intent" value="template" />
              <input type="hidden" name="template" value={t.id} />
              <p className="font-medium">{t.name} <span className="meta-label">v{t.version}</span></p>
              <p className="text-xs text-muted-foreground">Etapas: {t.stages.join(" · ")}</p>
              <p className="text-xs text-muted-foreground">Saídas: {t.outputs.join(", ")}</p>
              <Button type="submit" disabled={busy}>Novo diagnóstico</Button>
            </Form>
          ))}
        </Card>
        <Card>
          <CardTitle>Importar modelo (JSON)</CardTitle>
          <Form method="post" encType="multipart/form-data" className="mt-3 space-y-3">
            <input type="hidden" name="intent" value="import" />
            <div className="space-y-1">
              <Label htmlFor="file">Arquivo</Label>
              <input id="file" name="file" type="file" accept="application/json,.json" className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-card file:px-3 file:py-1.5" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="json">ou cole o JSON</Label>
              <Textarea id="json" name="json" rows={4} placeholder='{"id": "FLW-01", ...}' className="font-mono text-xs" />
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="replace" /> Substituir se já existir (fica registrado no histórico)</label>
            <p className="text-xs text-muted-foreground">Aceita: sessão do Diagnóstico de processos, organograma ORG-NN, fluxo FLW-NN. Máx. 512 KB.</p>
            <Button type="submit" disabled={busy}>Importar</Button>
          </Form>
        </Card>
      </div>
    </div>
  );
}
