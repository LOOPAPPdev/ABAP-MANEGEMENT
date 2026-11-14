import { data, Form, Link, redirect, useNavigation } from "react-router";
import { Button } from "~/components/ui/button";
import { Card, CardTitle } from "~/components/ui/card";
import { Input, Label } from "~/components/ui/input";
import { driveFolderUrl, newProjectSchema, parseDriveFolderId, parseSpreadsheetId, projectIdSchema, spreadsheetUrl } from "~/domain/projects";
import { PROJECT_COOKIE } from "~/server/api/project-context";
import { safeReturnTo } from "~/server/auth/session";
import { ProjectExistsError } from "~/server/projects";
import { getTemplate, TEMPLATES } from "~/domain/models";
import { ModelService } from "~/server/models";
import { systemClock } from "~/server/governance-service";
import { actorFrom, projectFrom, projectsFrom } from "../lib/service.server";
import type { Route } from "./+types/projects";

export function meta() {
  return [{ title: "Projects · ABAP" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const svc = projectsFrom(context);
  const current = await projectFrom(context, request);
  const list = await svc.list();
  return {
    current: current.id,
    projects: list.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      status: p.status,
      driveUrl: p.driveFolderId ? driveFolderUrl(p.driveFolderId) : null,
      sheetUrl: p.spreadsheetId ? spreadsheetUrl(p.spreadsheetId) : null,
      usesSecretSheet: p.id === "default" && !p.spreadsheetId && Boolean(context.cfg.spreadsheetId),
    })),
    events: await svc.events(current.id, 10),
    templates: TEMPLATES.map((t) => ({ id: t.id, name: t.name, version: t.templateVersion, stages: t.questionnaire.stages.length, fields: t.questionnaire.field_count })),
  };
}

const cookie = (id: string) => `${PROJECT_COOKIE}=${encodeURIComponent(id)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`;

export async function action({ context, request }: Route.ActionArgs) {
  const form = Object.fromEntries(await request.formData()) as Record<string, string>;
  const svc = projectsFrom(context);
  if (form.intent === "select") {
    const id = projectIdSchema.safeParse(form.project);
    if (!id.success || !(await svc.get(id.data))) return data({ error: "Projeto não encontrado." }, { status: 404 });
    throw redirect(safeReturnTo(form.returnTo || "/dashboard"), { headers: { "Set-Cookie": cookie(id.data) } });
  }
  if (form.intent === "create") {
    const parsed = newProjectSchema.safeParse({ code: form.code, name: form.name, id: form.id });
    if (!parsed.success) return data({ error: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
    const template = form.template ? getTemplate(form.template) : null;
    if (form.template && !template) return data({ error: "Modelo de interface desconhecido." }, { status: 400 });
    try {
      await svc.create(parsed.data, actorFrom(context));
    } catch (e) {
      if (e instanceof ProjectExistsError) return data({ error: e.message }, { status: 409 });
      throw e;
    }
    if (template) {
      const m = await new ModelService(context.cloudflare.env.DB, systemClock, parsed.data.id).createFromTemplate(template.id, parsed.data.name, actorFrom(context));
      throw redirect(`/models/${m.id}`, { headers: { "Set-Cookie": cookie(parsed.data.id) } });
    }
    throw redirect("/projects?created=1", { headers: { "Set-Cookie": cookie(parsed.data.id) } });
  }
  if (form.intent === "links") {
    const current = await projectFrom(context, request);
    const driveFolderId = form.driveFolder ? parseDriveFolderId(form.driveFolder) : null;
    const spreadsheetId = form.spreadsheet ? parseSpreadsheetId(form.spreadsheet) : null;
    if (form.driveFolder && !driveFolderId) return data({ error: "Link da pasta do Drive inválido." }, { status: 400 });
    if (form.spreadsheet && !spreadsheetId) return data({ error: "Link da planilha inválido." }, { status: 400 });
    await svc.setLinks(current.id, { driveFolderId, spreadsheetId }, actorFrom(context));
    return { ok: "Vínculos salvos." };
  }
  return data({ error: "Ação desconhecida." }, { status: 400 });
}

export default function Projects({ loaderData: d, actionData }: Route.ComponentProps) {
  const busy = useNavigation().state !== "idle";
  const current = d.projects.find((p) => p.id === d.current)!;
  return (
    <div className="space-y-6" data-component-id="pattern-projects">
      <header>
        <h1 className="text-2xl font-bold">Projects</h1>
        <p className="text-sm text-muted-foreground">Um projeto por cliente. O identificador é o mesmo da pasta <code>clients/&lt;id&gt;</code> no repositório.</p>
      </header>
      {actionData && "error" in actionData && <p role="alert" className="rounded border border-destructive p-2 text-sm text-destructive-strong">{actionData.error}</p>}
      {actionData && "ok" in actionData && <p role="status" className="rounded border border-border bg-sel p-2 text-sm">{actionData.ok}</p>}

      <div className="overflow-x-auto rounded-md border border-border bg-card">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Projetos</caption>
          <thead className="bg-muted text-secondary-foreground">
            <tr>
              <th scope="col" className="p-2">Código</th>
              <th scope="col" className="p-2">Projeto</th>
              <th scope="col" className="p-2">Identificador</th>
              <th scope="col" className="p-2">Planilha</th>
              <th scope="col" className="p-2">Pasta do Drive</th>
              <th scope="col" className="p-2"><span className="sr-only">Ação</span></th>
            </tr>
          </thead>
          <tbody data-testid="project-list">
            {d.projects.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="p-2 font-mono">{p.code ?? "—"}</td>
                <td className="p-2">{p.name}{p.id === d.current && <span className="ml-2 rounded bg-sel px-1.5 text-xs font-semibold text-foreground">atual</span>}</td>
                <td className="p-2 font-mono text-xs">{p.id}</td>
                <td className="p-2">{p.sheetUrl ? <a className="text-primary underline" href={p.sheetUrl} target="_blank" rel="noreferrer">vinculada</a> : p.usesSecretSheet ? "padrão do servidor" : "não vinculada"}</td>
                <td className="p-2">{p.driveUrl ? <a className="text-primary underline" href={p.driveUrl} target="_blank" rel="noreferrer">vinculada</a> : "não vinculada"}</td>
                <td className="p-2">
                  {p.id !== d.current && (
                    <Form method="post">
                      <input type="hidden" name="intent" value="select" />
                      <input type="hidden" name="project" value={p.id} />
                      <input type="hidden" name="returnTo" value="/projects" />
                      <Button type="submit" size="sm" variant="outline" disabled={busy}>Abrir</Button>
                    </Form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Vínculos do projeto atual · {current.code ? `${current.code} ` : ""}{current.name}</CardTitle>
          <Form method="post" className="mt-3 space-y-3">
            <input type="hidden" name="intent" value="links" />
            <div className="space-y-1">
              <Label htmlFor="driveFolder">Link da pasta do Google Drive</Label>
              <Input id="driveFolder" name="driveFolder" placeholder="https://drive.google.com/drive/folders/…" defaultValue={current.driveUrl ?? ""} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="spreadsheet">Link da planilha do projeto (modelo de governança)</Label>
              <Input id="spreadsheet" name="spreadsheet" placeholder="https://docs.google.com/spreadsheets/d/…" defaultValue={current.sheetUrl ?? ""} />
            </div>
            <p className="text-xs text-muted-foreground">Os IDs ficam só no banco do ABAP. Deixe em branco para desvincular. A conta conectada em Settings precisa ter acesso à pasta.</p>
            <Button type="submit" disabled={busy}>Salvar vínculos</Button>
          </Form>
        </Card>

        <Card>
          <CardTitle>Novo projeto (cliente)</CardTitle>
          <Form method="post" className="mt-3 space-y-3">
            <input type="hidden" name="intent" value="create" />
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label htmlFor="code">Código</Label>
                <Input id="code" name="code" placeholder="PRJ-02" required pattern="PRJ-\d{2,3}" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label htmlFor="name">Nome do cliente</Label>
                <Input id="name" name="name" placeholder="Nome" required />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="id">Identificador (igual a clients/&lt;id&gt;)</Label>
              <Input id="id" name="id" placeholder="prj-02-nome" required />
            </div>
            <fieldset className="space-y-2" data-component-id="pattern-template-picker">
              <legend className="text-sm font-medium">Modelo de interface</legend>
              <label className="flex items-start gap-2 rounded-md border border-border bg-card p-2 text-sm has-[:checked]:border-sel-border has-[:checked]:bg-sel">
                <input type="radio" name="template" value="" defaultChecked className="mt-1" />
                <span>Só governança<span className="block text-xs text-muted-foreground">As 14 atividades, sem diagnóstico.</span></span>
              </label>
              {d.templates.map((t) => (
                <label key={t.id} className="flex items-start gap-2 rounded-md border border-border bg-card p-2 text-sm has-[:checked]:border-sel-border has-[:checked]:bg-sel">
                  <input type="radio" name="template" value={t.id} className="mt-1" />
                  <span>
                    {t.name} <span className="meta-label">v{t.version}</span>
                    <span className="block text-xs text-muted-foreground">Abre o questionário ({t.stages} etapas, {t.fields} campos) como DIAG-01 do projeto.</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <p className="text-xs text-muted-foreground">Cria as 14 atividades do modelo de governança. No repositório: <code>npm run client:new -- PRJ-02 "Nome"</code>.</p>
            <Button type="submit" disabled={busy}>Criar projeto</Button>
          </Form>
        </Card>
      </div>

      <Card>
        <CardTitle>Histórico do projeto atual</CardTitle>
        <ul className="mt-2 space-y-1 text-sm">
          {d.events.length === 0 && <li className="text-muted-foreground">Sem registros.</li>}
          {d.events.map((e) => <li key={e.id}><span className="text-xs text-muted-foreground">{e.at}</span> · {e.actor} · {e.action} · {e.detail}</li>)}
        </ul>
        <p className="mt-2 text-xs"><Link className="text-primary underline" to="/dashboard">Abrir o dashboard deste projeto</Link></p>
      </Card>
    </div>
  );
}
