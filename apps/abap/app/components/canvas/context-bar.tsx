import { Maximize, Minus, PanelLeft, PanelRight, Plus } from "lucide-react";
import { Button } from "~/components/ui/button";
import { MetanoteButton } from "./metanote";

interface Props {
  zoom: number;
  onZoom: (z: number) => void;
  onFit: () => void;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  onToggleLeft: () => void;
  onToggleRight: () => void;
  onMetanote: (id: string) => void;
  disabled: boolean;
}

export const clampZoom = (z: number) => Math.min(2, Math.max(0.3, Math.round(z * 10) / 10));

/** Context bar (registry: context-bar). */
export function ContextBar({ zoom, onZoom, onFit, leftCollapsed, rightCollapsed, onToggleLeft, onToggleRight, onMetanote, disabled }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-1 border-t border-border bg-card px-2 py-1" data-component-id="context-bar" role="toolbar" aria-label="Controles do canvas">
      <Button variant="ghost" size="sm" onClick={onToggleLeft} aria-pressed={!leftCollapsed} aria-label={leftCollapsed ? "Expandir biblioteca" : "Recolher biblioteca"}>
        <PanelLeft aria-hidden="true" /> <span className="hidden sm:inline">Biblioteca</span>
      </Button>
      <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
      <Button variant="ghost" size="sm" onClick={() => onZoom(clampZoom(zoom - 0.1))} disabled={disabled} aria-label="Diminuir zoom">
        <Minus aria-hidden="true" />
      </Button>
      <span className="w-12 text-center text-xs tabular-nums" aria-live="polite" data-testid="zoom-level">
        {Math.round(zoom * 100)}%
      </span>
      <Button variant="ghost" size="sm" onClick={() => onZoom(clampZoom(zoom + 0.1))} disabled={disabled} aria-label="Aumentar zoom">
        <Plus aria-hidden="true" />
      </Button>
      <Button variant="ghost" size="sm" onClick={onFit} disabled={disabled}>
        <Maximize aria-hidden="true" /> Ajustar
      </Button>
      <MetanoteButton componentId="context-bar" onOpen={onMetanote} />
      <span className="flex-1" />
      <Button variant="ghost" size="sm" onClick={onToggleRight} aria-pressed={!rightCollapsed} aria-label={rightCollapsed ? "Expandir inspector" : "Recolher inspector"}>
        <span className="hidden sm:inline">Inspector</span> <PanelRight aria-hidden="true" />
      </Button>
    </div>
  );
}
