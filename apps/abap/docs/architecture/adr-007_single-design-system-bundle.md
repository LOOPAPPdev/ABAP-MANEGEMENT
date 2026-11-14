# ADR-007 — One design system for everything: the ABAP bundle

- **Status:** ACCEPTED (owner request, 2026-11-14: "o bundle deve ser o design system permanente aplicado a todo o app"; "devemos ter apenas um design system aplicado a tudo que entra")
- **Supersedes:** D-013 (workbook tokens as the only identity)

## Context
The owner delivered `bundle.html` ("ABAP LOOP · Diagnóstico de processos v1.1"): shadcn/ui neutral theme, DM Sans + DM Mono, radius 0.625rem, plus semantic tokens (selection, note, warning). The owner also delivered `cleansea_modelos.html`, which has its **own** look (department colours, other type). The platform must show one visual language, whatever the source material.

## Decision
1. `apps/abap/app/app.css` holds the bundle tokens **verbatim** (HSL channels). `docs/design-system/DESIGN_TOKENS.json` v2.0.0 mirrors it; a unit test fails if they differ.
2. Fonts are self-hosted (`@fontsource-variable/dm-sans`, `@fontsource/dm-mono`): no external font request.
3. One accessibility addition: `--destructive-strong: 0 72% 42%` (same hue). The bundle red on white is 3.76:1 (< WCAG AA 4.5:1), so text and solid badges use the strong variant; the bundle red stays for borders. `tests/unit/contrast.test.ts` checks 15 pairs.
4. **Imported material never adds tokens.** Client models keep their data; visual attributes (e.g. `departments[].color` in ORG-xx) are dropped by the Zod schema and never reach the UI. Diagrams always use the ABAP diagramming system (square geometry, dashed = not validated).
5. Client areas (`clients/<slug>/`) use this design system when they reach code, unless a client ADR decides otherwise for the client's own product.

## Consequences
- Status badges, canvas stripes and forms were remapped to bundle tokens (no workbook colours remain).
- `clients/prj-01-cleansea/reference/cleansea_modelos.html` is kept as **source evidence only**; its CSS is not reused.
- Dark mode stays out of scope (the bundle defines only a light theme).
