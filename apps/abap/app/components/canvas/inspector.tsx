import { Link } from "react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { neighbours, VIEW_LABELS, type Graph, type Projection } from "~/domain/diagram";
import { Metanote, MetanoteButton } from "./metanote";
import { humanize, TYPE_META } from "./node";

interface Props {
  graph: Graph;
  projection: Projection;
  selectedId: string | null;
  tab: "data" | "metanote";
  metanoteId: string;
  onTab: (t: "data" | "metanote") => void;
  onSelect: (id: string) => void;
  onMetanote: (id: string) => void;
}

const EDGE_LABEL = { flow: "sequência", dependency: "dependência", hierarchy: "hierarquia", association: "associação" } as const;

/** Right panel (registry: inspector): selection data + metanote on demand. */
export function Inspector({ graph, projection, selectedId, tab, metanoteId, onTab, onSelect, onMetanote }: Props) {
  const node = graph.nodes.find((n) => n.id === selectedId);
  const label = (id: string) => graph.nodes.find((n) => n.id === id)?.subtitle ?? id;
  const rel = node ? neighbours(graph, node.id) : null;
  return (
    <div className="flex h-full flex-col overflow-y-auto p-3 text-sm" data-component-id="inspector">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold">Inspector</h2>
        <MetanoteButton componentId="inspector" onOpen={onMetanote} />
      </div>
      <Tabs value={tab} onValueChange={(v) => onTab(v as "data" | "metanote")}>
        <TabsList className="w-full">
          <TabsTrigger value="data" className="flex-1">Dados</TabsTrigger>
          <TabsTrigger value="metanote" className="flex-1">Metanota</TabsTrigger>
        </TabsList>
        <TabsContent value="data" className="mt-3 space-y-3" data-testid="inspector-data">
          {!node ? (
            <p className="text-muted-foreground">Selecione um elemento no canvas ou na lista Estrutura.</p>
          ) : (
            <>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {TYPE_META[node.type].label} · <span className="font-mono">{node.id}</span>
                  </p>
                  <h3 className="text-base font-bold">{node.label}</h3>
                </div>
                <MetanoteButton componentId="diagram-node" onOpen={onMetanote} />
              </div>
              {projection.hiddenIds.includes(node.id) && (
                <p role="status" className="rounded border border-border bg-muted p-2 text-xs">
                  Não representado na visão {VIEW_LABELS[projection.view]}. O elemento continua no modelo.
                </p>
              )}
              {node.unvalidated && <p className="text-xs text-destructive-strong">⚑ Lacuna ou dado não validado.</p>}
              <dl className="space-y-2">
                {Object.entries(node.data).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{humanize(k)}</dt>
                    <dd className="break-words">{v === null || v === "" ? "—" : String(v)}</dd>
                  </div>
                ))}
              </dl>
              {rel && (rel.incoming.length > 0 || rel.outgoing.length > 0) && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Relações</h4>
                  <ul className="mt-1 space-y-0.5">
                    {rel.incoming.map((e) => (
                      <li key={e.id}>
                        ← <button type="button" className="text-primary underline" onClick={() => onSelect(e.from)}>{label(e.from)}</button>{" "}
                        <span className="text-muted-foreground">({EDGE_LABEL[e.kind]}{e.inferred ? ", inferida" : ""})</span>
                      </li>
                    ))}
                    {rel.outgoing.map((e) => (
                      <li key={e.id}>
                        → <button type="button" className="text-primary underline" onClick={() => onSelect(e.to)}>{label(e.to)}</button>{" "}
                        <span className="text-muted-foreground">({EDGE_LABEL[e.kind]}{e.inferred ? ", inferida" : ""})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {node.href && (
                <Link to={node.href} className="inline-block text-primary underline">
                  Abrir {node.id} para editar status e evidências
                </Link>
              )}
            </>
          )}
        </TabsContent>
        <TabsContent value="metanote" className="mt-3">
          <Metanote componentId={metanoteId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
