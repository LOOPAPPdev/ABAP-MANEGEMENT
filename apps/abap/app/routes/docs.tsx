import { data, Form, Link, useNavigation } from "react-router";
import { Button } from "~/components/ui/button";
import { Card, CardTitle } from "~/components/ui/card";
import { Input, Label } from "~/components/ui/input";
import { driveFolderUrl } from "~/domain/projects";
import { systemClock } from "~/server/governance-service";
import { MIME, type DriveFile } from "~/server/drive/client";
import { DriveService, DriveUnavailableError, newDocumentSchema } from "~/server/drive/service";
import { actorFrom, projectFrom, projectsFrom } from "../lib/service.server";
import type { Route } from "./+types/docs";

export function meta() {
  return [{ title: "Docs · ABAP" }];
}

const TYPE: Record<string, string> = { [MIME.doc]: "Google Doc", [MIME.sheet]: "Planilha", [MIME.slides]: "Apresentação", "application/pdf": "PDF" };
const typeOf = (f: DriveFile) => TYPE[f.mimeType] ?? f.mimeType.split("/").pop() ?? "arquivo";

export async function loader({ context, request }: Route.LoaderArgs) {
  const project = await projectFrom(context, request);
  const drive = new DriveService(context.cloudflare.env.DB, context.cfg, project, systemClock);
  const fileId = new URL(request.url).searchParams.get("file");
  const events = (await projectsFrom(context).events(project.id, 50)).filter((e) => e.action.startsWith("drive.") || e.action === "project.links").slice(0, 10);
  const base = { project: { id: project.id, code: project.code, name: project.name }, folderUrl: project.driveFolderId ? driveFolderUrl(project.driveFolderId) : null, events };
  try {
    const files = await drive.list();
    const opened = fileId ? await drive.read(fileId) : null;
    return { ...base, files: files.map((f) => ({ ...f, type: typeOf(f) })), opened, error: null, reason: null };
  } catch (e) {
    if (e instanceof DriveUnavailableError) return { ...base, files: [], opened: null, error: e.message, reason: e.reason };
    return { ...base, files: [], opened: null, error: `Falha ao ler o Drive: ${e instanceof Error ? e.message : String(e)}`, reason: "error" as const };
  }
}

export async function action({ context, request }: Route.ActionArgs) {
  const project = await projectFrom(context, request);
  const drive = new DriveService(context.cloudflare.env.DB, context.cfg, project, systemClock);
  const form = Object.fromEntries(await request.formData()) as Record<string, string>;
  try {
    if (form.intent === "publish") {
      const parsed = newDocumentSchema.safeParse({ title: form.title, markdown: form.markdown, confirm: form.confirm === "on" });
      if (!parsed.success) return data({ error: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
      const doc = await drive.createDocument(parsed.data, actorFrom(context));
      return { ok: `Documento “${doc.name}” criado na pasta do cliente.`, link: doc.webViewLink ?? null };
    }
    if (form.intent === "detect") {
      const r = await drive.detectSpreadsheet(actorFrom(context));
      return r.linked
        ? { ok: `Planilha “${r.linked.name}” vinculada ao projeto.`, link: null }
        : data({ error: r.candidates.length === 0 ? "Nenhuma planilha encontrada na pasta." : `Há ${r.candidates.length} planilhas na pasta: vincule a certa em Projects.` }, { status: 409 });
    }
  } catch (e) {
    return data({ error: e instanceof Error ? e.message : String(e) }, { status: e instanceof DriveUnavailableError ? 409 : 502 });
  }
  return data({ error: "Ação desconhecida." }, { status: 400 });
}

export default function Docs({ loaderData: d, actionData }: Route.ComponentProps) {
  const busy = useNavigation().state !== "idle";
  return (
    <div className="space-y-5" data-component-id="pattern-drive-docs">
      <header>
        <h1 className="text-2xl font-bold">Docs · {d.project.code ? `${d.project.code} ` : ""}{d.project.name}</h1>
        <p className="text-sm text-muted-foreground">
          Documentos da pasta do cliente no Google Drive. No repositório: <code>npm run docs:pull -w @clients/{d.project.id}</code>.
          {d.folderUrl && <> <a className="text-primary underline" href={d.folderUrl} target="_blank" rel="noreferrer">Abrir pasta no Drive</a></>}
        </p>
      </header>
      {actionData && "error" in actionData && <p role="alert" className="rounded border border-destructive p-2 text-sm text-destructive-strong">{actionData.error}</p>}
      {actionData && "ok" in actionData && (
        <p role="status" className="rounded border border-border bg-sel p-2 text-sm">
          {actionData.ok} {actionData.link && <a className="text-primary underline" href={actionData.link} target="_blank" rel="noreferrer">Abrir</a>}
        </p>
      )}

      {d.error ? (
        <Card className="border-destructive">
          <CardTitle>Drive indisponível para este projeto</CardTitle>
          <p className="mt-1 text-sm" data-testid="drive-error">{d.error}</p>
          {d.reason === "not_linked" && <Link className="mt-2 inline-block text-primary underline" to="/projects">Vincular a pasta em Projects</Link>}
          {(d.reason === "not_connected" || d.reason === "scope_missing") && (
            <a href="/auth/sheets/connect?returnTo=%2Fdocs" className="mt-3 inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">Conectar Google (Sheets + Drive)</a>
          )}
        </Card>
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border border-border bg-card">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Arquivos da pasta do cliente</caption>
              <thead className="bg-muted text-secondary-foreground">
                <tr>
                  <th scope="col" className="p-2">Arquivo</th>
                  <th scope="col" className="p-2">Tipo</th>
                  <th scope="col" className="p-2">Modificado</th>
                  <th scope="col" className="p-2"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody data-testid="drive-files">
                {d.files.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">A pasta está vazia.</td></tr>}
                {d.files.map((f) => (
                  <tr key={f.id} className="border-t border-border">
                    <td className="p-2">{f.path && <span className="text-muted-foreground">{f.path} / </span>}{f.name}</td>
                    <td className="p-2">{f.type}</td>
                    <td className="p-2 text-xs">{new Date(f.modifiedTime).toLocaleString("pt-BR")}</td>
                    <td className="space-x-2 p-2 whitespace-nowrap">
                      {f.mimeType === MIME.doc && <Link className="text-primary underline" to={`/docs?file=${encodeURIComponent(f.id)}`}>Ver</Link>}
                      {f.webViewLink && <a className="text-primary underline" href={f.webViewLink} target="_blank" rel="noreferrer">Abrir no Drive</a>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {d.opened && (
            <Card>
              <CardTitle>{d.opened.file.name}</CardTitle>
              <pre className="mt-2 max-h-[60vh] overflow-auto whitespace-pre-wrap rounded bg-muted p-3 text-sm" data-testid="doc-markdown">{d.opened.markdown ?? "Só Google Docs podem ser exibidos aqui."}</pre>
            </Card>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardTitle>Publicar documento na pasta do cliente</CardTitle>
              <Form method="post" className="mt-3 space-y-3">
                <input type="hidden" name="intent" value="publish" />
                <div className="space-y-1">
                  <Label htmlFor="title">Título</Label>
                  <Input id="title" name="title" required minLength={3} maxLength={120} placeholder="01 — Project Charter v0.1" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="markdown">Conteúdo (Markdown)</Label>
                  <textarea id="markdown" name="markdown" required rows={8} className="w-full rounded-md border border-input bg-card p-2 font-mono text-sm" />
                </div>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="confirm" required className="mt-1" />
                  Confirmo a criação de um <strong>novo</strong> Google Doc na pasta do cliente. Nada existente é alterado.
                </label>
                <Button type="submit" disabled={busy}>Publicar no Drive</Button>
              </Form>
            </Card>
            <Card>
              <CardTitle>Planilha do projeto</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Procura a planilha de governança dentro da pasta e vincula ao projeto quando houver exatamente uma.</p>
              <Form method="post" className="mt-3">
                <input type="hidden" name="intent" value="detect" />
                <Button type="submit" variant="outline" disabled={busy}>Detectar planilha na pasta</Button>
              </Form>
            </Card>
          </div>
        </>
      )}

      <Card>
        <CardTitle>Histórico do Drive neste projeto</CardTitle>
        <ul className="mt-2 space-y-1 text-sm">
          {d.events.length === 0 && <li className="text-muted-foreground">Sem registros.</li>}
          {d.events.map((e) => <li key={e.id}><span className="text-xs text-muted-foreground">{e.at}</span> · {e.actor} · {e.action} · {e.detail}</li>)}
        </ul>
      </Card>
    </div>
  );
}
