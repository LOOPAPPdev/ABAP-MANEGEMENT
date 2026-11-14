# ADR-002 — Canvas Workspace (Mapa de Fluxos)

- Status: **PROPOSED — implemented locally, awaiting owner approval**
- Date: 2026-11-12 · Source: `reference/loop-design/ADR-002 — Atualização do Mapa de Fluxos.md`
- Related: ADR-003 (Multiview), ADR-004 (component audit), ACT-04 (UX/UI)

## Context

The source ADR asks for a Canvas Workspace for the "LOOP App", built on the LOOP Consulting × Clean Sea case. The owner decided (2026-11-12) to **apply it to the Governance System** and to **extract the Clean Sea data from the HTML prototypes**, marked as not validated.

## Decision

Implement `/canvas` as a Canvas Workspace with five regions:

| Region | Implementation | Registry ID |
| --- | --- | --- |
| Topbar | Dataset select + View Toggle + metanote | `view-toggle` |
| Left sidebar | Node-type and connector legend, highlight filters, text outline of all nodes | `sidebar-library` |
| Canvas | SVG, square geometry only | `diagram-node`, `diagram-edge`, `lane-band`, `phase-frame`, `bpmn-event` |
| Inspector | Tabs Dados / Metanota, relations, link to edit | `inspector` |
| Context bar | Collapse sidebars, zoom −/+, fit | `context-bar` |

Sidebars are collapsible and resizable (`react-resizable-panels`, layout saved in `localStorage` via `autoSaveId`). Dataset, view and selection live in the URL (`?dataset=&view=&node=`), so a state can be shared and survives reloads.

## Adaptation to the Governance System

- Main case: the 14 governance activities (live D1 data). Second case: Clean Sea (`data/reference/cleansea.v1.json`).
- The canvas is **read-only**. Status and evidence are edited on `/activities/:id` (Inspector link), so the governance rules and audit trail stay in one place.
- Metanotes come from `docs/design-system/COMPONENT_REGISTRY.json` (7 fields: Nome · Função · Quando utilizar · Dados · Interação · Estado · Regra de UX), shown on demand with ⓘ buttons.

## Divergences from the source

| Source says | Implemented | Reason |
| --- | --- | --- |
| 23 activities, 7 phases, E0 → A → … → Z | 17 steps, 6 phases (A–F) | Only the HTML prototype exists; `Clean Sea Pipeline Completo.md` not provided. Not invented. Shown as a warning in the canvas. |
| Minimap, undo/redo | Not implemented | Canvas is read-only; undo/redo has no edit to undo. Minimap pending. |
| Forms to edit properties on the canvas | Link to the activity page | Single place for governance mutations (CLAUDE.md rules). |

## Acceptance criteria (verified by `tests/e2e/canvas.spec.ts`)

- GIVEN the canvas, WHEN the user selects an activity, THEN the Inspector shows its data and metanote. ✅
- GIVEN an expanded sidebar, WHEN it is collapsed, THEN the canvas uses the free space. ✅
- GIVEN the Clean Sea flow, WHEN the user switches views, THEN relations and data stay consistent. ✅ (unit invariant for all views × both datasets)
