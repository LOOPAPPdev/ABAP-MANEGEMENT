import { Link } from "react-router";
import { FlagBadge, ProgressBar } from "~/components/governance/badges";
import { Card, CardTitle } from "~/components/ui/card";
import { pct } from "~/lib/utils";
import { actorFrom, serviceFrom, syncFrom } from "../lib/service.server";
import type { Route } from "./+types/dashboard";

export function meta() {
  return [{ title: "Dashboard · Governance System" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  // Automatic mode: read the spreadsheet when the dashboard opens (at most every 30 s; ?sync=1 forces it).
  const sync = await syncFrom(context).autoSyncIfDue(actorFrom(context), new URL(request.url).searchParams.has("sync"));
  const banner = sync && {
    applied: sync.result ? sync.result.applied.changes + sync.result.applied.evidence : 0,
    conflicts: sync.result?.skippedConflicts.length ?? 0,
    invalid: sync.result ? sync.result.plan.issues.length + sync.result.invalidEvidence.length : 0,
    error: sync.error ?? null,
    notConnected: Boolean(sync.notConnected),
  };
  return { dashboard: await serviceFrom(context).dashboard(), banner };
}

function SyncBanner({ b }: { b: NonNullable<Route.ComponentProps["loaderData"]["banner"]> }) {
  const text = b.notConnected
    ? "Planilha ainda não conectada: os dados mostrados são os do app."
    : b.error
      ? `Não foi possível ler a planilha: ${b.error}`
      : `Planilha lida agora: ${b.applied} alteração(ões) aplicada(s)` +
        (b.conflicts ? `, ${b.conflicts} conflito(s) aguardando decisão` : "") +
        (b.invalid ? `, ${b.invalid} célula(s) inválida(s)` : "") +
        ".";
  return (
    <p role="status" data-component-id="sync-banner" data-testid="sync-banner" className={`rounded border p-2 text-sm ${b.error && !b.notConnected ? "border-destructive text-destructive" : "border-border bg-card"}`}>
      {text} <Link className="text-primary underline" to="/sheets">Ver planilha</Link>
    </p>
  );
}

export default function Dashboard({ loaderData }: Route.ComponentProps) {
  const { overall, byArea, flags, nextGate } = loaderData.dashboard;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link to="/dashboard?sync=1" className="rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-accent" preventScrollReset>
          Recarregar dados
        </Link>
      </div>
      {loaderData.banner && <SyncBanner b={loaderData.banner} />}
      <p className="text-sm text-muted-foreground">
        Calculated on the server. An activity counts as done only when status is DONE and evidence exists.
      </p>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardTitle>Progress</CardTitle>
          <p className="my-2 text-3xl font-bold" data-testid="overall-progress">
            {pct(overall.ratio)}
          </p>
          <ProgressBar ratio={overall.ratio} label="Overall progress" />
          <p className="mt-2 text-sm text-muted-foreground">
            {overall.done} of {overall.total} activities effectively done
          </p>
        </Card>
        <Card>
          <CardTitle>Flags</CardTitle>
          {flags.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No flags.</p>
          ) : (
            <ul className="mt-2 space-y-1" data-testid="flag-list">
              {flags.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-2 text-sm">
                  <Link className="text-primary underline" to={`/activities/${f.id}`}>
                    {f.id}
                  </Link>
                  <FlagBadge flag={f.flag} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardTitle>Next gate</CardTitle>
          {nextGate ? (
            <>
              <p className="mt-2 font-semibold">{nextGate.phase}</p>
              <p className="text-sm text-muted-foreground">
                Open:{" "}
                {nextGate.openIds.map((id) => (
                  <Link key={id} className="mr-2 text-primary underline" to={`/activities/${id}`}>
                    {id}
                  </Link>
                ))}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm">All gates passed.</p>
          )}
        </Card>
      </div>

      <section aria-labelledby="areas">
        <h2 id="areas" className="mb-3 text-lg font-semibold">
          Areas
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {byArea.map((a) => (
            <li key={a.area}>
              <Link to={`/activities?area=${encodeURIComponent(a.area)}`} className="block">
                <Card className="hover:border-primary">
                  <div className="flex items-baseline justify-between">
                    <CardTitle>{a.area}</CardTitle>
                    <span className="text-sm font-semibold">{pct(a.ratio)}</span>
                  </div>
                  <div className="my-2">
                    <ProgressBar ratio={a.ratio} label={`${a.area} progress`} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {a.done}/{a.total} done · {a.inProgress} in progress · {a.blocked} blocked ·{" "}
                    {a.gatePassed ? "gate passed" : "gate open"}
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
