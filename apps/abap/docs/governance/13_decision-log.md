# 13 — Decision Log

- Activity: **ACT-13** (decisions part). Risks: see `docs/plan/implementation-plan_A-G.md`.
- Format: one row per decision. Status: PROPOSED → APPROVED / REJECTED / SUPERSEDED.

| ID | Date | Decision | Rationale | Status | Owner / approver |
| --- | --- | --- | --- | --- | --- |
| D-001 | 2026-11-12 | Cloudflare-native modular monolith (React Router + Hono on Workers, D1 + Drizzle) instead of Next.js + PostgreSQL (ADR-001 Option B) | One vendor, no DB server locally, owner already on Cloudflare | PROPOSED (owner chose this direction in session; formal ADR approval pending ACT-03) | Owner |
| D-002 | 2026-11-12 | Rebuild the official `react-router-hono-fullstack-template` layout from npm packages | Template download (GitHub archive) blocked in build environment (HTTP 403) | APPLIED — revisit | Claude Code |
| D-003 | 2026-11-12 | Workbook is a one-time import into a versioned JSON fixture; D1 is the operational source of truth | Avoid two writable sources; keeps workbook unchanged | PROPOSED | Owner |
| D-004 | 2026-11-12 | Status changes are flagged, not rejected (DONE without evidence and pending dependency are allowed but not counted) | Mirrors workbook behaviour; keeps owner in control | PROPOSED — alternative: hard reject | Owner |
| D-005 | 2026-11-12 | Excel import recurrence: one-time (default) | Simplicity | PROPOSED | Owner |
| D-006 | 2026-11-12 | Authentication: Google login + allow-list of e-mails (secret), actor = signed-in e-mail (ADR-005). Local bypass only in development without Google secrets | Required before public deploy | RESOLVED (owner, session) | Owner |
| D-007 | 2026-11-14 | Multi-project: one project per client (id = client slug), own activities, spreadsheet, sync mode, Drive folder (ADR-006) | Platform for many clients | RESOLVED (owner, session) | Owner |
| D-008 | 2026-11-12 | Evidence stores references (URL, commit SHA, repo path, text); no file upload | Avoid storage decisions before need | PROPOSED — R2 candidate later | Owner |
| D-009 | 2026-11-12 | UI labels in English; workbook content kept in Portuguese as imported | Preserve source data verbatim | OPEN — choose UI language | Owner |
| D-010 | 2026-11-12 | Generic metadata-driven template engine (legacy ADR in `reference/xls-pwa/`) deferred | Not needed for the 14-activity MVP | DEFERRED | Owner |
| D-011 | 2026-11-12 | Apply ADR-002/003/004 (LOOP App) to the Governance System instead of a separate LOOP app | Owner choice; reuses real data and one codebase | APPROVED (owner, session) | Owner |
| D-012 | 2026-11-12 | Extract Clean Sea data from `cleansea-operacao-integrada.html` (17 steps, 6 phases) and mark it "não validado"; do not invent the 6 missing steps of the 23 cited in the ADRs | Source Markdown not provided | APPROVED (owner, session) | Owner |
| D-013 | 2026-11-12 | One identity: workbook tokens; CleanSea (teal) and Workspace (purple) palettes not adopted | ADR-004 consolidation | SUPERSEDED by D-027 | Owner |
| D-014 | 2026-11-12 | Adopt only 7 of 43 shadcn components (button, tabs, toggle, toggle-group, tooltip, resizable, separator); others catalogued | No dependency without need | PROPOSED | Owner |
| D-015 | 2026-11-12 | Dark mode not implemented (no dark tokens in the workbook) | Avoid inventing tokens | OPEN | Owner |
| D-016 | 2026-11-12 | Canvas is read-only; edits stay on the activity page. Canvas state in URL; panel sizes in localStorage | One mutation path with audit; shareable state | PROPOSED | Owner |
| D-017 | 2026-11-12 | Google Sheets is the editing source for Status, Priority, Owner, Due, Notes, Evidence; app reads it (read-only scope) with a three-way merge | Owner edits in Sheets; app edits must not be reverted | APPROVED (owner, session) | Owner |
| D-018 | 2026-11-12 | Sync mode: automatic on open by default; preview + apply available as a toggle | Owner choice ("ambos") | APPROVED (owner, session) | Owner |
| D-019 | 2026-11-12 | Integration implemented in this repository, not in a new `consultoria-platform` monorepo | Session can only write to this repository; one Worker | APPROVED (owner, session) | Owner |
| D-020 | 2026-11-12 | All account-specific values (client ID/secret, spreadsheet ID, allowed e-mails, keys) are Cloudflare secrets, never committed | Privacy and secret hygiene | APPLIED | Claude Code |
| D-021 | 2026-11-12 | Production deployed with static files served from KV (`deploy:kv-assets`) because the Static Assets upload API returned 401 behind the session proxy. Standard `deploy` remains supported without code changes | Unblock deploy from the agent session | APPLIED — revert to standard deploy when deploying from CI or a workstation | Claude Code |
| D-022 | 2026-11-14 | Monorepo with npm workspaces: apps/abap, clients/<slug>, packages/, tools/ | One repo for platform + clients; Claude Code context per client | APPROVED (owner, session) | Owner |
| D-023 | 2026-11-14 | Each client = folder `clients/<slug>` (not a separate GitHub repo) | Owner choice; session can only write this repo | APPROVED (owner, session) | Owner |
| D-024 | 2026-11-14 | Google Drive read **and write** through ABAP with scope `drive` (restricted); writes create new Docs only, with confirmation and audit | Owner asked for read + write | APPROVED (owner, session) — publishing the Google app needs verification | Owner |
| D-025 | 2026-11-14 | Drive docs mirrored to `clients/<slug>/docs/drive` by `docs:pull` with a read-only machine token; hashed keys, Drive URLs omitted | Code production needs local Markdown; no Google IDs in Git | APPLIED | Claude Code |
| D-026 | 2026-11-14 | Client spreadsheets use the same governance model (DATA_Activities, 14 activities) | Owner answer | APPROVED (owner, session) | Owner |
| D-027 | 2026-11-14 | The bundle (shadcn neutral, DM Sans/DM Mono) is the only design system of ABAP and of everything imported; client colours dropped; `--destructive-strong` added for AA (ADR-007) | Owner request: one design system for everything | APPROVED (owner, session) | Owner |
| D-028 | 2026-11-14 | Bundle = interface template (`diagnostico-processos` v1.1), re-implemented natively from its data contract; projects get models DIAG/ORG/FLW in D1 `project_models` (ADR-008) | Owner request items 2–4 | APPROVED (owner, session) | Owner |
| D-029 | 2026-11-14 | Client data leaves `apps/abap`: CleanSea legacy data, prototypes and extractor moved to `clients/prj-01-cleansea`; tests use synthetic fixtures; models exported to the client area by `models:pull` | Never mix platform and client data | APPLIED | Claude Code |
