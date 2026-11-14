# ADR-008 — Interface templates and project models

- **Status:** ACCEPTED (owner request, 2026-11-14)
- **Related:** ADR-003 (multiview), ADR-006 (monorepo, clients), ADR-007 (single design system)

## Context
The owner asked: (2) the bundle is an **interface template** available when creating projects; (3) a customised bundle goes to the **client area**, like CleanSea; (4) the CleanSea models (organogram, flow) are integrated into the CleanSea project.

## Decision
```mermaid
flowchart LR
  T["templates/diagnostico-processos<br/>template.json (bundle v1.1)"] -->|Novo projeto / Novo diagnóstico| D["DIAG-NN no D1<br/>(project_models)"]
  I["Importar JSON<br/>sessão · ORG-NN · FLW-NN"] --> D
  D -->|Modelos: questionário A–I,<br/>Diagrama · Mermaid · Plano · Lacunas| D
  D -->|Canvas: 5 visões| C["Canvas"]
  D -->|models:pull (token só leitura)| G["clients/&lt;slug&gt;/models/_abap/*.json"]
```
1. **Template = data contract, re-implemented natively.** `apps/abap/templates/diagnostico-processos/template.json` holds the bundle's questionnaire schema (9 stages A–I, 18 fields) with the bundle's SHA-256. The minified bundle code is not embedded; the logic (answers → AS-IS process, Mermaid, adaptive plan, gaps) is pure TypeScript in `src/domain/models/`, with tests.
2. **Project models** live in D1 table `project_models` (migration 0003), key `(project_id, id)`, ids `DIAG-NN | ORG-NN | FLW-NN`, kinds `diagnostic | org | flow`. Every write is audited in `project_events` (`model.created | model.imported | model.replaced | model.answers | model.process`).
3. **Creation:** the project form offers "Modelo de interface". Choosing *Diagnóstico de processos* creates `DIAG-01` and opens it. The template itself never changes; the project gets its own copy.
4. **Customisation goes to the client area:** `npm run models:pull -w @clients/<slug>` writes `clients/<slug>/models/_abap/<ID>.json` (read-only machine token; GET only). Hand-made source files stay in `clients/<slug>/models/` and are imported through the app.
5. **CleanSea:** `clients/prj-01-cleansea/models/{DIAG-01.session.json, ORG-01.json, FLW-01.json}` are the sources; the legacy prototype data (`cleansea.v1.json`, prototype HTMLs, extractor) moved from `apps/abap` to `clients/prj-01-cleansea/reference|tools`. `apps/abap` keeps **no client data**; tests use synthetic fixtures (`tests/fixtures/*.sample.json`).
6. **Canvas datasets** = the current project's governance activities + its models (static CleanSea dataset removed).
7. Answers changed in the app become `origin: consultant`, `verification: needs_review`; only the confirmation field at stage I sets `confirmed`. Imported "não validado / por confirmar / inferido" marks stay visible (dashed borders, warnings).

## Consequences
- Production needs migration 0003 + deploy (owner approval), then the CleanSea models are imported into `prj-01-cleansea` (UI upload or API).
- Machine token allow-list now also covers `GET /projects/:id/models[/:modelId]`.
- Not in scope: model deletion, editing org/flow models in the app (re-import with "Substituir"), AI research suggestions of the bundle.
