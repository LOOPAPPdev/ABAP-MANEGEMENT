---
description: Conduz o Diagnóstico de processos (questionário A–I) de um projeto no ABAP
argument-hint: "[projeto] [DIAG-NN opcional]"
---
Conduza o Diagnóstico de processos do projeto `$ARGUMENTS` seguindo a skill `abap-workflow`.

1. `abap_list_models` no projeto. Se não houver diagnóstico, pergunte se deve criar (`abap_create_diagnostic`).
2. `abap_get_model` e leia `progress`, `gaps` e `adaptivePlan`.
3. Faça ao usuário as próximas perguntas do plano, uma etapa por vez (obrigatórias primeiro). Não invente respostas.
4. Salve cada etapa com `abap_save_diagnostic_stage`. Ao terminar a etapa E, chame `abap_regenerate_process` e mostre o diagrama Mermaid.
5. No fim, liste as lacunas que restam e o que precisa ser validado com o cliente.
