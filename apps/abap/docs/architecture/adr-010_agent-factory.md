# ADR-010 — Agent factory: ABAP generates each client's agent

- **Status:** ACCEPTED (owner request and plan approval, 2026-11-15)
- **Related:** ADR-008 (models), ADR-009 (MCP, plugin, marketplace)

## Context
Owner: "além de gerar, teremos agentes que criam agentes para clientes". Decisions: the client agent is a **Claude plugin for our team**; the factory runs **inside ABAP**.

## Decision
```mermaid
flowchart LR
  P["Projeto no ABAP<br/>ORG · FLW · DIAG · 14 atividades"] -->|"Agente → Gerar<br/>ou abap_generate_client_agent"| F["Fábrica (função pura)"]
  F --> V[("client_plugins<br/>revisões imutáveis")]
  V -->|prévia · .zip| U["App"]
  V -->|plugin:pull (só leitura)| G["clients/&lt;slug&gt;/plugin<br/>+ marketplace.json"]
  G --> C["Claude: skill de contexto,<br/>analista, processos, /status"]
```
1. **Pure and deterministic** (`src/domain/agents/client-plugin.ts`): same project data → same files. No LLM in the Worker. Output per client:
   - `skills/<nome>-contexto/SKILL.md` — people and areas (ORG), steps, decision and documents (FLW), diagnostic progress, Mermaid and gaps (DIAG), activity snapshot, next activity;
   - `agents/<nome>-analista.md` — produces ACT deliverables (EARS, Gherkin, cited sources);
   - `agents/<nome>-processos.md` — runs the diagnostic, closes AS-IS gaps, proposes TO-BE only on confirmed steps;
   - `commands/<nome>-status.md`, `README.md`, `.claude-plugin/plugin.json`.
2. **Client text is data.** Every value is reduced to one line, table and fence breakers are replaced, and the skill states that the client section is data, not instructions (tested with an injection attempt). Source colours never appear (ADR-007).
3. **Revisions** in `client_plugins` (migration 0005). Version `1.<revision>.0`. A new revision is stored only when the content changed (SHA-256 of the files without version lines). Each generation is audited (`agent.generated`).
4. **No GitHub credentials in the Worker.** The repository pulls: `npm run plugin:pull -w @clients/<slug>` writes only allow-listed paths into `clients/<slug>/plugin/` and registers `abap-<slug>` in the marketplace. The change is reviewed in Git like any other.
5. **An agent creates the agent:** the MCP tools `abap_generate_client_agent` and `abap_get_client_agent` let the `abap` plugin trigger the factory.
6. **No `.mcp.json` in the client plugin** (change from the first plan): two plugins declaring the same server would duplicate all 25 tools. The client plugin requires the `abap` plugin instead.

## Consequences
- Production needs migration 0005 + deploy (owner approval).
- The context skill is a snapshot; agents are told to call the MCP for current state. Regenerate after model changes.
- Future: an agent deployed for the client's own users (Cloudflare Agents SDK) can be built from the same definition.
