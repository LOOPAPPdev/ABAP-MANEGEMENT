import { Form, Link } from "react-router";
import { FlagBadge, StatusBadge } from "~/components/governance/badges";
import { Button } from "~/components/ui/button";
import { Label, Select } from "~/components/ui/input";
import { AREAS, FLAGS } from "~/domain/governance";
import { projectFrom, serviceFrom } from "../lib/service.server";
import type { Route } from "./+types/activities";

export function meta() {
  return [{ title: "Activities · Governance System" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const area = url.searchParams.get("area") ?? "";
  const flag = url.searchParams.get("flag") ?? "";
  const all = await serviceFrom(context, await projectFrom(context, request)).listEvaluated();
  const activities = all.filter((a) => (!area || a.area === area) && (!flag || a.flag === flag));
  return { activities, area, flag };
}

export default function Activities({ loaderData }: Route.ComponentProps) {
  const { activities, area, flag } = loaderData;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Activities</h1>
      <Form method="get" className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="area">Area</Label>
          <Select id="area" name="area" defaultValue={area}>
            <option value="">All areas</option>
            {AREAS.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="flag">Flag</Label>
          <Select id="flag" name="flag" defaultValue={flag}>
            <option value="">Any</option>
            {FLAGS.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </Form>

      <div className="overflow-x-auto rounded-md border border-border bg-card">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Governance activities</caption>
          <thead className="bg-muted text-secondary-foreground">
            <tr>
              <th scope="col" className="p-2">ID</th>
              <th scope="col" className="p-2">Activity</th>
              <th scope="col" className="p-2">Area</th>
              <th scope="col" className="p-2">Depends on</th>
              <th scope="col" className="p-2">Status</th>
              <th scope="col" className="p-2">Evidence</th>
              <th scope="col" className="p-2">Flag</th>
            </tr>
          </thead>
          <tbody>
            {activities.map((a) => (
              <tr key={a.id} className="border-t border-border">
                <td className="p-2 font-mono">
                  <Link className="text-primary underline" to={`/activities/${a.id}`}>
                    {a.id}
                  </Link>
                </td>
                <td className="p-2">{a.title}</td>
                <td className="p-2">{a.area}</td>
                <td className="p-2 font-mono">{a.dependencyId ?? "—"}</td>
                <td className="p-2"><StatusBadge status={a.status} /></td>
                <td className="p-2">{a.evidenceCount}</td>
                <td className="p-2"><FlagBadge flag={a.flag} /></td>
              </tr>
            ))}
            {activities.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-muted-foreground">No activities match the filter.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
