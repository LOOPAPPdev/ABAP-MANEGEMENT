# Plugin `abap`

Conecta o Claude (Code ou Desktop) ao **ABAP**, a plataforma de serviços da consultoria, pelo servidor MCP hospedado na Cloudflare.

## Instalar (uma vez)
1. No ABAP, abra **Settings → Tokens de API**, crie um token com o seu nome (ex.: `joao-laptop`) e copie o valor. Ele aparece uma única vez.
2. Guarde o token numa variável de ambiente do seu computador (nunca no Git, nunca no chat):

```bash
echo 'export ABAP_TOKEN="cole-o-token-aqui"' >> ~/.zshrc
```

3. No Claude Code, adicione o marketplace e instale:

```
/plugin marketplace add loopappdev/abap-manegement
/plugin install abap@abap
```

Quem abre este repositório no Claude Code já recebe o marketplace e o plugin pelas configurações do projeto (`.claude/settings.json`).

## Conferir
Rode `/mcp` no Claude Code: o servidor `abap` deve aparecer conectado. Depois peça: *"liste os projetos do ABAP"*.

## O que vem no plugin
| Item | Para quê |
|---|---|
| MCP `abap` | 25 ferramentas `abap_*`: projetos, atividades, modelos, Drive, planilha, agente do cliente |
| Skill `abap-workflow` | Regras e passo a passo; o Claude carrega sozinho quando o assunto é ABAP |
| `/abap-status [projeto]` | Situação do projeto |
| `/abap-diagnostico [projeto]` | Conduz o questionário do Diagnóstico de processos |
| `/abap-sync [projeto]` | Prévia e sincronização da planilha |

## Limites de segurança
- Token **só leitura** não altera nada. Token **leitura e escrita** faz o mesmo que o app.
- O MCP nunca marca atividade como DONE ou VERIFIED.
- Publicar no Drive do cliente exige confirmação explícita e só cria documento novo.
- Toda alteração fica no histórico do projeto com o nome do token.
- Perdeu o computador ou o token vazou: **Settings → Tokens de API → Revogar** (efeito imediato).
