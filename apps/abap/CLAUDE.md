# Claude Code — ABAP platform (apps/abap)

Scope: this folder only. The repository root `CLAUDE.md` (monorepo, clients) also applies. Paths below are relative to `apps/abap/`.

## Mission
Build a web application that faithfully implements the governance workbook's 14 activities, evidence-based completion, dependencies, and dashboard. The workbook (`data/source/Full_Stack_Governance_Workbook.xlsx`) is the initial specification. Do not invent approvals, interviews, test results, or deployed URLs.

## Before changing code
1. Read `README.md` and `docs/architecture/05_adr-001_stack.md`.
2. Inspect existing files, git status, and package scripts. Do not overwrite existing user work.
3. Identify the relevant activity ID (ACT-01 through ACT-14), dependency, deliverable, and acceptance criterion.
4. Explain the smallest change and verification plan. Request approval for destructive operations, remote Cloudflare resources, deploys, or consequential architecture changes.

## Architecture (ADR-001, PROPOSED)
React Router v7 + Hono on Cloudflare Workers; Tailwind + shadcn/ui; D1 + Drizzle; Zod; Vitest + Playwright. Modular monolith.
- `src/domain/governance/` — pure rules. MUST NOT import React, React Router, Hono, Drizzle, or Workers types.
- `src/server/` — Hono API (`/api/v1`), use cases, Drizzle repository.
- `app/` — React Router routes and UI. UI reads data only through `/api/v1` or server loaders that call use cases.
- `workers/app.ts` — Worker entry: Hono first, React Router fallback.
- `src/domain/diagram/` — universal graph + view projectors (pure). Projectors MUST NOT change node data; placed ∪ hidden = all nodes (tested).

## Design system (ADR-004)
- Tokens: `docs/design-system/DESIGN_TOKENS.json` ↔ `app/app.css` (test enforces equality).
- Components: register in `docs/design-system/COMPONENT_REGISTRY.json` first (with metanote if adopted), then code, then `/showcase`. Every `data-component-id` must exist in the registry.
- Diagrams: square geometry; type by label + icon; dashed = not validated (`docs/design/diagramming-system.md`).
- Visualizations must pass `docs/quality/dv-audit_v0.1.md` (no failing MUST).
- Data marked "não validado" (Clean Sea) MUST stay marked; never complete it without the source.

## Operating rules
Follow `../../docs/global-instructions.md` (repository root) (controlled language, EARS/RFC 2119, Gherkin, visual-first, verified execution).

## Non-negotiable domain rules
- Effective completion = `DONE` AND at least one evidence record.
- A dependency is satisfied only if the predecessor is effectively complete.
- Flag precedence (from the workbook): `BLOCKED` > `NO EVIDENCE` (DONE/VERIFIED without evidence) > `DEP PENDING` (dependency not satisfied and status ≠ NOT STARTED) > `OVERDUE`.
- Preserve all eight workbook statuses and stable `ACT-xx` IDs.
- Never derive canonical progress from client state.
- Record auditable mutations (actor, timestamp, from, to).
- Write a mutation and its audit row in one `db.batch()` (D1 has no interactive transactions).

## Engineering rules
- Strict TypeScript; validate external input with Zod.
- Keep domain rules in pure, testable functions.
- Prefer accessible semantic controls and keyboard navigation. Use the CSS tokens in `app/app.css` (from the workbook `Design Tokens` sheet).
- Do not add dependencies without a concrete need.
- No secrets, tokens, or credentials in commits.
- Use Conventional Commits.

## Scripts
`npm run dev`, `lint`, `typecheck`, `test`, `test:e2e`, `build`, `db:generate`, `db:migrate:local`, `seed:local`, `import:workbook`, `extract:cleansea`, `import:dv-criteria`. Check `package.json` before running.

## Execution gates
inspect -> plan -> implement smallest slice -> run relevant checks -> inspect diff -> report results and evidence. Never claim a command passed unless executed. Do not mark a workbook activity DONE unless acceptance criteria are verified and evidence exists.

## Session handoff
End each session with: files changed, commands executed/results, pending decisions, next ACT ID, and exact resume step.
