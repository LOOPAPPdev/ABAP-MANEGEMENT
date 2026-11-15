import { data, Form, Link, redirect, useNavigation } from "react-router";
import { Button } from "~/components/ui/button";
import { Card, CardTitle } from "~/components/ui/card";
import { Input, Label } from "~/components/ui/input";
import { projectIdSchema } from "~/domain/projects";
import { artifactSlugSchema, emailSchema, inviteSchema } from "~/domain/studio";
import { artifactUrl } from "~/server/api/studio-routes";
import { systemClock } from "~/server/governance-service";
import { StudioError, StudioService } from "~/server/studio";
import { actorFrom, projectsFrom } from "../lib/service.server";
import type { Route } from "./+types/studio";

export function meta({ data: d }: Route.MetaArgs) {
  return [{ title: `Studio${d?.project ? ` · ${d.project.name}` : ""} · ABAP` }];
}

/** Access: staff see every project; a guest only the projects that invited them (the gate already enforces it). */
function canOpen(context: Route.LoaderArgs["context"], projectId: string) {
  const a = context.user?.access;
  return a?.kind === "staff" || (a?.kind === "guest" && a.projects.includes(projectId));
}

export async function loader({ context, params, request }: Route.LoaderArgs) {
  const id = projectIdSchema.safeParse(params.projectId);
  if (!id.success || !canOpen(context, id.data)) throw data("Studio não encontrado", { status: 404 });
  const project = await projectsFrom(context).get(id.data);
  if (!project) throw data("Studio não encontrado", { status: 404 });
  const staff = context.user?.access?.kind === "staff";
  const svc = new StudioService(context.cloudflare.env.DB, systemClock, project.id);
  const artifacts = await svc.artifacts();
  const wanted = new URL(request.url).searchParams.get("artifact");
  const selected = artifacts.find((a) => a.slug === wanted) ?? artifacts[0] ?? null;
  return {
    project: { id: project.id, code: project.code, name: project.name },
    staff,
    artifacts: artifacts.map((a) => ({ slug: a.slug, title: a.title, description: a.description, notice: a.notice, revision: a.revision, publishedAt: a.publishedAt, publishedBy: staff ? a.publishedBy : null })),
    selected: selected ? { slug: selected.slug, title: selected.title, notice: selected.notice, url: await artifactUrl(context.cfg, selected, Date.now()) } : null,
    members: staff ? (await svc.members()).map((m) => ({ email: m.email, role: m.role, status: m.status, invitedAt: m.invitedAt, acceptedAt: m.acceptedAt })) : [],
  };
}

export async function action({ context, params, request }: Route.ActionArgs) {
  if (context.user?.access?.kind !== "staff") throw data("Só a equipe altera o studio.", { status: 403 });
  const id = projectIdSchema.safeParse(params.projectId);
  if (!id.success || !(await projectsFrom(context).get(id.data))) throw data("Studio não encontrado", { status: 404 });
  const svc = new StudioService(context.cloudflare.env.DB, systemClock, id.data);
  const form = await request.formData();
  const intent = String(form.get("intent"));
  const actor = actorFrom(context);
  try {
    if (intent === "invite") {
      const body = inviteSchema.safeParse({ email: form.get("email"), role: form.get("role") || "client" });
      if (!body.success) return { error: body.error.issues[0]?.message ?? "Dados inválidos." };
      const m = await svc.invite(body.data.email, body.data.role, actor, context.cfg.allowedEmails);
      return { ok: `Convite registrado para ${m.email}. A pessoa entra em ${new URL(request.url).origin}/login com a conta Google desse e-mail.` };
    }
    if (intent === "revoke") {
      const email = emailSchema.safeParse(form.get("email"));
      if (!email.success) return { error: "E-mail inválido." };
      await svc.revoke(email.data, actor);
      return { ok: `Acesso de ${email.data} revogado.` };
    }
    if (intent === "archive") {
      const slug = artifactSlugSchema.safeParse(form.get("slug"));
      if (!slug.success) return { error: "Artefato inválido." };
      await svc.archive(slug.data, actor);
      return redirect(`/studio/${id.data}`);
    }
  } catch (e) {
    if (e instanceof StudioError) return { error: e.message };
    throw e;
  }
  return { error: "Ação desconhecida." };
}

const STATUS_LABEL: Record<string, string> = { invited: "convidado", active: "ativo", revoked: "revogado" };
const ROLE_LABEL: Record<string, string> = { client: "cliente", consultant: "consultor(a)" };

export default function Studio({ loaderData: d, actionData }: Route.ComponentProps) {
  const busy = useNavigation().state !== "idle";
  return (
    <div className="space-y-4" data-component-id="pattern-studio">
      <header>
        <p className="meta-label">{d.project.code ?? "Plataforma"} · Studio</p>
        <h1 className="text-2xl font-semibold tracking-tight">Studio · {d.project.name}</h1>
        <p className="text-sm text-muted-foreground">Área compartilhada entre a consultoria e o cliente: protótipos e artefatos publicados do projeto.</p>
      </header>
      {actionData && "ok" in actionData && <p role="status" className="rounded-md border border-sel-border bg-sel p-2 text-sm">{actionData.ok}</p>}
      {actionData && "error" in actionData && <p role="alert" className="rounded-md border border-destructive p-2 text-sm text-destructive">{actionData.error}</p>}

      {d.artifacts.length === 0 ? (
        <Card>
          <CardTitle>Nenhum artefato publicado</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {d.staff ? (
              <>Publique pelo repositório: <code>npm run studio:publish -w @clients/{d.project.id}</code> (ferramenta MCP <code>abap_studio_publish</code>).</>
            ) : (
              "A equipe ainda não publicou nada neste studio."
            )}
          </p>
        </Card>
      ) : (
        <>
          <nav aria-label="Artefatos" className="flex flex-wrap gap-2" data-testid="studio-artifacts">
            {d.artifacts.map((a) => (
              <Link
                key={a.slug}
                to={`?artifact=${a.slug}`}
                aria-current={d.selected?.slug === a.slug ? "page" : undefined}
                className={`rounded-md border px-3 py-1.5 text-sm ${d.selected?.slug === a.slug ? "border-sel-border bg-sel font-medium" : "border-border bg-card hover:bg-accent"}`}
              >
                {a.title} <span className="font-mono text-xs text-muted-foreground">r{a.revision}</span>
              </Link>
            ))}
          </nav>
          {d.selected && (
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle>{d.selected.title}</CardTitle>
                  <p className="mt-1 rounded bg-warn px-2 py-1 text-sm text-warn-foreground" data-testid="studio-notice">
                    {d.selected.notice}
                  </p>
                </div>
                <div className="flex gap-2">
                  {d.selected.url && (
                    <a href={d.selected.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm hover:bg-accent">
                      Abrir em tela cheia
                    </a>
                  )}
                  {d.staff && (
                    <Form method="post">
                      <input type="hidden" name="intent" value="archive" />
                      <input type="hidden" name="slug" value={d.selected.slug} />
                      <Button type="submit" variant="outline" disabled={busy}>Arquivar</Button>
                    </Form>
                  )}
                </div>
              </div>
              {d.selected.url ? (
                <iframe
                  title={d.selected.title}
                  src={d.selected.url}
                  sandbox="allow-scripts allow-forms allow-popups allow-modals"
                  referrerPolicy="no-referrer"
                  className="mt-3 h-[900px] w-full rounded-md border border-border bg-background"
                  data-testid="studio-frame"
                />
              ) : (
                <p className="mt-3 text-sm text-destructive">Configuração incompleta: sem segredo de sessão para assinar o link do artefato.</p>
              )}
              {d.artifacts.find((a) => a.slug === d.selected!.slug)?.description && (
                <p className="mt-2 text-sm text-muted-foreground">{d.artifacts.find((a) => a.slug === d.selected!.slug)!.description}</p>
              )}
            </Card>
          )}
        </>
      )}

      {d.staff && (
        <Card>
          <CardTitle>Membros convidados</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Convidados entram com a conta Google do e-mail convidado e veem só este studio. A equipe (lista de acesso do app) não precisa de convite.
          </p>
          <Form method="post" className="mt-3 flex flex-wrap items-end gap-2" data-testid="studio-invite">
            <input type="hidden" name="intent" value="invite" />
            <div className="flex flex-col gap-1">
              <Label htmlFor="invite-email">E-mail</Label>
              <Input id="invite-email" name="email" type="email" required autoComplete="off" className="w-72" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="invite-role">Papel</Label>
              <select id="invite-role" name="role" className="h-9 rounded-md border border-input bg-card px-2 text-sm" defaultValue="client">
                <option value="client">Cliente</option>
                <option value="consultant">Consultor(a) externo(a)</option>
              </select>
            </div>
            <Button type="submit" disabled={busy}>Convidar</Button>
          </Form>
          {d.members.length > 0 && (
            <table className="mt-3 w-full text-sm" data-testid="studio-members">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 font-medium">E-mail</th>
                  <th className="py-1 font-medium">Papel</th>
                  <th className="py-1 font-medium">Status</th>
                  <th className="py-1 font-medium"><span className="sr-only">Ação</span></th>
                </tr>
              </thead>
              <tbody>
                {d.members.map((m) => (
                  <tr key={m.email} className="border-t border-border">
                    <td className="py-1.5 font-mono text-xs">{m.email}</td>
                    <td className="py-1.5">{ROLE_LABEL[m.role] ?? m.role}</td>
                    <td className="py-1.5">{STATUS_LABEL[m.status] ?? m.status}</td>
                    <td className="py-1.5 text-right">
                      {m.status !== "revoked" && (
                        <Form method="post">
                          <input type="hidden" name="intent" value="revoke" />
                          <input type="hidden" name="email" value={m.email} />
                          <Button type="submit" variant="outline" size="sm" disabled={busy}>Revogar</Button>
                        </Form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </div>
  );
}
