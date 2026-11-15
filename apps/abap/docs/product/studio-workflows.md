# Studio — workflows (ADR-011)

Three workflows. Each step names who does it and where.

## W1 · Publicar um artefato no studio do cliente

```mermaid
flowchart LR
  accTitle: Publish an artifact
  accDescr: A consultant adds the files and a manifest in the client workspace, runs the publish command with a write token, ABAP stores a new revision only if the content changed, and the studio shows it with its notice.
  A["1 Consultoria<br/>arquivos em clients/&lt;slug&gt;/…<br/>+ studio/&lt;artefato&gt;.json"] --> B["2 npm run studio:publish<br/>-w @clients/&lt;slug&gt;"]
  B --> C{"3 ABAP valida<br/>tipos, tamanhos, aviso"}
  C -- inválido --> X["erro com o campo"]
  C -- igual --> U["sem revisão nova"]
  C -- mudou --> R["4 revisão rN + project_events"]
  R --> S["5 /studio/&lt;projeto&gt;"]
```

| Passo | Regra |
|---|---|
| Manifesto | `slug`, `title`, `notice` (obrigatório), `entry` (.html), `dir` dentro do workspace do cliente |
| Token | Pessoal, role **write** (`ABAP_TOKEN` ou `.abap-token`, nunca no Git) |
| Resultado | Revisão nova só quando o conteúdo muda |

## W2 · Convidar uma pessoa do cliente

```mermaid
sequenceDiagram
  accTitle: Invite a client person
  accDescr: Staff invite an e-mail in the studio, share the login link, the person signs in with Google, the invitation becomes active and the person lands in the studio of that project only.
  participant E as Equipe (ALLOWED_EMAILS)
  participant A as ABAP
  participant C as Pessoa do cliente
  E->>A: Studio → Membros → Convidar (e-mail, papel)
  A-->>E: convite registrado (status convidado)
  E->>C: envia o link /login (fora do ABAP)
  C->>A: Entrar com Google (e-mail convidado)
  A->>A: convidado → ativo, project_events
  A-->>C: /studio/<projeto> (só leitura)
```

| Regra | Detalhe |
|---|---|
| Quem convida | Só a equipe, no app. Sem MCP, sem token |
| O que o convidado vê | Só o studio dos projetos que o convidaram. Governança, modelos, Drive, tokens e outros projetos: bloqueados |
| Conta | Conta Google do e-mail convidado |

## W3 · Revogar o acesso

```mermaid
flowchart LR
  accTitle: Revoke access
  accDescr: Staff revoke a member in the studio; the next request of that person is refused; the row is kept with who and when.
  A["Equipe: Revogar"] --> B["status revogado<br/>quem e quando"] --> C["próxima requisição<br/>da pessoa: sem acesso"]
```

O registro nunca é apagado. Convidar de novo reativa a pessoa como "convidado".
