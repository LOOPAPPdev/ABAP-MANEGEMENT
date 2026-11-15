# PRJ-01 — CleanSea

Workspace do cliente no monorepo ABAP. Pasta no Google Drive do cliente: **PRJ-01-CLEANSEA**.

| Pasta | Conteúdo | Quem edita |
|---|---|---|
| `docs/drive/` | Cópia em Markdown dos documentos da pasta do Drive do cliente | **Ninguém à mão.** Gerado por `npm run docs:pull -w @clients/prj-01-cleansea` |
| `docs/product/`, `docs/design/`, `docs/architecture/`, `docs/engineering/`, `docs/qa/`, `docs/security/`, `docs/governance/` | Entregáveis estruturados das atividades ACT-01…ACT-14 | Consultoria (com Claude Code) |
| `models/` | Modelos fonte: `DIAG-01.session.json` (Diagnóstico de processos), `ORG-01.json` (organograma), `FLW-01.json` (fluxo). Importados no ABAP em *Modelos* | Consultoria |
| `models/_abap/` | Cópia dos modelos como estão no ABAP | **Ninguém à mão.** Gerado por `npm run models:pull -w @clients/prj-01-cleansea` |
| `docs/architecture/` | **Stack e ADRs.** `README.md` = quadro do stack (atualizado antes de cada ADR); `CLAUDE.md` = regras e registro de ADRs. Verificação: `npm run adr:lint -w @clients/prj-01-cleansea` | Consultoria (com Claude Code) |
| `reference/` | Artefatos originais do cliente (HTML, dados legados). Só evidência: o visual deles **não** é usado | — |
| `reference/design-handoff-cleansea-app/` | Handoff de design do app mobile (protótipo HTML navegável + README). Referência de telas e fluxos; **não** é código de produção (ADR-013) | — |
| `src/` | Código do cliente (só depois dos gates ACT-03, ACT-05 e ACT-06) | Consultoria |

- Projeto no ABAP: `projectId = prj-01-cleansea` (planilha e status das 14 atividades).
- Stack do app (engenharia): [`docs/architecture/README.md`](./docs/architecture/README.md).
- Instruções para o Claude Code: [`CLAUDE.md`](./CLAUDE.md).
