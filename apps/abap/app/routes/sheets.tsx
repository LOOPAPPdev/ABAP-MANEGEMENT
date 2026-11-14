import { data, Form, Link, useNavigation } from "react-router";
import { Button } from "~/components/ui/button";
import { Card, CardTitle } from "~/components/ui/card";
import { SYNC_MODES, type FieldChange, type SyncMode } from "~/domain/governance";
import { conflictKey, type SyncPreview, type SyncResult } from "~/server/sheets/sync-service";
import { sheetsConnection, SheetsNotConnectedError } from "~/server/sheets/sources";
import { getDb } from "~/server/db/client";
import { actorFrom, syncFrom } from "../lib/service.server";
import type { Route } from "./+types/sheets";

export function meta() {
  return [{ title: "Planilha · Governance System" }];
}

const FIELD: Record<string, string> = { status: "Status", priority: "Priority", owner: "Owner", due: "Due", notes: "Notes" };
const MODE_LABEL: Record<SyncMode, string> = { auto: "Automático ao abrir", preview: "Prévia + Aplicar" };

export async function loader({ context, request }: Route.LoaderArgs) {
  const svc = syncFrom(context);
  const cfg = context.cfg;
  const mode = await svc.getMode();
  const base = {
    mode,
    sourceKind: cfg.auth === "dev-bypass" ? ("fixture" as const) : ("google" as const),
    canConnect: cfg.auth === "google",
    spreadsheetUrl: cfg.spreadsheetId ? `https://docs.google.com/spreadsheets/d/${cfg.spreadsheetId}/edit` : null,
    connection: await sheetsConnection(getDb(context.cloudflare.env.DB)),
    connected: new URL(request.url).searchParams.has("connected"),
  };
  try {
    if (mode === "auto") {
      // "Atualizar ao abrir a página": always read on open in automatic mode.
      const r = await svc.sync({ mode: "auto", actor: actorFrom(context) });
      return { ...base, view: r as SyncPreview | SyncResult, error: null, notConnected: false };
    }
    return { ...base, view: (await svc.preview()) as SyncPreview | SyncResult, error: null, notConnected: false };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const notConnected = e instanceof SheetsNotConnectedError;
    if (!notConnected) await svc.recordFailure(mode === "auto" ? "auto" : "manual", actorFrom(context), message);
    return { ...base, view: null, error: message, notConnected };
  }
}

export async function action({ context, request }: Route.ActionArgs) {
  const form = await request.formData();
  const svc = syncFrom(context);
  const intent = form.get("intent");
  if (intent === "mode") {
    const mode = String(form.get("mode"));
    if (!(SYNC_MODES as readonly string[]).includes(mode)) return data({ error: "Modo inválido." }, { status: 400 });
    await svc.setMode(mode as SyncMode, actorFrom(context));
    return { ok: true };
  }
  if (intent === "apply") {
    const resolve = form.getAll("resolve").map(String).filter((k) => /^ACT-\d{2}:(status|priority|owner|due|notes)$/.test(k));
    try {
      const r = await svc.sync({ mode: "manual", actor: actorFrom(context), resolve });
      return { ok: true, applied: r.applied.changes + r.applied.evidence };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await svc.recordFailure("manual", actorFrom(context), message);
      return data({ error: message }, { status: 502 });
    }
  }
  return data({ error: "Ação desconhecida." }, { status: 400 });
}

function ChangeTable({ items, caption, selectable }: { items: FieldChange[]; caption: string; selectable?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-muted text-secondary-foreground">
          <tr>
            {selectable && <th scope="col" className="p-2">Usar planilha?</th>}
            <th scope="col" className="p-2">Atividade</th>
            <th scope="col" className="p-2">Campo</th>
            <th scope="col" className="p-2">App</th>
            <th scope="col" className="p-2">Planilha</th>
            {selectable && <th scope="col" className="p-2">Última leitura</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr key={conflictKey(c)} className="border-t border-border">
              {selectable && (
                <td className="p-2">
                  <input type="checkbox" name="resolve" value={conflictKey(c)} aria-label={`Usar valor da planilha em ${c.activityId} ${FIELD[c.field]}`} />
                </td>
              )}
              <td className="p-2 font-mono">
                <Link className="text-primary underline" to={`/activities/${c.activityId}`}>{c.activityId}</Link>
              </td>
              <td className="p-2">{FIELD[c.field]}</td>
              <td className="p-2">{c.from || "—"}</td>
              <td className="p-2 font-semibold">{c.to || "—"}</td>
              {selectable && <td className="p-2 text-muted-foreground">{c.base ?? "—"}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Sheets({ loaderData: d, actionData }: Route.ComponentProps) {
  const busy = useNavigation().state !== "idle";
  const v = d.view;
  const result = v && "applied" in v ? v : null;
  const pending = v ? (result ? [] : v.plan.changes) : [];
  const conflicts = v ? (result ? result.skippedConflicts : v.plan.conflicts) : [];
  const evidence = v?.plan.evidence ?? [];
  return (
    <div className="space-y-5" data-component-id="pattern-sheet-sync">
      <header>
        <h1 className="text-2xl font-bold">Planilha (Google Sheets → app)</h1>
        <p className="text-sm text-muted-foreground">
          Leitura somente da aba DATA_Activities, colunas Status, Priority, Owner, Due, Evidence e Notes. O app nunca escreve na planilha.
          {d.spreadsheetUrl && (
            <>
              {" "}
              <a className="text-primary underline" href={d.spreadsheetUrl} target="_blank" rel="noreferrer">Abrir planilha</a>
            </>
          )}
        </p>
      </header>

      {d.connected && <p role="status" className="rounded border border-border bg-brand-tint p-2 text-sm">Google Sheets conectado.</p>}
      {actionData && "error" in actionData && <p role="alert" className="rounded border border-destructive p-2 text-sm text-destructive">{actionData.error}</p>}
      {actionData && "applied" in actionData && <p role="status" className="rounded border border-border bg-brand-tint p-2 text-sm" data-testid="apply-result">{actionData.applied} alteração(ões) aplicada(s).</p>}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Form method="post" className="flex flex-wrap items-center gap-2" data-component-id="sync-mode-toggle" aria-label="Modo de sincronização">
            <input type="hidden" name="intent" value="mode" />
            <span className="text-sm font-semibold">Modo:</span>
            {SYNC_MODES.map((m) => (
              <Button key={m} type="submit" name="mode" value={m} size="sm" variant={d.mode === m ? "default" : "outline"} aria-pressed={d.mode === m} disabled={busy}>
                {d.mode === m ? "✓ " : ""}
                {MODE_LABEL[m]}
              </Button>
            ))}
          </Form>
          <Button asChild variant="outline" size="sm">
            <Link to="/sheets" reloadDocument={false} preventScrollReset>Recarregar da planilha</Link>
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground" data-testid="sheet-source">
          Fonte: {v?.source.label ?? (d.sourceKind === "fixture" ? "Fixture local (desenvolvimento)" : "Google Sheets")}
          {v && ` · lida em ${new Date(v.readAt).toLocaleString("pt-BR")} · ${v.rowCount} linhas`}
          {d.connection && ` · conectada por ${d.connection.email}`}
        </p>
      </Card>

      {d.error && (
        <Card className="border-destructive">
          <CardTitle>{d.notConnected ? "Planilha não conectada" : "Falha ao ler a planilha"}</CardTitle>
          <p className="mt-1 text-sm" role="alert">{d.error}</p>
          {d.canConnect && (
            <a href="/auth/sheets/connect?returnTo=%2Fsheets" className="mt-3 inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-brand-fg">
              Conectar Google Sheets
            </a>
          )}
        </Card>
      )}

      {v && (
        <>
          {result && (
            <p role="status" className="text-sm" data-testid="auto-result">
              Leitura automática: <strong>{result.applied.changes + result.applied.evidence}</strong> alteração(ões) aplicada(s) agora.
            </p>
          )}
          {!result && (
            <Form method="post">
              <input type="hidden" name="intent" value="apply" />
              <Card>
                <CardTitle>Alterações da planilha a aplicar ({pending.length + evidence.length})</CardTitle>
                {pending.length > 0 ? <ChangeTable items={pending} caption="Alterações a aplicar" /> : <p className="mt-1 text-sm text-muted-foreground">Nenhuma alteração de campo.</p>}
                {evidence.length > 0 && (
                  <ul className="mt-2 text-sm">
                    {evidence.map((e) => <li key={e.activityId + e.ref}>+ evidência em <span className="font-mono">{e.activityId}</span>: <span className="break-all">{e.ref}</span></li>)}
                  </ul>
                )}
                {conflicts.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-semibold">Conflitos ({conflicts.length}): alterados no app e na planilha</h3>
                    <ChangeTable items={conflicts} caption="Conflitos" selectable />
                  </div>
                )}
                <Button type="submit" className="mt-4" disabled={busy || pending.length + evidence.length + conflicts.length === 0}>
                  Aplicar no app
                </Button>
              </Card>
            </Form>
          )}
          {result && conflicts.length > 0 && (
            <Card>
              <CardTitle>Conflitos não aplicados ({conflicts.length})</CardTitle>
              <p className="text-sm text-muted-foreground">O modo automático nunca sobrescreve uma alteração feita no app. Troque para “Prévia + Aplicar” para decidir.</p>
              <ChangeTable items={conflicts} caption="Conflitos" />
            </Card>
          )}
          {(v.plan.issues.length > 0 || v.invalidEvidence.length > 0) && (
            <Card>
              <CardTitle>Células inválidas na planilha ({v.plan.issues.length + v.invalidEvidence.length})</CardTitle>
              <ul className="mt-1 space-y-1 text-sm" data-testid="sheet-issues">
                {v.plan.issues.map((i) => <li key={`${i.id}${i.field}${i.row}`}><span className="font-mono">{i.id}</span> · {i.field} “{i.value}”: {i.message}</li>)}
                {v.invalidEvidence.map((i) => <li key={i.activityId + i.ref}><span className="font-mono">{i.activityId}</span> · Evidence “{i.ref}”: {i.message}</li>)}
              </ul>
            </Card>
          )}
          {(v.plan.unknownIds.length > 0 || v.plan.missingIds.length > 0) && (
            <p className="text-sm text-muted-foreground">
              {v.plan.unknownIds.length > 0 && `IDs só na planilha (ignorados): ${v.plan.unknownIds.join(", ")}. `}
              {v.plan.missingIds.length > 0 && `IDs ausentes da planilha: ${v.plan.missingIds.join(", ")}.`}
            </p>
          )}
        </>
      )}
    </div>
  );
}
