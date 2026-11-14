import { Link } from "react-router";
import { projectFrom, serviceFrom } from "../lib/service.server";
import type { Route } from "./+types/evidence";

export function meta() {
  return [{ title: "Evidence · Governance System" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  return { evidence: await serviceFrom(context, await projectFrom(context, request)).listEvidence() };
}

export default function Evidence({ loaderData }: Route.ComponentProps) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Evidence</h1>
      <p className="text-sm text-muted-foreground">All evidence records, newest first. Add evidence on an activity page.</p>
      <ul className="space-y-2">
        {loaderData.evidence.length === 0 && <li className="text-muted-foreground">No evidence recorded yet.</li>}
        {loaderData.evidence.map((e) => (
          <li key={e.id} className="rounded-md border border-border bg-card p-3 text-sm">
            <Link className="font-mono text-primary underline" to={`/activities/${e.activityId}`}>{e.activityId}</Link>{" "}
            · <strong>{e.kind}</strong> · <span className="break-all">{e.ref}</span>
            <div className="text-xs text-muted-foreground">{e.createdBy} · {e.createdAt}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
