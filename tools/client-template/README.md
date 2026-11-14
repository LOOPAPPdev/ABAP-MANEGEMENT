# {{CODE}} — {{NAME}}

Workspace do cliente no monorepo ABAP. Pasta no Google Drive do cliente: **{{FOLDER}}**.

| Pasta | Conteúdo | Quem edita |
|---|---|---|
| `docs/drive/` | Cópia em Markdown dos documentos da pasta do Drive do cliente | **Ninguém à mão.** Gerado por `npm run docs:pull -w @clients/{{SLUG}}` |
| `docs/product/`, `docs/design/`, `docs/architecture/`, `docs/engineering/`, `docs/qa/`, `docs/security/`, `docs/governance/` | Entregáveis estruturados das atividades ACT-01…ACT-14 | Consultoria (com Claude Code) |
| `src/` | Código do cliente (só depois dos gates ACT-03, ACT-05 e ACT-06) | Consultoria |

- Projeto no ABAP: `projectId = {{SLUG}}` (planilha e status das 14 atividades).
- Instruções para o Claude Code: [`CLAUDE.md`](./CLAUDE.md).
