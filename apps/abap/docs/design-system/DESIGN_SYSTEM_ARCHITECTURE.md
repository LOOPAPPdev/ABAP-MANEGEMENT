# Design System Architecture

- Status: **PROPOSED** (ADR-004) · Version 1.0.0

## Sources of truth

| Concern | File | Consumed by | Guard |
| --- | --- | --- | --- |
| Tokens | `docs/design-system/DESIGN_TOKENS.json` | `app/app.css` (CSS variables, Tailwind `@theme`) | `tests/unit/design-system.test.ts` fails if a colour differs |
| Components + metanotes | `docs/design-system/COMPONENT_REGISTRY.json` | `/showcase`, canvas metanotes (`src/design-system`) | Zod at import time + unit tests; every `data-component-id` in the UI must exist |
| Diagramming rules | `docs/design/diagramming-system.md` | `src/domain/diagram`, `app/components/canvas` | Unit invariants |

## Layers

```text
DESIGN_TOKENS.json ──► app/app.css (:root + @theme)
                          │
src/components/ui/*  (Primitives, Composites from shadcn + repo, token-mapped)
src/components/governance/* (domain primitives: StatusBadge, FlagBadge, ProgressBar)
src/components/patterns/*   (ChoiceCard, CardSelectionGroup)
app/components/canvas/*     (Layouts + Diagram components)
app/routes/*                (Patterns / templates: dashboard, canvas, showcase)
```

## Rules

1. Colours only through tokens (bundle, ADR-007). `destructive-strong` only for blocked / critical / flags; never add colours from imported material.
2. State is never shown by colour alone: text, icon, border or check mark too (DV-QC-032, WCAG 1.4.1).
3. Focus: global 2px brand outline. Adopted shadcn components had `focus-visible:outline-none` removed.
4. A new component enters the registry first (status `planned`), then the code, then the showcase.
5. Do not add a shadcn component until a feature needs it; promote it from `available` to `adopted` with a metanote.
6. Diagrams use square geometry; type is shown by label + icon; dashed border = gap / not validated.

## Adopted third-party packages

`@radix-ui/react-{slot,tabs,toggle,toggle-group,tooltip,separator}`, `react-resizable-panels@2` (API used by the shadcn wrapper), `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`.

## Pending

- Dark-mode tokens (D-015).
- Contrast measurement report for all token pairs.
- Runtime inventory of `Screens v2` (S7).
