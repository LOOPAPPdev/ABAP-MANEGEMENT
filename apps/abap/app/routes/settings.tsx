import { data, Form, Link, useNavigation } from "react-router";
import { Button } from "~/components/ui/button";
import { Input, Label, Select } from "~/components/ui/input";
import { systemClock } from "~/server/governance-service";
import { newTokenSchema, TokenService } from "~/server/tokens";
import { Card, CardTitle } from "~/components/ui/card";
import { getDb } from "~/server/db/client";
import { sheetsConnection } from "~/server/sheets/sources";
import { actorFrom, projectFrom, syncFrom } from "../lib/service.server";
import { spreadsheetIdFor } from "~/server/sheets/factory";
import type { Route } from "./+types/settings";

export function meta() {
  return [{ title: "Settings · Governance System" }];
}

const AUTH: Record<string, string> = {
  public: "Acesso público sem login (qualquer visitante pode alterar dados)",
  password: "Login com senha própria (sem Google)",
  "dev-bypass": "Modo local sem login (desenvolvimento)",
  misconfigured: "Login não configurado: acesso bloqueado",
};

export async function loader({ context, request }: Route.LoaderArgs) {
  const current = await projectFrom(context, request);
  const sheetId = spreadsheetIdFor(context.cfg, current);
  const cfg = context.cfg;
  return {
    user: context.user,
    environment: cfg.environment,
    auth: cfg.auth,
    googleConfigured: !!cfg.google && !!cfg.tokenKey,
    allowedCount: cfg.allowedEmails.length,
    spreadsheetUrl: sheetId ? `https://docs.google.com/spreadsheets/d/${sheetId}/edit` : null,
    project: { id: current.id, code: current.code, name: current.name },
    range: cfg.sheetRange,
    connection: await sheetsConnection(getDb(context.cloudflare.env.DB)),
    mode: await syncFrom(context, current).getMode(),
    tokens: await new TokenService(context.cloudflare.env.DB, systemClock).list(),
    mcpUrl: `${new URL(request.url).origin}/mcp`,
  };
}

/** Personal API tokens (ADR-009). Only interactive users (Google session or local dev) manage tokens. */
export async function action({ context, request }: Route.ActionArgs) {
  if (!context.user || (context.user.mode !== "public" && context.user.mode !== "password" && context.user.mode !== "dev")) return data({ error: "Apenas usuários com login gerenciam tokens." }, { status: 403 });
  const svc = new TokenService(context.cloudflare.env.DB, systemClock);
  const form = Object.fromEntries(await request.formData()) as Record<string, string>;
  if (form.intent === "token.create") {
    const input = newTokenSchema.safeParse({ name: form.name, role: form.role });
    if (!input.success) return data({ error: input.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
    const { token, info } = await svc.create(input.data, actorFrom(context));
    // The plaintext is returned once, in this response only. It is never stored or logged.
    return { created: { token, name: info.name, role: info.role } };
  }
  if (form.intent === "token.revoke") {
    const ok = await svc.revoke(form.id ?? "", actorFrom(context));
    return ok ? { ok: "Token revogado. Ele deixa de funcionar imediatamente." } : data({ error: "Token não encontrado ou já revogado." }, { status: 404 });
  }
  return data({ error: "Ação desconhecida." }, { status: 400 });
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[200px_1fr]">
      <dt className="text-sm font-semibold text-secondary-foreground">{k}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export default function Settings({ loaderData: d, actionData }: Route.ComponentProps) {
  const busy = useNavigation().state !== "idle";
  const created = actionData && "created" in actionData ? actionData.created : null;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Settings</h1>
      <Card>
        <CardTitle>Acesso</CardTitle>
        <dl className="mt-2 space-y-2">
          <Row k="Ambiente">{d.environment}</Row>
          <Row k="Autenticação">{AUTH[d.auth]}</Row>
          <Row k="Usuário">{d.user?.mode === "password" ? d.user.email : "—"}</Row>
          <Row k="Contas autorizadas">{"—"}</Row>
        </dl>
      </Card>
      <Card>
        <CardTitle>Google (Sheets e Drive) · projeto {d.project.code ?? d.project.name}</CardTitle>
        <dl className="mt-2 space-y-2">
          <Row k="Planilha">{d.spreadsheetUrl ? <a className="text-primary underline" href={d.spreadsheetUrl} target="_blank" rel="noreferrer">Abrir no Google Sheets</a> : "SPREADSHEET_ID não configurado"}</Row>
          <Row k="Intervalo lido">{d.range}</Row>
          <Row k="Conexão">{d.connection ? `Conectada por ${d.connection.email} em ${new Date(d.connection.updatedAt).toLocaleString("pt-BR")}` : "Não conectada"}</Row>
          <Row k="Permissões concedidas">
            <span data-testid="google-scopes">
              Sheets (leitura): {d.connection?.scope.includes("spreadsheets") || d.connection?.scope.includes("/auth/drive") ? "✓ sim" : "✗ não"} · Drive (leitura e escrita):{" "}
              {d.connection?.scope.split(/\s+/).includes("https://www.googleapis.com/auth/drive") ? "✓ sim" : "✗ não — reconecte para liberar"}
            </span>
          </Row>
          <Row k="Modo de sincronização">
            {d.mode === "auto" ? "Automático ao abrir" : "Prévia + Aplicar"} · <Link className="text-primary underline" to="/sheets">alterar na página Planilha</Link>
          </Row>
        </dl>
        {(d.auth === "password" && d.googleConfigured) && (
          <a href="/auth/sheets/connect?returnTo=%2Fsheets" className="mt-3 inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            {d.connection ? "Reconectar Google (Sheets + Drive)" : "Conectar Google (Sheets + Drive)"}
          </a>
        )}
      </Card>
      <Card data-component-id="pattern-api-tokens">
        <CardTitle>Tokens de API · Claude (MCP)</CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          Cada pessoa cria o seu token para conectar o Claude ao ABAP pelo plugin <code>abap</code>. Endereço do MCP: <code data-testid="mcp-url">{d.mcpUrl}</code>
        </p>
        {actionData && "error" in actionData && <p role="alert" className="mt-2 rounded-md border border-destructive p-2 text-sm text-destructive-strong">{actionData.error}</p>}
        {actionData && "ok" in actionData && <p role="status" className="mt-2 rounded-md border border-sel-border bg-sel p-2 text-sm">{actionData.ok}</p>}
        {created && (
          <div role="status" className="mt-2 space-y-2 rounded-md border border-warn-border bg-warn p-3 text-sm text-warn-foreground" data-testid="token-created">
            <p className="font-medium">Copie agora: este token não será mostrado de novo.</p>
            <pre className="overflow-x-auto rounded-md bg-card p-2 font-mono text-xs text-foreground" data-testid="token-value">{created.token}</pre>
            <p>No seu computador, guarde em uma variável de ambiente (nunca no Git nem no chat):</p>
            <pre className="overflow-x-auto rounded-md bg-card p-2 font-mono text-xs text-foreground">export ABAP_TOKEN=&quot;{created.token}&quot;</pre>
          </div>
        )}
        <Form method="post" className="mt-3 flex flex-wrap items-end gap-2">
          <input type="hidden" name="intent" value="token.create" />
          <div className="space-y-1">
            <Label htmlFor="token-name">Nome do token</Label>
            <Input id="token-name" name="name" placeholder="joao-laptop" required pattern="[a-z0-9][a-z0-9-]{1,39}" className="w-56" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="token-role">Permissão</Label>
            <Select id="token-role" name="role" defaultValue="write" className="w-56">
              <option value="write">Leitura e escrita</option>
              <option value="read">Só leitura</option>
            </Select>
          </div>
          <Button type="submit" disabled={busy}>Criar token</Button>
        </Form>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm" data-testid="token-list">
            <caption className="sr-only">Tokens de API</caption>
            <thead className="text-left text-muted-foreground"><tr><th className="py-1 pr-3">Nome</th><th className="pr-3">Permissão</th><th className="pr-3">Dono</th><th className="pr-3">Início do token</th><th className="pr-3">Último uso</th><th className="pr-3">Situação</th><th /></tr></thead>
            <tbody>
              {d.tokens.length === 0 && <tr><td colSpan={7} className="py-2 text-muted-foreground">Nenhum token criado.</td></tr>}
              {d.tokens.map((t) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="py-1.5 pr-3 font-medium">{t.name}</td>
                  <td className="pr-3">{t.role === "write" ? "Leitura e escrita" : "Só leitura"}</td>
                  <td className="pr-3">{t.owner}</td>
                  <td className="pr-3 font-mono text-xs">{t.prefix}…</td>
                  <td className="pr-3">{t.lastUsedAt ? t.lastUsedAt.slice(0, 16).replace("T", " ") : "nunca"}</td>
                  <td className="pr-3">{t.revokedAt ? `Revogado em ${t.revokedAt.slice(0, 10)}` : "Ativo"}</td>
                  <td className="text-right">
                    {!t.revokedAt && (
                      <Form method="post">
                        <input type="hidden" name="intent" value="token.revoke" />
                        <input type="hidden" name="id" value={t.id} />
                        <Button type="submit" variant="outline" size="sm" disabled={busy} aria-label={`Revogar ${t.name}`}>Revogar</Button>
                      </Form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
