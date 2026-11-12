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
| D-006 | 2026-11-12 | Authentication/roles not implemented; actor from `X-Actor` header, default `local-dev` | Users and roles not yet defined | OPEN — blocks public deploy | Owner |
| D-007 | 2026-11-12 | Single project in MVP; schema keeps `project_id` | Smallest slice | PROPOSED | Owner |
| D-008 | 2026-11-12 | Evidence stores references (URL, commit SHA, repo path, text); no file upload | Avoid storage decisions before need | PROPOSED — R2 candidate later | Owner |
| D-009 | 2026-11-12 | UI labels in English; workbook content kept in Portuguese as imported | Preserve source data verbatim | OPEN — choose UI language | Owner |
| D-010 | 2026-11-12 | Generic metadata-driven template engine (legacy ADR in `reference/xls-pwa/`) deferred | Not needed for the 14-activity MVP | DEFERRED | Owner |
| D-011 | 2026-11-12 | Apply ADR-002/003/004 (LOOP App) to the Governance System instead of a separate LOOP app | Owner choice; reuses real data and one codebase | APPROVED (owner, session) | Owner |
| D-012 | 2026-11-12 | Extract Clean Sea data from `cleansea-operacao-integrada.html` (17 steps, 6 phases) and mark it "não validado"; do not invent the 6 missing steps of the 23 cited in the ADRs | Source Markdown not provided | APPROVED (owner, session) | Owner |
| D-013 | 2026-11-12 | One identity: workbook tokens; CleanSea (teal) and Workspace (purple) palettes not adopted | ADR-004 consolidation | PROPOSED | Owner |
| D-014 | 2026-11-12 | Adopt only 7 of 43 shadcn components (button, tabs, toggle, toggle-group, tooltip, resizable, separator); others catalogued | No dependency without need | PROPOSED | Owner |
| D-015 | 2026-11-12 | Dark mode not implemented (no dark tokens in the workbook) | Avoid inventing tokens | OPEN | Owner |
| D-016 | 2026-11-12 | Canvas is read-only; edits stay on the activity page. Canvas state in URL; panel sizes in localStorage | One mutation path with audit; shareable state | PROPOSED | Owner |
