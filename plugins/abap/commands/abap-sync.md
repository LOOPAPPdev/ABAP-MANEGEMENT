---
description: Compara e sincroniza a planilha de governança do projeto com o ABAP
argument-hint: "[projeto]"
---
Sincronize a planilha do projeto `$ARGUMENTS` com o ABAP.

1. `abap_sheets_preview` e mostre: mudanças que serão aplicadas, conflitos (planilha × app) e linhas inválidas.
2. Se houver conflitos, pergunte ao usuário, um por um, qual lado vence.
3. Só depois do "sim" do usuário chame `abap_sheets_sync` (com `resolve` = atividades em que a planilha vence).
4. Mostre o resultado e chame `abap_dashboard` para o estado final.
