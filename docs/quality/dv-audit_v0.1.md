# Data Visualization Quality Audit v0.1

- Date: 2026-11-12 · Criteria: `data/quality/dv-criteria.v1.json` (33 criteria: 18 MUST, 15 SHOULD), generated from `reference/loop-design/CRITERIOS_QUALIDADE_VISUALIZACAO_DADOS.csv` by `scripts/import_dv_criteria.py`.
- Scope: `/dashboard` (progress bars, KPI cards) and `/canvas` (5 views). There are no line charts, axes or grids in the product today.
- Result: **✅ meets · ⚠ partial · N/A not applicable · ⏳ manual check pending**. MUST failures found during the audit were fixed in this change (marked *fixed*).

| ID | Obl. | Criterion | Dashboard | Canvas | Evidence / note |
| --- | --- | --- | --- | --- | --- |
| DV-QC-001 | MUST | Remove visual saturation | ✅ | ✅ *fixed* | BPMN reduced from 17 to 6 columns after before/after comparison; frames carry data (labels, progress) |
| DV-QC-002 | SHOULD | Remove functionless outer border | ✅ | ✅ | Cards keep a border only to group; canvas has no frame |
| DV-QC-003 | SHOULD | Remove unneeded grid lines | N/A | ✅ | No grid |
| DV-QC-004 | MUST | Grid lines in background | N/A | N/A | No grid |
| DV-QC-005 | SHOULD | Remove unneeded point markers | N/A | N/A | No line charts |
| DV-QC-006 | MUST | Markers only for identification | N/A | ✅ | Arrow heads only on directed edges |
| DV-QC-007 | SHOULD | Abbreviate predictable labels | N/A | ✅ | Long headers truncated with "…"; full text in outline and inspector |
| DV-QC-008 | SHOULD | Horizontal labels | ✅ | ✅ | All text horizontal |
| DV-QC-009 | SHOULD | Remove repeated words | ✅ | ⚠ | Node header repeats type (ATIVIDADE) on every card — kept on purpose: it is the semantic code of the square geometry (DV-QC-021) |
| DV-QC-010 | SHOULD | Label series directly | ✅ | ✅ | Area tiles and frames labelled in place |
| DV-QC-011 | MUST | Remove legend after direct labels | ✅ | ✅ | Node type is written on each node; the sidebar legend remains as reference for connectors (edges are not labelled) |
| DV-QC-012 | MUST | Labels near data | ✅ | ✅ | Percent next to each bar; labels inside nodes |
| DV-QC-013 | MUST | Same colour for same series | ✅ | ✅ | Status stripe uses the same `status.*` tokens as badges |
| DV-QC-014 | SHOULD | Colour difference to highlight | ✅ | ✅ | Selection = brand blue; highlight filter dims others |
| DV-QC-015 | MUST | No decorative colour | ✅ | ✅ | Only tokens; red only for blocked/flags/gaps |
| DV-QC-016 | MUST | Data and message in front | ✅ | ✅ | Frames/lanes muted; nodes and edges on top |
| DV-QC-017 | MUST | Keep necessary context | ✅ | ✅ | Hidden elements reported per view ("continuam no modelo") |
| DV-QC-018 | SHOULD | White space to organise | ✅ | ✅ | Gaps between columns/lanes |
| DV-QC-019 | MUST | Explicit unit | ✅ | ✅ | "%", "0 of 14", "x/y concluídas", "N de M elementos representados" |
| DV-QC-020 | SHOULD | Keep %, magnitude signs | ✅ | ✅ | — |
| DV-QC-021 | MUST | Useful redundancy is not saturation | ✅ | ✅ | Type label + icon kept (see 009) |
| DV-QC-022 | SHOULD | Annotations explain nuance | N/A | ✅ | Data-status note on Clean Sea (17 vs 23 steps) |
| DV-QC-023 | SHOULD | Annotations direct attention | ✅ | ✅ | Flags list, next gate |
| DV-QC-024 | MUST | External factors not confused with data | N/A | ✅ | Notes are outside the drawing, marked ⚑/⚠ |
| DV-QC-025 | MUST | Annotation linked to its target | ✅ | ✅ | Flags link to the activity; gap text sits inside the node |
| DV-QC-026 | MUST | Annotations short, no overlap | ✅ | ✅ | Notes bar above the canvas; no overlap (box-overlap unit test) |
| DV-QC-027 | SHOULD | Do not annotate every point | ✅ | ✅ | Only flagged / gap nodes carry a footer |
| DV-QC-028 | MUST | Title and subtitle | ✅ | ✅ *fixed* | Canvas header "{dataset} — {view}" + counts and source status |
| DV-QC-029 | MUST | Compare original vs simplified | N/A | ✅ | `docs/quality/evidence/dvqc-029-before-prototype-bpmn.png` vs `dvqc-029-after-canvas-bpmn.png` |
| DV-QC-030 | SHOULD | Clean-up in a verifiable sequence | N/A | ✅ | Commit history + this table |
| DV-QC-031 | SHOULD | Test with audience when in doubt | ⏳ | ⏳ | Needs real users (ACT-02 interviews) |
| DV-QC-032 | MUST | Not colour alone | ✅ | ✅ *fixed* | Connector legend added (arrow / plain / dashed); states written as text |
| DV-QC-033 | MUST | Preserve scale, order, values | ✅ | ✅ | Projection invariant tests: same IDs, edges, data in all views |

## Summary

- MUST: 18 → 14 ✅, 4 N/A, **0 failing** (3 fixed during the audit).
- SHOULD: 15 → 10 ✅, 1 ⚠ (009, justified), 3 N/A, 1 ⏳ (031).
