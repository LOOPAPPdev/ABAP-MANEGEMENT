import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { Button } from "~/components/ui/button";
import type { Graph, Projection } from "~/domain/diagram";
import { humanize, TYPE_META } from "./node";

/** Guided tutorial (registry: stepper + pattern-tutorial). Uses the shared selection as the current step. */
export function TutorialView({ graph, projection, selectedId, onSelect }: { graph: Graph; projection: Projection; selectedId: string | null; onSelect: (id: string) => void }) {
  const seq = projection.sequence;
  const index = Math.max(0, seq.indexOf(selectedId ?? ""));
  const node = graph.nodes.find((n) => n.id === seq[index]);
  if (!node) return <p className="p-6 text-sm">Nenhuma etapa para mostrar.</p>;
  const group = graph.groups.find((g) => g.id === node.group);
  const fields = Object.entries(node.data).filter(([, v]) => v !== null && v !== "");
  return (
    <div className="grid gap-4 p-6 lg:grid-cols-[260px_1fr]" data-component-id="pattern-tutorial">
      <nav aria-label="Etapas do tutorial">
        <ol className="space-y-1">
          {seq.map((id, i) => {
            const n = graph.nodes.find((x) => x.id === id)!;
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => onSelect(id)}
                  aria-current={i === index ? "step" : undefined}
                  className={`w-full rounded px-2 py-1 text-left text-sm ${i === index ? "bg-brand-tint font-semibold text-brand-fg" : "hover:bg-accent"}`}
                >
                  <span className="font-mono text-xs">{String(i + 1).padStart(2, "0")}</span> {n.subtitle} {n.done ? "✓" : ""}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
      <article className="rounded-md border border-border bg-card p-5" data-component-id="stepper" aria-live="polite">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground" data-testid="tutorial-position">
          Etapa {index + 1} de {seq.length} · {TYPE_META[node.type].label}
          {group ? ` · ${group.label}` : ""}
        </p>
        <h2 className="mt-1 text-xl font-bold">
          {node.subtitle} — {node.label}
        </h2>
        {node.unvalidated && <p className="mt-2 text-sm text-destructive">⚑ Lacuna ou dado não validado na fonte.</p>}
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {fields.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{humanize(k)}</dt>
              <dd className="break-words text-sm">{String(v)}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => onSelect(seq[index - 1]!)} disabled={index === 0}>
            <ChevronLeft aria-hidden="true" /> Anterior
          </Button>
          <Button onClick={() => onSelect(seq[index + 1]!)} disabled={index === seq.length - 1}>
            Próximo <ChevronRight aria-hidden="true" />
          </Button>
          <Button variant="ghost" onClick={() => onSelect(seq[0]!)}>
            <RotateCcw aria-hidden="true" /> Reiniciar
          </Button>
        </div>
      </article>
    </div>
  );
}
