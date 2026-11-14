import { Link } from "react-router";
import { Card, CardTitle } from "~/components/ui/card";
import { getDb } from "~/server/db/client";
import { sheetsConnection } from "~/server/sheets/sources";
import { projectFrom, syncFrom } from "../lib/service.server";
import { spreadsheetIdFor } from "~/server/sheets/factory";
import type { Route } from "./+types/settings";

export function meta() {
  return [{ title: "Settings · Governance System" }];
}

const AUTH: Record<string, string> = {
  google: "Login com Google (lista de e-mails autorizados)",
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
    allowedCount: cfg.allowedEmails.length,
    spreadsheetUrl: sheetId ? `https://docs.google.com/spreadsheets/d/${sheetId}/edit` : null,
    project: { id: current.id, code: current.code, name: current.name },
    range: cfg.sheetRange,
    connection: await sheetsConnection(getDb(context.cloudflare.env.DB)),
    mode: await syncFrom(context, current).getMode(),
  };
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[200px_1fr]">
      <dt className="text-sm font-semibold text-secondary-foreground">{k}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export default function Settings({ loaderData: d }: Route.ComponentProps) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Settings</h1>
      <Card>
        <CardTitle>Acesso</CardTitle>
        <dl className="mt-2 space-y-2">
          <Row k="Ambiente">{d.environment}</Row>
          <Row k="Autenticação">{AUTH[d.auth]}</Row>
          <Row k="Usuário">{d.user?.mode === "google" ? d.user.email : "—"}</Row>
          <Row k="Contas autorizadas">{d.auth === "google" ? `${d.allowedCount} (lista no segredo ALLOWED_EMAILS da Cloudflare)` : "—"}</Row>
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
        {d.auth === "google" && (
          <a href="/auth/sheets/connect?returnTo=%2Fsheets" className="mt-3 inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-brand-fg">
            {d.connection ? "Reconectar Google (Sheets + Drive)" : "Conectar Google (Sheets + Drive)"}
          </a>
        )}
      </Card>
    </div>
  );
}
