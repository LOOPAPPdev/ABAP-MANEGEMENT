# Claude Code — ABAP monorepo

ABAP is the consultancy's **services platform**. This monorepo holds the platform and **one workspace per client project**. Each client gets structured documentation first, then code.

## Map
| Path | What | Instructions |
|---|---|---|
| `apps/abap/` | ABAP platform: React Router + Hono on Cloudflare Workers, D1, Google login, Google Sheets + Drive integration | `apps/abap/CLAUDE.md` |
| `clients/<slug>/` | One client project (e.g. `clients/prj-01-cleansea/`): Drive mirror, structured docs, later code | `clients/<slug>/CLAUDE.md` |
| `packages/` | Shared code used by two or more workspaces (empty until needed) | — |
| `tools/` | Monorepo tools: client scaffold, client checks, Drive docs pull | this file |
| `docs/` | Monorepo-level docs (operating rules, client onboarding) | this file |

Nested `CLAUDE.md` files add rules for their folder. On conflict, the stricter rule wins.

## Client lifecycle
1. **Drive** — the client receives a Google Drive folder `PRJ-NN-NAME` with the project spreadsheet (governance model, `DATA_Activities`) and documents.
2. **Scaffold** — `npm run client:new -- PRJ-NN "Name" PRJ-NN-NAME` creates `clients/prj-nn-name/` from `tools/client-template/`.
3. **Register in ABAP** — create the project (same slug), link its Drive folder and spreadsheet in the app. IDs live in ABAP, not in Git.
4. **Sync** — ABAP reads the spreadsheet (status of ACT-01…ACT-14) and the Drive documents. `npm run docs:pull -w @clients/<slug>` writes the documents as Markdown to `clients/<slug>/docs/drive/`.
5. **Document** — produce the ACT deliverables in `clients/<slug>/docs/` from those sources.
6. **Build** — code only after the client's ACT-03, ACT-05 and ACT-06 are approved.

Details: `docs/client-onboarding.md`.

## Rules for every workspace
- Follow `docs/global-instructions.md` (controlled language, EARS + RFC 2119, Gherkin, visual-first, verified execution).
- **No secrets, tokens, Drive/Sheets IDs or personal data in Git.** `npm run check:clients` scans client folders; CI fails on violations.
- Never mix clients: no imports, copies or references from one `clients/<slug>` into another.
- Do not invent approvals, interviews, client facts, test results or deployed URLs. Mark assumptions.
- Do not mark a governance activity DONE; the owner does it with evidence.
- Writes to a client's Drive go only through ABAP, with explicit approval, and are audited.
- Conventional Commits. Scope = workspace when useful: `feat(abap): …`, `docs(prj-01-cleansea): …`.

## Commands (run from the repository root)
| Command | What |
|---|---|
| `npm ci` | Install all workspaces |
| `npm run dev` / `build` / `lint` / `typecheck` / `test` / `test:e2e` | ABAP platform (delegates to `apps/abap`) |
| `npm run check:clients` | Validate client workspaces |
| `npm run client:new -- PRJ-02 "Name"` | New client workspace |
| `npm run docs:pull -w @clients/<slug>` | Pull the client's Drive documents as Markdown (needs `ABAP_URL` and `ABAP_API_TOKEN`) |
| `npm run deploy:kv-assets` | Deploy ABAP to production (see `apps/abap/README.md`) |

## Execution gates
inspect → plan → smallest slice → run checks → inspect diff → report with evidence. Never claim a command passed unless it ran.

## Session handoff
End each session with: files changed, commands and results, pending decisions, next ACT ID (per project), exact resume step.
