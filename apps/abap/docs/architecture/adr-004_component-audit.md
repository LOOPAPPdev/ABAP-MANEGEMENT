# ADR-004 — Component Audit & Design System Architecture

- Status: **PROPOSED — G1–G4 done, G5 partially verified**
- Date: 2026-11-12 · Source: `reference/loop-design/ADR-004 — Component Audit & Design System Architecture.md`

## Decision

Audit before building. One identity (workbook tokens), one registry as the single source of truth for components and metanotes.

## Deliverables

| Required | File |
| --- | --- |
| `COMPONENT_INVENTORY.md` | `docs/design-system/COMPONENT_INVENTORY.md` |
| `COMPONENT_TAXONOMY.md` | `docs/design-system/COMPONENT_TAXONOMY.md` |
| `DESIGN_TOKENS.json` | `docs/design-system/DESIGN_TOKENS.json` |
| `COMPONENT_REGISTRY.json` | `docs/design-system/COMPONENT_REGISTRY.json` (schema `src/design-system/registry.ts`) |
| `DESIGN_SYSTEM_ARCHITECTURE.md` | `docs/design-system/DESIGN_SYSTEM_ARCHITECTURE.md` |
| `COMPONENT_SHOWCASE` | Route `/showcase` |

## Quality gates

| Gate | Result | Evidence |
| --- | --- | --- |
| G1 Inventário | ✅ | Repo components, 43 shadcn components + 1 hook, 5 HTML prototypes (Screens v2 is a bundled app: only partially inspectable, see inventory) |
| G2 Taxonomia | ✅ | 6 families; each adopted component has exactly one family (schema enum) |
| G3 Consolidação | ✅ | Button → shadcn version (adds `asChild`); Card/Badge/Input → repo versions; 3 palettes → workbook palette; 36 shadcn components catalogued as "available" |
| G4 Arquitetura | ✅ | Registry with props, states, dependencies (`ds:` references validated), metanotes; Zod-validated at import and in tests |
| G5 Validação | ◐ | Keyboard (E2E), focus visible, text + icon semantics, token sync test. Contrast measurement and screen-reader review: pending (manual) |

## Divergence

The source asks for "the whole family of components" in the canvas. Only components with a real use were adopted (CLAUDE.md: no dependency without need). The rest stay in the registry as `available`.
