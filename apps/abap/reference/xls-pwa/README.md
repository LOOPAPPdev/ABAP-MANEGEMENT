# Governance Package — Full Stack Project Development Workbook + PWA

Modelo reutilizável de governança de projetos de software: planilha Excel (sem macros) + app PWA (expansão do Bento) + sincronização via Google Sheets.

```
governance-package/
├─ workbook/Full_Stack_Governance_Workbook.xlsx   # planilha
├─ app/                                           # envie esta pasta ao Cloudflare Pages
│  ├─ index.html  sw.js  manifest.webmanifest  _headers  seed.json  icon-192.png  icon-512.png
├─ sync/Code.gs                                   # API no Google Apps Script
├─ docs/TUTORIAL_3_PASSOS.md                      # workflow em 3 passos
└─ docs/architecture/ADR-001_metadata-driven-template-engine.md   # decisão de arquitetura
```

## Arquitetura
`00 GOVERNANCE HOME` (entrada) → `DATA_Activities` (tabela central `tblActivities`, IDs únicos ACT-nn) → abas de área (**Product, Design, Engineering, Documentation, QA & Security, Deployment**, só fórmulas) → `Dashboard`.
Apoio: `DATA_Lists` (listas), `Design Tokens` (registro de tokens), `Data Dictionary`, `Guide`.
As 14 fases do ciclo de vida (Documento 1) são agrupadas nas 6 áreas (Documento 2): Product 01–03 · Design 04–06 · Engineering 07–08 · QA & Security 09–10 · Documentation 11 e 13 · Deployment 12 e 14.

Regra central: **DONE só conta como concluída com Evidence preenchida.** Gate de fase = todas as atividades concluídas. Dependência = ID da atividade pré-requisito.
Flags: BLOCKED · NO EVIDENCE · DEP PENDING · OVERDUE.

## Guia rápido
Home → Quick Update (escolha o ID, clique no link) → edite Status/Owner/Due/Evidence (colunas M:R de `DATA_Activities`, borda azul). Ou atualize pelo app. Dicionário completo na aba `Data Dictionary`.
Novas atividades: *Unprotect Sheet* (sem senha) → próxima linha vazia (capacidade 100) → proteger de novo.

## Validação executada
Recalculo completo (LibreOffice): 4.122 fórmulas, 0 erros. Teste com dados fictícios confirmou progresso, DONE sem evidência, bloqueio, dependência pendente, atraso, visões de área e Dashboard. Listas suspensas, formatação condicional e proteção foram criadas por código; **não foram abertas no Excel desktop** — abra e confira (ver lista abaixo).

## Limitações e decisões em aberto
- **Sem macros:** a Home não grava dentro de outras abas; ela navega, resume e leva à linha certa. Entrada centralizada de verdade ocorre no **app**, via Apps Script. Gravação bidirecional nativa exigiria VBA/Office Scripts.
- **Google Sheets:** links internos `#` da Home funcionam no Excel, não no Sheets (precisam de gid); proteção de células e algumas formatações condicionais podem não importar fielmente. Fórmulas usam só funções clássicas (INDEX/MATCH/COUNTIFS) por compatibilidade.
- **Tabelas:** a tabela tem 100 linhas preparadas (fórmulas pré-preenchidas) em vez de auto-expansão; fórmulas usam intervalos A1, não referências estruturadas, para funcionar no Sheets.
- **Biblioteca de atividades enxuta:** 14 atividades (1 por fase) com tutorial, aceite e dependência; entradas/saídas foram fundidas em *Deliverable*; sem colunas separadas de Input/Output. Expanda conforme o projeto. Stack, responsáveis e datas: **A DEFINIR**.
- **Links de referência:** apenas fontes oficiais conhecidas (W3C, OWASP, Git, SemVer, Cloudflare, ADR, Playwright, Conventional Commits, Write the Docs); **não foram verificados online** nesta sessão (sem rede no ambiente). Confirme antes de depender deles. Onde não havia fonte segura, está “—”.
- **Cor de alerta:** `B10E1C` é o único acento não monocromático (bloqueio/crítico). Para 100% monocromático, troque por `242424` no registro de tokens.
- **Segurança:** Web App “Qualquer pessoa” + token compartilhado é adequado a uso pessoal; o token fica no armazenamento local do navegador. Não use para dados sensíveis.
- **Bento integrado:** o dashboard da Home e o A4 vêm do mesmo modelo, definido em `seed.json > bento` (9 blocos: 3 partes × 3). Cada bloco abre as atividades filtradas (área, fase ou alerta). Editar o A4 cria exceções só do documento (botão “Restaurar dados”). O questionário mobile em dock e os modelos Lorem do Bento original não foram portados. Após atualizar o app no Cloudflare, o service worker (`gov-v2`) renova o cache na próxima abertura.

## Checklist de verificação no Excel
1. Abrir sem alerta de reparo. 2. Dropdown de Status em `DATA_Activities!M`. 3. Home: link “Open … ➜” e QUICK UPDATE. 4. Marcar ACT-01 como DONE sem Evidence → flag NO EVIDENCE; com Evidence → progresso sobe. 5. Tentar editar célula azul-cinza (calculada) → bloqueada.
