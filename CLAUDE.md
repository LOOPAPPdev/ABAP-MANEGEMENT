# Claude Code — ABAP monorepo

ABAP is the consultancy's **services platform**. This monorepo holds the platform and **one workspace per client project**. Each client gets structured documentation first, then code.

## Map
| Path | What | Instructions |
|---|---|---|
| `apps/abap/` | ABAP platform: React Router + Hono on Cloudflare Workers, D1, Google login, Google Sheets + Drive integration | `apps/abap/CLAUDE.md` |
| `clients/<slug>/` | One client project (e.g. `clients/prj-01-cleansea/`): Drive mirror, structured docs, later code | `clients/<slug>/CLAUDE.md` |
| `packages/` | Shared code used by two or more workspaces (empty until needed) | — |
| `plugins/` | Claude plugins: `plugins/abap` (ABAP MCP + skill + commands) and `plugins/vendor/*` (third-party, copied as received). The repository is the team marketplace (`.claude-plugin/marketplace.json`) | `docs/plugins.md` |
| `tools/` | Monorepo tools: client scaffold, client checks, Drive docs pull, models and plugin pull | this file |
| `docs/` | Monorepo-level docs (operating rules, client onboarding) | this file |

Nested `CLAUDE.md` files add rules for their folder. On conflict, the stricter rule wins.

## Client lifecycle
1. **Drive** — the client receives a Google Drive folder `PRJ-NN-NAME` with the project spreadsheet (governance model, `DATA_Activities`) and documents.
2. **Scaffold** — `npm run client:new -- PRJ-NN "Name" PRJ-NN-NAME` creates `clients/prj-nn-name/` from `tools/client-template/`.
3. **Register in ABAP** — create the project (same slug), link its Drive folder and spreadsheet in the app. IDs live in ABAP, not in Git.
4. **Sync** — ABAP reads the spreadsheet (status of ACT-01…ACT-14) and the Drive documents. `npm run docs:pull -w @clients/<slug>` writes the documents as Markdown to `clients/<slug>/docs/drive/`.
5. **Models** — optional interface template *Diagnóstico de processos* at project creation (DIAG-01), plus imported org charts (ORG-NN) and flows (FLW-NN). `npm run models:pull -w @clients/<slug>` exports them to `clients/<slug>/models/_abap/`.
6. **Client agent** — in ABAP, **Agente → Gerar**: the factory builds the client's Claude plugin from the models and activities. `npm run plugin:pull -w @clients/<slug>` writes it to `clients/<slug>/plugin/` and registers it in the marketplace. Never edit it by hand.
7. **Document** — produce the ACT deliverables in `clients/<slug>/docs/` from those sources.
8. **Build** — code only after the client's ACT-03, ACT-05 and ACT-06 are approved.

Details: `docs/client-onboarding.md`.

## Rules for every workspace
- Follow `docs/global-instructions.md` (controlled language, EARS + RFC 2119, Gherkin, visual-first, verified execution).
- **No secrets, tokens, Drive/Sheets IDs or personal data in Git.** `npm run check:clients` scans client folders; CI fails on violations.
- **One design system** (ABAP bundle, `apps/abap/docs/architecture/adr-007_single-design-system-bundle.md`) for the platform and everything imported. Never reproduce a client file's own styles.
- Never mix clients: no imports, copies or references from one `clients/<slug>` into another.
- Do not invent approvals, interviews, client facts, test results or deployed URLs. Mark assumptions.
- Do not mark a governance activity DONE; the owner does it with evidence.
- Writes to a client's Drive go only through ABAP, with explicit approval, and are audited.
- **Claude ↔ ABAP goes through the MCP** (`/mcp`, plugin `abap`, personal token in `ABAP_TOKEN`). Tokens never enter Git or the chat. The MCP never sets DONE/VERIFIED; Drive writes need the user's explicit yes.
- **Deleting a project is human-only:** only in the app (Projects → Excluir projeto, typed confirmation). Never add a delete tool to the MCP or a token path. `default` is protected.
- `plugins/vendor/*` is third-party code: do not edit; update by replacing the folder (`docs/plugins.md`).
- Conventional Commits. Scope = workspace when useful: `feat(abap): …`, `docs(prj-01-cleansea): …`.
- **Single branch `main`** (`docs/branch-policy.md`): commit and push directly to `main`, no draft PR and no merge question. Run the checks first. Each push to `main` deploys production (Workers Builds, Worker `abap-manegement`). Never force-push.

## Commands (run from the repository root)
| Command | What |
|---|---|
| `npm ci` | Install all workspaces |
| `npm run dev` / `build` / `lint` / `typecheck` / `test` / `test:e2e` | ABAP platform (delegates to `apps/abap`) |
| `npm run check:clients` | Validate client workspaces |
| `npm run client:new -- PRJ-02 "Name"` | New client workspace |
| `npm run docs:pull -w @clients/<slug>` | Pull the client's Drive documents as Markdown (needs `ABAP_URL` and `ABAP_API_TOKEN`) |
| `npm run models:pull -w @clients/<slug>` | Export the client's ABAP models (DIAG/ORG/FLW) to `clients/<slug>/models/_abap/` (same token) |
| `npm run plugin:pull -w @clients/<slug>` | Write the client's generated agent plugin to `clients/<slug>/plugin/` and register it in the marketplace |
| `claude plugin validate .` | Validate the marketplace and plugins |
| `npm run deploy:kv-assets` | Deploy ABAP to production (see `apps/abap/README.md`) |

## Execution gates
inspect → plan → smallest slice → run checks → inspect diff → report with evidence. Never claim a command passed unless it ran.

## Session handoff
End each session with: files changed, commands and results, pending decisions, next ACT ID (per project), exact resume step.
