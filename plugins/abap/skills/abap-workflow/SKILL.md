---
name: abap-workflow
description: Como trabalhar um projeto de cliente no ABAP pelo MCP `abap` — consultar status e atividades (ACT-01…ACT-14), preencher o Diagnóstico de processos, importar organogramas e fluxos, ler e publicar documentos no Drive do cliente, sincronizar a planilha e gerar o agente do cliente. Use sempre que o pedido citar ABAP, um projeto PRJ-NN, atividades de governança, diagnóstico, modelos DIAG/ORG/FLW ou a pasta do cliente.
---

# ABAP — fluxo de trabalho

O ABAP é a plataforma de serviços da consultoria. Cada cliente é um **projeto** (`prj-NN-nome`) com 14 atividades de governança, modelos de processo e uma pasta no Google Drive. As ferramentas `abap_*` vêm do servidor MCP `abap`.

## Antes de tudo
1. `abap_whoami` — confirme a conexão e a permissão (read ou write).
2. `abap_list_projects` — descubra o identificador do projeto. Nunca adivinhe.

Se as ferramentas `abap_*` não aparecerem: a variável `ABAP_TOKEN` não está definida ou o token foi revogado. Peça ao usuário para criar um token em **ABAP → Settings → Tokens de API** e definir `ABAP_TOKEN` no ambiente. Nunca peça o token no chat.

## Regras que não mudam
- **Nunca marque DONE nem VERIFIED.** O MCP recusa. O owner marca, com evidência.
- **Não invente** fatos do cliente, entrevistas, aprovações, números ou resultados. O que não tem fonte é `[ASSUMPTION]`.
- Dados "não validado", "por confirmar" ou "inferido" **continuam marcados** até o cliente confirmar.
- **Drive do cliente:** mostre o título e o conteúdo ao usuário e espere um "sim" explícito antes de `abap_drive_create_document` (`confirm: true`). Só cria documento novo; nunca sobrescreve.
- **Um design system só:** cores e estilos de arquivos do cliente não são reproduzidos.
- Um cliente nunca usa dados de outro.

## Mapa: tarefa → ferramenta
| Tarefa | Ferramentas |
|---|---|
| Situação do projeto | `abap_dashboard`, `abap_list_activities`, `abap_get_project` (histórico) |
| Detalhe de uma atividade | `abap_get_activity` (critério de aceite, entregável, evidências) |
| Avançar uma atividade | `abap_change_status` (até IN REVIEW/APPROVED), `abap_add_evidence` |
| Novo cliente | `abap_create_project` (opção `template: diagnostico-processos`), `abap_link_project` |
| Diagnóstico de processos | `abap_get_model` (lacunas + plano adaptativo), `abap_save_diagnostic_stage`, `abap_regenerate_process` |
| Organograma / fluxo | `abap_import_model` (JSON ORG-NN / FLW-NN), `abap_list_models` |
| Fontes do cliente | `abap_drive_list`, `abap_drive_read` |
| Entregar documento | `abap_drive_create_document` (com confirmação) |
| Planilha de governança | `abap_sheets_preview` antes de `abap_sheets_sync` |
| Agente do cliente | `abap_generate_client_agent`, `abap_get_client_agent` |

## Diagnóstico de processos (9 etapas A–I)
1. `abap_get_model` → leia `adaptivePlan`: são as próximas perguntas, obrigatórias primeiro.
2. Faça as perguntas ao usuário (ou extraia de `abap_drive_read`, citando o arquivo).
3. `abap_save_diagnostic_stage` com `answers` da etapa. Atividades (etapa E): uma por linha, `Atividade — Responsável`.
4. `abap_regenerate_process` para atualizar o diagrama; o resultado traz o Mermaid para os documentos.
5. Só o cliente confirma: a etapa I (`confirmation`) fica com o usuário.

## Entregáveis das atividades
Os documentos ficam no repositório, em `clients/<projeto>/docs/` (ver o `CLAUDE.md` do cliente): requisitos em EARS + RFC 2119, um GIVEN–WHEN–THEN por requisito, fonte citada para cada fato. Depois de escrever, registre a evidência com `abap_add_evidence` (kind `file` com o caminho, ou `commit`).

## Ao terminar
Informe: o que mudou no ABAP (ferramentas chamadas), o que ficou pendente, quais perguntas restam para o cliente e a próxima atividade (ACT-nn).
