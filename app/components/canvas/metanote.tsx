import { Info } from "lucide-react";
import { getComponent } from "~/design-system";

const FIELDS = [
  ["name", "Nome"],
  ["function", "Função"],
  ["whenToUse", "Quando utilizar"],
  ["data", "Dados necessários"],
  ["interaction", "Interação"],
  ["state", "Estado"],
  ["uxRule", "Regra de UX"],
] as const;

/** Renders the 7-field metanote of a registry component (ADR-002 D). */
export function Metanote({ componentId }: { componentId: string }) {
  const c = getComponent(componentId);
  if (!c?.metanote) return <p className="text-sm text-muted-foreground">Sem metanota para “{componentId}”.</p>;
  return (
    <div data-testid="metanote" data-component={c.id}>
      <p className="mb-2 text-xs text-muted-foreground">
        {c.family} · <code>{c.id}</code>
      </p>
      <dl className="space-y-2 text-sm">
        {FIELDS.map(([k, label]) => (
          <div key={k}>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
            <dd>{c.metanote![k]}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Small "ⓘ" button that asks the workspace to show a component's metanote. */
export function MetanoteButton({ componentId, onOpen }: { componentId: string; onOpen: (id: string) => void }) {
  const name = getComponent(componentId)?.name ?? componentId;
  return (
    <button
      type="button"
      onClick={() => onOpen(componentId)}
      aria-label={`Metanota: ${name}`}
      title={`Metanota: ${name}`}
      data-component-id={componentId}
      className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      <Info aria-hidden="true" className="h-4 w-4" />
    </button>
  );
}
