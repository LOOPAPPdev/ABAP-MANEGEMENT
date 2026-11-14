import { useEffect, useMemo, useRef, useState } from "react";
import type { ImperativePanelHandle } from "react-resizable-panels";
import { useSearchParams, type ShouldRevalidateFunction } from "react-router";
import cleanSeaRaw from "../../data/reference/cleansea.v1.json";
import { ContextBar } from "../components/canvas/context-bar";
import { DiagramView } from "../components/canvas/diagram-view";
import { Inspector } from "../components/canvas/inspector";
import { Library } from "../components/canvas/library";
import { MetanoteButton } from "../components/canvas/metanote";
import { TutorialView } from "../components/canvas/tutorial-view";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "~/components/ui/resizable";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { Label, Select } from "~/components/ui/input";
import { fromCleanSea, fromGovernance, parseCleanSea, project, VIEW_LABELS, VIEWS, type Graph, type ViewId } from "~/domain/diagram";
import { projectFrom, serviceFrom } from "../lib/service.server";
import type { Route } from "./+types/canvas";

export const handle = { fullBleed: true };

export function meta() {
  return [{ title: "Canvas · Governance System" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const current = await projectFrom(context, request);
  const activities = await serviceFrom(context, current).listEvaluated();
  const graphs: Graph[] = [fromGovernance(activities, current.code ? `${current.code} · ${current.name}` : current.name), fromCleanSea(parseCleanSea(cleanSeaRaw))];
  return { graphs };
}

/** Dataset, view and selection live in the URL; the data does not change, so skip reloading. */
export const shouldRevalidate: ShouldRevalidateFunction = ({ formMethod, defaultShouldRevalidate, currentUrl, nextUrl }) =>
  formMethod ? defaultShouldRevalidate : currentUrl.pathname !== nextUrl.pathname;

const isView = (v: string | null): v is ViewId => VIEWS.includes(v as ViewId);

export default function Canvas({ loaderData }: Route.ComponentProps) {
  const [params, setParams] = useSearchParams();
  const graph = loaderData.graphs.find((g) => g.id === params.get("dataset")) ?? loaderData.graphs[0]!;
  const view: ViewId = isView(params.get("view")) ? (params.get("view") as ViewId) : "complex";
  const selectedId = graph.nodes.some((n) => n.id === params.get("node")) ? params.get("node") : null;
  const projection = useMemo(() => project(graph, view), [graph, view]);

  const [highlight, setHighlight] = useState<{ lane?: string; group?: string }>({});
  const [zoom, setZoom] = useState(1);
  const [tab, setTab] = useState<"data" | "metanote">("data");
  const [metanoteId, setMetanoteId] = useState("pattern-multiview");
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const left = useRef<ImperativePanelHandle>(null);
  const right = useRef<ImperativePanelHandle>(null);
  const area = useRef<HTMLDivElement>(null);

  // Marker for tests and assistive tooling: interactive controls work only after hydration.
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    root.current?.setAttribute("data-hydrated", "true");
  }, []);

  // Keep the selection visible when it changes from the outline, the inspector or the URL.
  useEffect(() => {
    if (!selectedId) return;
    area.current?.querySelector(`[data-node-id="${CSS.escape(selectedId)}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [selectedId, view, graph.id]);

  const update = (patch: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) {
          if (v === null) next.delete(k);
          else next.set(k, v);
        }
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  const select = (id: string) => {
    update({ node: id });
    setTab("data");
  };
  const openMetanote = (id: string) => {
    setMetanoteId(id);
    setTab("metanote");
    if (right.current?.isCollapsed()) right.current.expand();
  };
  const toggle = (ref: typeof left) => (ref.current?.isCollapsed() ? ref.current.expand() : ref.current?.collapse());
  const fit = () => {
    const el = area.current;
    if (el) setZoom(Math.min(2, Math.max(0.3, Math.floor(((el.clientWidth - 16) / projection.width) * 10) / 10)));
  };

  return (
    <div className="flex h-[calc(100vh-57px)] flex-col" data-component-id="canvas-workspace" ref={root}>
      {/* Topbar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-card px-3 py-2">
        <div className="flex items-center gap-2">
          <Label htmlFor="dataset" className="text-xs">Dados</Label>
          <Select id="dataset" className="h-8 w-auto" value={graph.id} onChange={(e) => update({ dataset: e.target.value, node: null })}>
            {loaderData.graphs.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title} ({g.status})
              </option>
            ))}
          </Select>
        </div>
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(v) => v && update({ view: v })}
          aria-label="Visualização"
          className="flex-wrap"
          data-component-id="view-toggle"
        >
          {VIEWS.map((v) => (
            <ToggleGroupItem key={v} value={v} size="sm" className="px-3">
              {VIEW_LABELS[v]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <MetanoteButton componentId="view-toggle" onOpen={openMetanote} />
      </div>

      <ResizablePanelGroup direction="horizontal" autoSaveId="canvas-layout-v1" className="min-h-0 flex-1">
        <ResizablePanel
          ref={left}
          id="left"
          order={1}
          defaultSize={20}
          minSize={14}
          maxSize={35}
          collapsible
          collapsedSize={0}
          onCollapse={() => setLeftCollapsed(true)}
          onExpand={() => setLeftCollapsed(false)}
          className="bg-card"
        >
          <aside aria-label="Biblioteca e estrutura" className="h-full">
            <Library
              graph={graph}
              projection={projection}
              selectedId={selectedId}
              highlight={highlight}
              onHighlight={setHighlight}
              onSelect={select}
              onMetanote={openMetanote}
            />
          </aside>
        </ResizablePanel>
        <ResizableHandle withHandle aria-label="Redimensionar biblioteca" />
        <ResizablePanel id="center" order={2} minSize={30}>
          <section aria-label="Canvas" className="flex h-full flex-col">
            <header className="border-b border-border bg-card px-3 py-2">
              <h1 className="text-base font-bold">
                {graph.title} — {VIEW_LABELS[view]}
              </h1>
              <p className="text-xs text-muted-foreground">
                {projection.view === "tutorial" ? `${projection.sequence.length} etapas em sequência` : `${Object.keys(projection.placements).length} de ${graph.nodes.length} elementos representados · ${projection.edgeIds.length} conectores`}
                {" · "}fonte: {graph.status}
              </p>
            </header>
            {(graph.notes.length > 0 || projection.warnings.length > 0) && (
              <div className="space-y-1 border-b border-border bg-background px-3 py-2 text-xs" data-testid="canvas-notes">
                {graph.status !== "operacional" && (
                  <p className="font-semibold text-destructive">⚑ Dados {graph.status}: {graph.notes[0]}</p>
                )}
                {projection.warnings.map((w) => (
                  <p key={w} role="status">⚠ {w}</p>
                ))}
              </div>
            )}
            <div ref={area} className="min-h-0 flex-1 overflow-auto bg-background" data-testid="canvas-area">
              {view === "tutorial" ? (
                <TutorialView graph={graph} projection={projection} selectedId={selectedId} onSelect={select} />
              ) : (
                <DiagramView graph={graph} projection={projection} selectedId={selectedId} highlight={highlight} zoom={zoom} onSelect={select} />
              )}
            </div>
            <ContextBar
              zoom={zoom}
              onZoom={setZoom}
              onFit={fit}
              disabled={view === "tutorial"}
              leftCollapsed={leftCollapsed}
              rightCollapsed={rightCollapsed}
              onToggleLeft={() => toggle(left)}
              onToggleRight={() => toggle(right)}
              onMetanote={openMetanote}
            />
          </section>
        </ResizablePanel>
        <ResizableHandle withHandle aria-label="Redimensionar inspector" />
        <ResizablePanel
          ref={right}
          id="right"
          order={3}
          defaultSize={24}
          minSize={16}
          maxSize={40}
          collapsible
          collapsedSize={0}
          onCollapse={() => setRightCollapsed(true)}
          onExpand={() => setRightCollapsed(false)}
          className="bg-card"
        >
          <aside aria-label="Inspector" className="h-full">
            <Inspector
              graph={graph}
              projection={projection}
              selectedId={selectedId}
              tab={tab}
              metanoteId={metanoteId}
              onTab={setTab}
              onSelect={select}
              onMetanote={openMetanote}
            />
          </aside>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
