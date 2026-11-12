# Component Inventory (ADR-004 G1)

- Date: 2026-11-12 · Method: static inspection of files; no new components created during this step.
- Legend: **D** = duplicate of another entry · **→** consolidation target.

## 1. Sources

| # | Source | Kind | Notes |
| --- | --- | --- | --- |
| S1 | `src/components/**` (repo, before audit) | React + Tailwind | Button, Card, Badge, Input/Select/Label, StatusBadge, FlagBadge, ProgressBar |
| S2 | `reference/loop-design/shadcn-components.tar.gz` | shadcn/ui (Radix) | 43 components + `use-toast` hook + `cn()` util |
| S3 | `workspace-preview.html` | Static prototype | Topbar, view tabs, left library sidebar, right inspector, cards C01–C05, dark theme toggle; purple palette `#5c55d8` |
| S4 | `workspace-views.html` | Static prototype | Topbar with tabs, 3-column body (side / canvas / side), purple palette `#5146dc` |
| S5 | `cleansea-operacao-integrada.html` | Static prototype + data `MODEL` | KPI tiles, org chart cards, phase stepper, BPMN lane matrix, legend, modelling note, filterable matrix table, systems/risks, "copy JSON"; teal palette `#0f6b6b` |
| S6 | `cleansea-studio-loop 1.html` | Static prototype | SSM 7-step list, module cards, implementation matrix with filters |
| S7 | `Screens v2 — Consente e Sync – Screens v2.html` | Bundled app (853 KB, fonts embedded) | Components are packed in a runtime bundle; **not inventoried in detail** (requires running the bundle). Pending. |
| S8 | Workbook `Design Tokens` sheet | Tokens | Fluent-style monochrome + `#B10E1C` alert |

## 2. Inventory

| Component | Found in | Family | Duplicates | Decision |
| --- | --- | --- | --- | --- |
| Color palette | S3, S4, S5/S6, S8 | Foundations | **D** ×4 (purple ×2, teal, workbook) | → S8 workbook tokens (one identity); others not adopted |
| Typography | S3–S6 (Inter, Space Grotesk, IBM Plex Mono), S8 (Arial/Segoe) | Foundations | **D** | → S8 |
| Icons | S2 (lucide), S6 (unicode glyphs) | Foundations | **D** | → lucide-react |
| Button | S1, S2, S3–S6 | Primitives | **D** | → S2 shadcn (`asChild`), restyled with tokens |
| Badge / chip | S1, S2, S5 (status chips) | Primitives | **D** | → S1 (status tokens) |
| Input, Select, Label, Textarea | S1, S2 | Primitives | **D** | → S1 (state.input token); shadcn versions catalogued |
| Toggle / ToggleGroup | S2, S3/S4 (view tabs) | Primitives / Composites | **D** | → S2 → `view-toggle` |
| Tabs | S2, S4, S5 | Composites | **D** | → S2 (Inspector) |
| Tooltip | S2 | Primitives | — | adopted |
| Separator | S2 | Primitives | — | adopted |
| Progress | S1, S2, S5 (KPI) | Primitives | **D** | → S1 ProgressBar |
| Card | S1, S2, S3–S6 | Composites | **D** | → S1 |
| Stepper / step list | S5 (phases), S6 (SSM) | Composites | **D** | → `stepper` (tutorial) |
| KPI tile | S5 | Composites | ≈ dashboard cards | → `card` + text |
| Choice card | Adaptive questionnaire doc | Composites | — | new `choice-card`, `card-selection-group` |
| Topbar | S3, S4, S5 | Layouts | **D** | → canvas topbar |
| Sidebar (library) | S3, S4 | Layouts | **D** | → `sidebar-library` |
| Inspector | S3, S4 | Layouts | **D** | → `inspector` |
| Resizable panels | S2 | Layouts | — | adopted |
| Org chart cards | S5 | Diagrams | — | → `diagram-node` (person/group) |
| BPMN lanes / events / gateway | S5 | Diagrams | — | → `lane-band`, `bpmn-event`, `diagram-node` (decision) |
| Matrix table | S5, S6 | Patterns | **D** | → existing activities table; not added to canvas |
| Modelling note / callout | S5 | Composites | ≈ canvas notes bar | → canvas notes (warnings) |
| Copy JSON | S5 | Patterns | — | not adopted (API `/api/v1` already exposes data) |
| Dark theme toggle | S3 | Patterns | — | not adopted (dark tokens: decision D-015) |
| Remaining shadcn (36) | S2 | various | — | catalogued `available` in the registry |

## 3. Gaps found

- No dark-mode tokens in the workbook (S3 has one): decision pending.
- Org chart image and three Markdown sources referenced by ADR-002/003 are missing.
- S7 needs runtime inspection.
