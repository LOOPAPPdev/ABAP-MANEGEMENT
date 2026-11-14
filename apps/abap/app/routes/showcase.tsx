import { useState } from "react";
import { Metanote } from "../components/canvas/metanote";
import { FlagBadge, ProgressBar, StatusBadge } from "~/components/governance/badges";
import { CardSelectionGroup } from "~/components/patterns/choice-card";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Input, Label, Select } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Toggle } from "~/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { FAMILIES, registry, type ComponentEntry } from "~/design-system";
import { STATUSES } from "~/domain/governance";

export function meta() {
  return [{ title: "Design system · Governance System" }];
}

/** Live examples for adopted components. Components without an example link to where they are used. */
function Example({ id }: { id: string }) {
  const [choice, setChoice] = useState<string[]>([]);
  const [multi, setMulti] = useState<string[]>(["a"]);
  switch (id) {
    case "button":
      return (
        <div className="flex flex-wrap gap-2">
          <Button>Primary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button disabled>Disabled</Button>
        </div>
      );
    case "status-badge":
      return <div className="flex flex-wrap gap-1">{STATUSES.map((s) => <StatusBadge key={s} status={s} />)}</div>;
    case "flag-badge":
      return (
        <div className="flex flex-wrap gap-1">
          {(["BLOCKED", "NO EVIDENCE", "DEP PENDING", "OVERDUE"] as const).map((f) => <FlagBadge key={f} flag={f} />)}
        </div>
      );
    case "progress-bar":
      return (
        <div className="flex items-center gap-3">
          <span className="w-10 text-sm font-semibold">40%</span>
          <ProgressBar ratio={0.4} label="Exemplo de progresso" />
        </div>
      );
    case "input":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="sc-in">Label</Label>
            <Input id="sc-in" placeholder="Texto" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sc-sel">Select</Label>
            <Select id="sc-sel"><option>Opção</option></Select>
          </div>
        </div>
      );
    case "toggle":
      return <Toggle aria-label="Exemplo de toggle" defaultPressed>Ligado</Toggle>;
    case "tooltip":
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline">Passe o mouse ou foque</Button>
            </TooltipTrigger>
            <TooltipContent>Ajuda curta</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    case "separator":
      return <Separator />;
    case "card":
      return <Card><p className="text-sm">Conteúdo agrupado</p></Card>;
    case "tabs":
      return (
        <Tabs defaultValue="a">
          <TabsList>
            <TabsTrigger value="a">Dados</TabsTrigger>
            <TabsTrigger value="b">Metanota</TabsTrigger>
          </TabsList>
          <TabsContent value="a" className="text-sm">Painel A</TabsContent>
          <TabsContent value="b" className="text-sm">Painel B</TabsContent>
        </Tabs>
      );
    case "view-toggle":
      return (
        <ToggleGroup type="single" defaultValue="bpmn" aria-label="Exemplo de View Toggle">
          {["Infográfico", "BPMN", "Organograma"].map((v) => (
            <ToggleGroupItem key={v} value={v === "BPMN" ? "bpmn" : v} size="sm">{v}</ToggleGroupItem>
          ))}
        </ToggleGroup>
      );
    case "choice-card":
      return (
        <CardSelectionGroup
          legend="Como você trabalha com a marca? (seleção única)"
          name="sc-single"
          value={choice}
          onChange={setChoice}
          options={[
            { value: "agency", label: "Agência", description: "Atende várias marcas" },
            { value: "own", label: "Marca própria" },
            { value: "team", label: "Equipe interna" },
          ]}
        />
      );
    case "card-selection-group":
      return (
        <CardSelectionGroup
          legend="Canais usados (seleção múltipla)"
          name="sc-multi"
          multiple
          value={multi}
          onChange={setMulti}
          options={[
            { value: "a", label: "Planilha" },
            { value: "b", label: "WhatsApp" },
            { value: "c", label: "E-mail", disabled: true, description: "Indisponível" },
          ]}
        />
      );
    default:
      return null;
  }
}

function Entry({ c }: { c: ComponentEntry }) {
  return (
    <li id={c.id} className="rounded-md border border-border bg-card p-4" data-testid="showcase-entry">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold">{c.name}</h3>
        <code className="text-xs text-muted-foreground">{c.id}</code>
      </div>
      <p className="text-sm text-secondary-foreground">{c.function}</p>
      <div className="my-3"><Example id={c.id} /></div>
      <p className="text-xs text-muted-foreground">
        Variantes: {c.variants.join(", ") || "—"} · Estados: {c.states.join(", ") || "—"} · Uso: {c.usage.join(", ") || "—"} · Fonte: {c.source}
      </p>
      <details className="mt-2">
        <summary className="cursor-pointer text-sm text-primary">Metanota</summary>
        <div className="mt-2"><Metanote componentId={c.id} /></div>
      </details>
    </li>
  );
}

export default function Showcase() {
  const adopted = registry.components.filter((c) => c.status === "adopted");
  const others = registry.components.filter((c) => c.status !== "adopted");
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold">Design system</h1>
        <p className="text-sm text-muted-foreground">
          Component showcase (ADR-004). Fonte: <code>docs/design-system/COMPONENT_REGISTRY.json</code> v{registry.version} — {adopted.length} adotados,{" "}
          {others.length} disponíveis ou planejados. Hierarquia: Tokens → Primitives → Composites → Layouts → Diagrams → Patterns.
        </p>
      </header>
      {FAMILIES.map((f) => {
        const items = adopted.filter((c) => c.family === f);
        return (
          <section key={f} aria-labelledby={`fam-${f}`}>
            <h2 id={`fam-${f}`} className="mb-3 text-lg font-semibold">
              {f} <span className="text-sm font-normal text-muted-foreground">({items.length})</span>
            </h2>
            <ul className="grid gap-3 md:grid-cols-2">{items.map((c) => <Entry key={c.id} c={c} />)}</ul>
          </section>
        );
      })}
      <section aria-labelledby="not-adopted">
        <h2 id="not-adopted" className="mb-2 text-lg font-semibold">Não adotados</h2>
        <p className="mb-2 text-sm text-muted-foreground">Catalogados na auditoria; sem caso de uso atual (regra: não adicionar dependências sem necessidade).</p>
        <ul className="flex flex-wrap gap-1 text-xs">
          {others.map((c) => (
            <li key={c.id} className="rounded border border-border bg-card px-2 py-0.5" title={c.function}>
              {c.name} · {c.status}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
