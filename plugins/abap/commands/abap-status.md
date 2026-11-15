---
description: Situação de um projeto no ABAP (progresso, bloqueios, próxima atividade)
argument-hint: "[projeto, ex.: prj-01-cleansea]"
---
Mostre a situação do projeto ABAP `$ARGUMENTS`.

1. Se nenhum projeto foi informado, chame `abap_list_projects` e pergunte qual.
2. Chame `abap_dashboard` e `abap_list_activities`.
3. Responda em português simples, curto: progresso (DONE com evidência), atividades bloqueadas ou com alerta e o motivo, a próxima atividade que pode avançar (dependência satisfeita) com o critério de aceite, e o que falta do cliente.
Não mude nada no ABAP neste comando.
