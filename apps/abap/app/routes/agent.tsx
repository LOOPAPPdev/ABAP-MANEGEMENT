import { Form, useNavigation } from "react-router";
import { Button } from "~/components/ui/button";
import { Card, CardTitle } from "~/components/ui/card";
import { ClientAgentService, diffFiles } from "~/server/client-agents";
import { systemClock } from "~/server/governance-service";
import { actorFrom, modelsFrom, projectFrom } from "../lib/service.server";
import type { Route } from "./+types/agent";

export function meta() {
  return [{ title: "Agente do cliente · ABAP" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const project = await projectFrom(context, request);
  const svc = new ClientAgentService(context.cloudflare.env.DB, systemClock, project);
  const agent = await svc.get();
  const previous = agent && agent.revision > 1 ? await svc.get(agent.revision - 1) : null;
  return {
    project: { id: project.id, code: project.code, name: project.name },
    agent,
    diff: agent ? diffFiles(previous?.files, agent.files) : null,
    history: await svc.history(),
    models: (await modelsFrom(context, project).list()).map((m) => ({ id: m.id, kind: m.kind })),
  };
}

export async function action({ context, request }: Route.ActionArgs) {
  const project = await projectFrom(context, request);
  const { agent, changed } = await new ClientAgentService(context.cloudflare.env.DB, systemClock, project).generate(actorFrom(context));
  return { ok: changed ? `Agente gerado: ${agent.name} v${agent.version}.` : `Nada mudou desde a v${agent.version}: nenhuma revisão nova foi criada.` };
}

export default function Agent({ loaderData: d, actionData }: Route.ComponentProps) {
  const busy = useNavigation().state !== "idle";
  const a = d.agent;
  return (
    <div className="space-y-4" data-component-id="pattern-client-agent">
      <header>
        <p className="meta-label">{d.project.code ?? "Plataforma"} · Fábrica de agentes</p>
        <h1 className="text-2xl font-semibold tracking-tight">Agente do cliente · {d.project.name}</h1>
        <p className="text-sm text-muted-foreground">
          Gera o plugin do Claude deste cliente a partir dos modelos e das atividades do projeto: uma skill de contexto, dois subagentes (analista de entregáveis e especialista em processos) e um comando de status.
        </p>
      </header>
      {actionData && "ok" in actionData && <p role="status" className="rounded-md border border-sel-border bg-sel p-2 text-sm">{actionData.ok}</p>}

      <Card>
        <CardTitle>{a ? `${a.name} · v${a.version}` : "Ainda não gerado"}</CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          Fontes: {d.models.length === 0 ? "nenhum modelo (importe em Modelos para um contexto útil)" : d.models.map((m) => m.id).join(", ")} + 14 atividades.
          {a && ` Gerado em ${a.createdAt.slice(0, 16).replace("T", " ")} por ${a.createdBy}.`}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Form method="post"><Button type="submit" disabled={busy}>{a ? "Atualizar agente" : "Gerar agente"}</Button></Form>
          {a && <a href="/agent.zip" className="inline-flex h-9 items-center rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm hover:bg-accent" download>Baixar .zip</a>}
        </div>
        {a && (
          <p className="mt-3 text-xs text-muted-foreground">
            No repositório: <code>npm run plugin:pull -w @clients/{d.project.id}</code> grava em <code>clients/{d.project.id}/plugin/</code> e registra no marketplace. Os arquivos não são editados à mão.
          </p>
        )}
      </Card>

      {a && d.diff && (
        <Card>
          <CardTitle>Arquivos ({a.files.length})</CardTitle>
          {a.revision > 1 && (
            <p className="mt-1 text-sm" data-testid="agent-diff">
              Desde a revisão anterior: {d.diff.changed.length} alterado(s), {d.diff.added.length} novo(s), {d.diff.removed.length} removido(s).
            </p>
          )}
          <div className="mt-2 space-y-2" data-testid="agent-files">
            {a.files.map((f) => (
              <details key={f.path} className="rounded-md border border-border">
                <summary className="cursor-pointer px-3 py-2 font-mono text-xs">
                  {f.path}
                  {d.diff!.changed.includes(f.path) && a.revision > 1 && <span className="ml-2 rounded bg-warn px-1.5 py-0.5 font-sans text-warn-foreground">alterado</span>}
                  {d.diff!.added.includes(f.path) && a.revision > 1 && <span className="ml-2 rounded bg-sel px-1.5 py-0.5 font-sans">novo</span>}
                </summary>
                <pre className="max-h-96 overflow-auto border-t border-border bg-note p-3 font-mono text-xs whitespace-pre-wrap">{f.content}</pre>
              </details>
            ))}
          </div>
        </Card>
      )}

      {d.history.length > 0 && (
        <Card>
          <CardTitle>Revisões</CardTitle>
          <ul className="mt-2 space-y-1 text-sm">
            {d.history.map((h) => (
              <li key={h.revision}><span className="font-mono text-xs">v{h.version}</span> · {h.createdAt.slice(0, 16).replace("T", " ")} · {h.createdBy} · fábrica v{h.generator}</li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
