import { Link, redirect } from "react-router";
import { Card, CardTitle } from "~/components/ui/card";
import { projectsFrom } from "../lib/service.server";
import type { Route } from "./+types/studio-index";

export function meta() {
  return [{ title: "Studio · ABAP" }];
}

/** Studios the signed-in person can open. A guest with one project goes straight to it. */
export async function loader({ context }: Route.LoaderArgs) {
  const access = context.user?.access;
  const all = await projectsFrom(context).list();
  const list = access?.kind === "staff" ? all.filter((p) => p.id !== "default") : access?.kind === "guest" ? all.filter((p) => access.projects.includes(p.id)) : [];
  if (access?.kind === "guest" && list.length === 1) throw redirect(`/studio/${list[0]!.id}`);
  return { projects: list.map((p) => ({ id: p.id, code: p.code, name: p.name })) };
}

export default function StudioIndex({ loaderData: d }: Route.ComponentProps) {
  return (
    <div className="space-y-4" data-component-id="pattern-studio">
      <header>
        <p className="meta-label">Studio</p>
        <h1 className="text-2xl font-semibold tracking-tight">Studios dos projetos</h1>
        <p className="text-sm text-muted-foreground">Cada projeto de cliente tem um studio compartilhado com as pessoas convidadas.</p>
      </header>
      {d.projects.length === 0 ? (
        <Card><CardTitle>Nenhum studio disponível</CardTitle></Card>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {d.projects.map((p) => (
            <li key={p.id}>
              <Link to={`/studio/${p.id}`} className="block rounded-md border border-border bg-card p-3 hover:bg-accent">
                <span className="meta-label">{p.code}</span>
                <span className="block font-medium">{p.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
