import { data, Form, Link, useNavigation } from "react-router";
import { FlagBadge, StatusBadge } from "~/components/governance/badges";
import { Button } from "~/components/ui/button";
import { Card, CardTitle } from "~/components/ui/card";
import { Input, Label, Select } from "~/components/ui/input";
import { EVIDENCE_KINDS, STATUSES } from "~/domain/governance";
import { activityIdSchema, evidenceInputSchema, statusChangeSchema } from "~/server/api/schemas";
import { NotFoundError } from "~/server/governance-service";
import { serviceFrom, UI_ACTOR } from "../lib/service.server";
import type { Route } from "./+types/activity";

export function meta({ data }: Route.MetaArgs) {
  return [{ title: `${data?.activity.id ?? "Activity"} · Governance System` }];
}

async function load(context: Route.LoaderArgs["context"], rawId: string | undefined) {
  const id = activityIdSchema.safeParse(rawId);
  if (!id.success) throw data("Not found", { status: 404 });
  try {
    return await serviceFrom(context).getActivity(id.data);
  } catch (e) {
    if (e instanceof NotFoundError) throw data("Not found", { status: 404 });
    throw e;
  }
}

export async function loader({ context, params }: Route.LoaderArgs) {
  return load(context, params.id);
}

export async function action({ context, params, request }: Route.ActionArgs) {
  const { activity } = await load(context, params.id);
  const form = Object.fromEntries(await request.formData());
  const service = serviceFrom(context);

  if (form.intent === "status") {
    const parsed = statusChangeSchema.safeParse(form);
    if (!parsed.success) return data({ intent: "status", errors: parsed.error.issues.map((i) => i.message) }, { status: 400 });
    const result = await service.changeStatus(activity.id, parsed.data.status, UI_ACTOR);
    return { intent: "status", warnings: result.warnings, errors: [] as string[] };
  }
  if (form.intent === "evidence") {
    const parsed = evidenceInputSchema.safeParse({ ...form, note: form.note || undefined });
    if (!parsed.success) return data({ intent: "evidence", errors: parsed.error.issues.map((i) => i.message) }, { status: 400 });
    await service.addEvidence(activity.id, parsed.data, UI_ACTOR);
    return { intent: "evidence", warnings: [], errors: [] as string[] };
  }
  return data({ intent: "unknown", errors: ["Unknown action"] }, { status: 400 });
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{children || "—"}</dd>
    </div>
  );
}

export default function ActivityDetail({ loaderData, actionData }: Route.ComponentProps) {
  const { activity: a, dependency, dependents, evidence, events } = loaderData;
  const busy = useNavigation().state !== "idle";
  const errors = actionData && "errors" in actionData ? actionData.errors : [];
  const warnings = actionData && "warnings" in actionData ? actionData.warnings : [];

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link to="/activities" className="text-primary underline">Activities</Link> / {a.id}
      </nav>
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">
          <span className="font-mono">{a.id}</span> · {a.title}
        </h1>
        <StatusBadge status={a.status} />
        <span data-testid="activity-flag"><FlagBadge flag={a.flag} /></span>
      </header>
      <p className="text-sm" data-testid="effective-state">
        {a.effectivelyDone ? "Effectively done (DONE with evidence)." : "Not effectively done."}{" "}
        Dependency {a.dependencySatisfied ? "satisfied" : "pending"}.
      </p>

      {(errors.length > 0 || warnings.length > 0) && (
        <div role="status" className="space-y-1">
          {errors.map((e) => (
            <p key={e} className="rounded border border-destructive p-2 text-sm text-destructive">{e}</p>
          ))}
          {warnings.map((w) => (
            <p key={w} className="rounded border border-destructive p-2 text-sm">
              Warning: status saved, but the activity is flagged <strong>{w}</strong>.
            </p>
          ))}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <dl className="grid gap-3 sm:grid-cols-2">
            <Field label="Phase">{a.phase}</Field>
            <Field label="Area">{a.area}</Field>
            <Field label="Objective">{a.objective}</Field>
            <Field label="Deliverable"><code>{a.deliverable}</code></Field>
            <Field label="Tutorial">{a.tutorial}</Field>
            <Field label="Knowledge">{a.knowledge}</Field>
            <Field label="Tool">{a.tool}</Field>
            <Field label="Owner / Priority / Due">{`${a.owner} · ${a.priority} · ${a.due ?? "no due date"}`}</Field>
            <Field label="Reference">
              {a.reference.startsWith("http") ? (
                <a className="text-primary underline" href={a.reference} target="_blank" rel="noreferrer">{a.reference}</a>
              ) : a.reference}
            </Field>
          </dl>
          <div className="mt-4 rounded-md border border-border bg-muted p-3">
            <h2 className="text-sm font-semibold">Acceptance criterion</h2>
            <p className="text-sm">{a.acceptance}</p>
          </div>
        </Card>

        <Card>
          <CardTitle>Dependencies</CardTitle>
          <p className="mt-2 text-sm">
            Depends on:{" "}
            {dependency ? (
              <>
                <Link className="font-mono text-primary underline" to={`/activities/${dependency.id}`}>{dependency.id}</Link>{" "}
                <StatusBadge status={dependency.status} />
              </>
            ) : "none"}
          </p>
          <p className="mt-2 text-sm">
            Required by:{" "}
            {dependents.length === 0 ? "none" : dependents.map((d) => (
              <Link key={d.id} className="mr-2 font-mono text-primary underline" to={`/activities/${d.id}`}>{d.id}</Link>
            ))}
          </p>
        </Card>
      </div>

      <div className="grid items-start gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Change status</CardTitle>
          <Form method="post" className="mt-3 flex items-end gap-2">
            <input type="hidden" name="intent" value="status" />
            <div className="flex-1 space-y-1">
              <Label htmlFor="status">Status</Label>
              <Select id="status" name="status" defaultValue={a.status} key={a.status}>
                {STATUSES.map((s) => <option key={s}>{s}</option>)}
              </Select>
            </div>
            <Button type="submit" disabled={busy}>Save status</Button>
          </Form>
        </Card>

        <Card>
          <CardTitle>Add evidence</CardTitle>
          <Form method="post" className="mt-3 space-y-2" key={evidence.length}>
            <input type="hidden" name="intent" value="evidence" />
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label htmlFor="kind">Kind</Label>
                <Select id="kind" name="kind" defaultValue="link">
                  {EVIDENCE_KINDS.map((k) => <option key={k}>{k}</option>)}
                </Select>
              </div>
              <div className="col-span-2 space-y-1">
                <Label htmlFor="ref">Reference (URL, commit SHA, repo path or text)</Label>
                <Input id="ref" name="ref" required />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="note">Note (optional)</Label>
              <Input id="note" name="note" />
            </div>
            <Button type="submit" disabled={busy}>Add evidence</Button>
          </Form>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Evidence ({evidence.length})</CardTitle>
          <ul className="mt-2 space-y-2 text-sm" data-testid="evidence-list">
            {evidence.length === 0 && <li className="text-muted-foreground">No evidence yet.</li>}
            {evidence.map((e) => (
              <li key={e.id} className="border-b border-border pb-1">
                <span className="font-semibold">{e.kind}</span> · <span className="break-all">{e.ref}</span>
                {e.note && <span className="text-muted-foreground"> — {e.note}</span>}
                <div className="text-xs text-muted-foreground">{e.createdBy} · {e.createdAt}</div>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardTitle>History</CardTitle>
          <ul className="mt-2 space-y-1 text-sm">
            {events.length === 0 && <li className="text-muted-foreground">No changes recorded.</li>}
            {events.map((e) => (
              <li key={e.id}>
                <span className="text-xs text-muted-foreground">{e.at}</span> · {e.actor} · {e.action}
                {e.fromValue ? ` ${e.fromValue} →` : ""} {e.toValue}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
