# Workflow único em 3 passos: Planilha ⇄ Google Sheets ⇄ App no Cloudflare

Fluxo: você atualiza uma atividade no **app** → o app envia ao **Google Sheets** → a planilha recalcula tudo (Home, áreas, Dashboard).
Para ler de volta, o app baixa os dados da planilha. A planilha é a fonte oficial.

> Por que Apps Script e não a API REST do Sheets direto? A API REST exige OAuth ou chave de conta de serviço, e **segredos não podem ficar no navegador**.
> O Apps Script roda dentro da sua conta Google, usa o serviço de planilhas e expõe uma URL protegida por token. É o caminho mais simples para iniciantes.
> (Alternativa avançada: um Cloudflare Worker guardando uma conta de serviço como secret.)

## PASSO 1 — Google: planilha + API (≈10 min)
1. Acesse sheets.google.com → **Arquivo > Importar > Upload** → envie `workbook/Full_Stack_Governance_Workbook.xlsx` → **Criar nova planilha**.
2. Na planilha: **Extensões > Apps Script**. Apague o código, cole o conteúdo de `sync/Code.gs` e salve.
3. No Apps Script: **Configurações do projeto (engrenagem) > Propriedades do script > Adicionar** → nome `TOKEN`, valor = uma senha longa que você inventar (ex.: 32 caracteres aleatórios).
4. **Implantar > Nova implantação > tipo "App da Web"** → *Executar como*: **Eu** · *Quem tem acesso*: **Qualquer pessoa**. Autorize quando pedir. Copie a **URL terminada em /exec**.
5. Teste no navegador: `SUA_URL/exec?action=pull&token=SEU_TOKEN`. Deve aparecer `{"ok":true,"rows":[...]}`.

Importante: toda vez que alterar o `Code.gs`, faça **Implantar > Gerenciar implantações > editar > Nova versão**, senão a URL continua com o código antigo.

## PASSO 2 — Cloudflare: publicar o app (≈5 min)
Opção A (sem terminal): no painel Cloudflare, **Workers & Pages > Create > Pages > Upload assets**, dê um nome e envie **a pasta `app/` inteira** (index.html, sw.js, manifest, ícones, seed.json, _headers).
Opção B (terminal): `npx wrangler pages deploy app --project-name governance-home`.
Ao terminar você recebe `https://SEU-PROJETO.pages.dev`. (Os nomes de menu do painel podem mudar; veja developers.cloudflare.com/pages/.)

## PASSO 3 — Conectar e testar (≈3 min)
1. Abra a URL do app → aba **Sync** → cole a URL `/exec` e o token → **Baixar da planilha**.
2. Aba **Atividades**: mude o Status de `ACT-01` para `DONE` e preencha **Evidence** → **Sync > Enviar alterações**.
3. Abra o Google Sheets: `DATA_Activities` mostra a mudança e a Home/Dashboard recalculam. Volte ao app e clique **Baixar** para confirmar o ciclo.
4. No celular: abra a URL e use **Adicionar à tela inicial** (instala o PWA; funciona offline com os dados já baixados).

### Se algo falhar
- `unauthorized` → token diferente do salvo em Propriedades do script.
- Erro de CORS/“Failed to fetch” → a implantação não está como "Qualquer pessoa", ou você editou o código sem criar **nova versão**.
- Nada muda na planilha → o ID da atividade não existe em `DATA_Activities` (coluna A).
