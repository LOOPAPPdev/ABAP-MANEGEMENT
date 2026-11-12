import { Label, Select } from "~/components/ui/input";
import { NODE_TYPES, type EdgeKind, type Graph, type Projection } from "~/domain/diagram";
import { MetanoteButton } from "./metanote";
import { TYPE_META } from "./node";

interface Props {
  graph: Graph;
  projection: Projection;
  selectedId: string | null;
  highlight: { lane?: string; group?: string };
  onHighlight: (h: { lane?: string; group?: string }) => void;
  onSelect: (id: string) => void;
  onMetanote: (id: string) => void;
}

interface LegendItem {
  label: string;
  kinds: EdgeKind[];
  arrow: boolean;
  color: string;
  dash?: string;
}

const EDGE_LEGEND: LegendItem[] = [
  { label: "Sequência / dependência (seta = direção)", kinds: ["flow", "dependency"], arrow: true, color: "var(--secondary-foreground)" },
  { label: "Hierarquia (sem seta)", kinds: ["hierarchy"], arrow: false, color: "var(--muted-foreground)" },
  { label: "Associação inferida (tracejada)", kinds: ["association"], arrow: false, dash: "4 4", color: "var(--muted-foreground)" },
];

/** Left sidebar (registry: sidebar-library): legend, highlight filters and a text outline of every node. */
export function Library({ graph, projection, selectedId, highlight, onHighlight, onSelect, onMetanote }: Props) {
  const present = NODE_TYPES.filter((t) => graph.nodes.some((n) => n.type === t));
  const hidden = new Set(projection.hiddenIds);
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-3 text-sm" data-component-id="sidebar-library">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Biblioteca</h2>
        <MetanoteButton componentId="sidebar-library" onOpen={onMetanote} />
      </div>

      <section aria-labelledby="legend-h">
        <h3 id="legend-h" className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tipos de nó</h3>
        <ul className="space-y-1">
          {present.map((t) => {
            const { label, Icon } = TYPE_META[t];
            return (
              <li key={t} className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-[4px] border border-border bg-card">
                  <Icon aria-hidden="true" className="h-3.5 w-3.5" />
                </span>
                {label} <span className="text-muted-foreground">({graph.nodes.filter((n) => n.type === t).length})</span>
              </li>
            );
          })}
          <li className="text-xs text-muted-foreground">Borda tracejada = lacuna ou não validado</li>
        </ul>
      </section>

      <section aria-labelledby="edges-h">
        <h3 id="edges-h" className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Conectores</h3>
        <ul className="space-y-1 text-xs" data-testid="edge-legend">
          {EDGE_LEGEND.filter((l) => graph.edges.some((e) => l.kinds.includes(e.kind))).map((l) => (
            <li key={l.label} className="flex items-center gap-2">
              <svg width="36" height="10" aria-hidden="true">
                <line x1="2" y1="5" x2={l.arrow ? 28 : 34} y2="5" stroke={l.color} strokeWidth="1.5" strokeDasharray={l.dash} />
                {l.arrow && <path d="M28,1 L35,5 L28,9 z" fill={l.color} />}
              </svg>
              {l.label}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="filter-h" className="space-y-2">
        <h3 id="filter-h" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Destacar</h3>
        {graph.lanes.length > 0 && (
          <div className="space-y-1">
            <Label htmlFor="hl-lane">Raia / área</Label>
            <Select id="hl-lane" value={highlight.lane ?? ""} onChange={(e) => onHighlight({ ...highlight, lane: e.target.value || undefined })}>
              <option value="">Todas</option>
              {graph.lanes.map((l) => <option key={l}>{l}</option>)}
            </Select>
          </div>
        )}
        <div className="space-y-1">
          <Label htmlFor="hl-group">Fase</Label>
          <Select id="hl-group" value={highlight.group ?? ""} onChange={(e) => onHighlight({ ...highlight, group: e.target.value || undefined })}>
            <option value="">Todas</option>
            {graph.groups.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
          </Select>
        </div>
      </section>

      <section aria-labelledby="outline-h" className="min-h-0">
        <h3 id="outline-h" className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Estrutura ({graph.nodes.length})
        </h3>
        <ul className="space-y-0.5" data-testid="outline">
          {graph.nodes.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => onSelect(n.id)}
                aria-current={n.id === selectedId ? "true" : undefined}
                className={`w-full truncate rounded px-2 py-0.5 text-left ${n.id === selectedId ? "bg-brand-tint font-semibold text-brand-fg" : "hover:bg-accent"} ${hidden.has(n.id) ? "text-muted-foreground" : ""}`}
                title={hidden.has(n.id) ? "Não representado nesta visão" : n.label}
              >
                <span className="font-mono text-xs">{n.subtitle ?? n.id}</span> {n.label}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
