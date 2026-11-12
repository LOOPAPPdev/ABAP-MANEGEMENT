import { Link } from "react-router";
import { FlagBadge, ProgressBar } from "~/components/governance/badges";
import { Card, CardTitle } from "~/components/ui/card";
import { pct } from "~/lib/utils";
import { serviceFrom } from "../lib/service.server";
import type { Route } from "./+types/dashboard";

export function meta() {
  return [{ title: "Dashboard · Governance System" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  return { dashboard: await serviceFrom(context).dashboard() };
}

export default function Dashboard({ loaderData }: Route.ComponentProps) {
  const { overall, byArea, flags, nextGate } = loaderData.dashboard;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
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
