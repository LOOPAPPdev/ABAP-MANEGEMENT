# ADR-001: Arquitetura metadata-driven para ingestão e renderização de templates

**Status:** Proposed (aguarda aprovação — ver "Decisões que exigem sign-off")
**Data:** 2026-11-11
**Deciders:** Dono do produto (você). Revisor técnico sugerido: quem implementar o motor.
**Substitui:** nada. **Relacionado:** `README.md` (pacote Governance), `sync/Code.gs` (sincronização atual).

---

## 1. Contexto

Hoje o app tem **uma** planilha (Governance) codificada à mão: as regras (`eff`, `depOK`, `flag`, progresso) estão duplicadas em JS e em fórmulas do Excel, e as telas foram escritas para aquelas colunas. Isso não escala para outros modelos (Product Management, Engineering, Project Management, QA…).

**Objetivo:** importar uma planilha estruturada uma vez, interpretá-la, renderizá-la com o **mesmo design system** e sincronizá-la de forma confiável, sem desenvolver UI nova a cada template.

**Forças em jogo**
- Usuário único hoje, iniciante em programação; app publicado em Cloudflare Pages; sincronização atual via Google Sheets + Apps Script (token compartilhado, "última gravação vence").
- Excel é **fonte de dados**, mas a API não transporta fielmente fórmulas, macros, formatação ou comportamento: é preciso um mecanismo próprio de interpretação.
- Identidade visual única e acessibilidade não podem depender do template importado.
- Segredos não podem ficar no navegador (requisito para qualquer API corporativa, inclusive Microsoft Graph).

**Três níveis de reprodução** (do documento de origem), usados como critério de aceite:

| Nível | O que reproduz | Meta |
|---|---|---|
| Estrutural | abas, tabelas, colunas, registros | MVP, automático |
| Funcional | validações, dependências, regras derivadas | MVP, subconjunto **declarativo** |
| Semântico | significado → funcionalidade nativa (gate, backlog, roadmap) | pós-MVP, com perfis explícitos |

## 2. Decisão

Adotar uma **Metadata-Driven Application Architecture** com três camadas independentes e um modelo de dados universal no meio:

```
Fontes (XLSX · Google Sheets · Microsoft Graph)        ← SourceAdapter
        │  pull/push de dados e estrutura
        ▼
Template Ingestion Engine  →  TemplateManifest (JSON versionado, validado)
        │  detecção · inferência de tipos · mapeamento · validação
        ▼
Universal Data Model (UDM): Entity · Field · Record · Relation · Rule · View
        │
        ▼
Dynamic UI Renderer  →  usa SOMENTE o Design System (tokens + componentes)
        ▲
Domain Modules (Governance, Product, Engineering…) = perfis + regras + vistas padrão
```

**Camadas (fronteiras rígidas)**
- **A. Global Design System** — tokens, tipografia, componentes, layout, navegação, regras de acessibilidade. Não conhece templates.
- **B. Universal Template Engine** — adapters, detector, manifest, UDM, motor de regras, sincronização, auditoria. Não conhece cores nem DOM.
- **C. Domain Modules** — dados declarativos (perfil de template + regras + vistas padrão). Sem código de UI próprio.

**Cinco decisões que valem como regras de implementação**
1. **O manifest é o contrato.** Nenhuma tela é escrita para um template; toda tela lê um `TemplateManifest`. O manifest **não pode** conter cor, CSS ou HTML: só *tons semânticos* (`neutral | info | progress | success | danger`) que o renderer mapeia para tokens.
2. **Inferência sugere, humano confirma.** O detector gera um manifest *rascunho* com nível de confiança por campo; o usuário aprova antes de ativar. Nada semântico é aplicado automaticamente.
3. **Não reimplementar Excel.** No MVP a **planilha continua sendo a autoridade de cálculo**: o app lê valores já calculados e exibe a fórmula como referência. O app só calcula **regras declarativas** do manifest (agregação, lookup, flag, progresso). Interpretar fórmulas arbitrárias fica atrás de uma interface (`FormulaEvaluator`) para decisão futura (ver §6).
4. **Sincronização com detecção de conflito**, não "última gravação vence": cada registro tem `rev` (hash) e a gravação só passa se o `baseRev` bater; mudanças ficam num log de auditoria append-only.
5. **Adapters isolam a fonte.** O núcleo nunca fala com Google ou Microsoft diretamente; só com `SourceAdapter`.

## 3. Opções consideradas

### A — Módulo codificado por template (status quo)
| Dimensão | Avaliação |
|---|---|
| Complexidade | Baixa agora, crescente por template |
| Custo | Linear por template; regras duplicadas (planilha + JS) |
| Escalabilidade | Ruim: N templates = N bases de código |
| Familiaridade | Alta |

**Prós:** simples, rápido para o 1º template. **Contras:** contradiz o objetivo; deriva entre planilha e app.

### B — "Excel no navegador" (grid + motor de fórmulas genérico)
| Dimensão | Avaliação |
|---|---|
| Complexidade | Alta |
| Custo | Licença do motor (ver §6) + manutenção de compatibilidade |
| Escalabilidade | Boa para estrutura, fraca para UX |
| Familiaridade | Média |

**Prós:** reproduz estrutura e muitas funções. **Contras:** UX de grade, não de app; ignora o design system; sem semântica (não gera gate, progresso, fluxo de aprovação); macros e formatação continuam fora.

### C — Metadata-driven com manifest explícito + inferência assistida (**escolhida**)
| Dimensão | Avaliação |
|---|---|
| Complexidade | Média (alta no motor, baixa por template novo) |
| Custo | Alto no início; marginal por template cai |
| Escalabilidade | Boa: novo template = novo manifest/perfil |
| Familiaridade | Baixa → mitigar com fixtures e testes de paridade |

**Prós:** UI consistente por construção; regras em um lugar; evolui pelos 3 níveis. **Contras:** exige disciplina de contrato e investimento inicial; a inferência nunca será 100%.

### D — Plataforma low-code/BI de terceiros
**Prós:** rápido de começar. **Contras:** identidade visual e modelo de dados fora do seu controle, dependência de fornecedor, custo recorrente. Rejeitada por conflitar com o requisito de design system único.

## 4. Análise de trade-offs

- **C vs A:** paga-se complexidade agora para evitar custo linear depois. Só compensa se houver ≥3 templates previstos (há: Governance, Product, Engineering, PM).
- **C vs B:** B reproduz "o que a planilha faz"; C reproduz "o que a planilha *significa*" dentro do app. O produto que você descreve é C.
- **Planilha como autoridade de cálculo (MVP) vs motor próprio:** evita divergência de resultados e dívida de compatibilidade, ao custo de depender de a fonte recalcular (Google/Excel Online) e de latência. Aceitável porque a Governance já foi validada por recálculo.
- **Declarativo vs Turing-completo:** regras em JSON são auditáveis, testáveis e seguras; perdem-se casos exóticos (ficam como "requer configuração explícita").

## 5. Especificação para produção de código

### 5.1 Estrutura de repositório proposta
```
/packages/design-system     tokens.json, componentes, regras a11y, testes visuais
/packages/template-engine   adapters/ detector/ manifest/ udm/ rules/ sync/ audit/
/modules/governance         profile.json, rules.json, views.json  (dados, não UI)
/apps/web                   PWA (renderer + shell); saída estática p/ Cloudflare Pages
/workers/api                Pages Functions / Worker: proxy de fontes, segredos, OAuth
/fixtures                   xlsx de referência + valores esperados (golden files)
/docs/architecture          este ADR e os seguintes
```
Linguagem: **TypeScript** com validação de schema (JSON Schema + biblioteca de validação em runtime). Migrar o `index.html` único para módulos é um passo do roadmap (M0); o deploy continua estático no Pages.

### 5.2 Contratos principais
```ts
interface SourceAdapter {
  id: 'xlsx-file' | 'google-sheets' | 'ms-graph-excel';
  capabilities: { readStructure: boolean; readFormulas: boolean; readComputed: boolean;
                  write: boolean; atomicBatch: boolean; changeDetection: 'none'|'etag'|'revision' };
  discover(src): Promise<RawWorkbook>;                 // abas, tabelas, cabeçalhos, tipos brutos
  pull(entity, since?): Promise<RawRecord[]>;
  push(entity, patches: Patch[]): Promise<PushResult>; // patch = {id, baseRev, fields}
}

interface TemplateManifest {            // JSON versionado; $schema obrigatório
  manifestVersion: 1; templateId: string; templateVersion: string; source: SourceRef;
  entities: Entity[]; relations: Relation[]; rules: Rule[]; views: View[]; navigation: NavNode[];
}
interface Field { key: string; label: string; column: string;
  type: 'id'|'text'|'longtext'|'enum'|'date'|'number'|'url'|'bool'|'computed';
  role: 'input'|'static'|'computed'|'reference';   // mesmos papéis do workbook (Doc 2)
  enumRef?: string; required?: boolean; confidence?: number; }
```

### 5.3 Manifest de referência (golden fixture = Governance atual)
```json
{
  "manifestVersion": 1, "templateId": "governance", "templateVersion": "1.0.0",
  "entities": [{ "key": "activity", "source": { "sheet": "DATA_Activities", "headerRow": 4, "idField": "ID" },
    "fields": [
      {"key":"ID","type":"id","role":"static"}, {"key":"Phase","type":"enum","role":"static","enumRef":"phases"},
      {"key":"Status","type":"enum","role":"input","enumRef":"statuses"},
      {"key":"Evidence","type":"url","role":"input"}, {"key":"Due","type":"date","role":"input"},
      {"key":"Dependency","type":"id","role":"static"} ]}],
  "relations": [{ "from": "activity.Dependency", "to": "activity.ID", "kind": "prerequisite" }],
  "rules": [
    {"key":"effDone","kind":"expr","expr":"Status == 'DONE' && Evidence != ''"},
    {"key":"depOK","kind":"lookup","via":"Dependency","field":"effDone","default":true},
    {"key":"flag","kind":"firstMatch","cases":[
      ["Status == 'BLOCKED'","BLOCKED"],["(Status in ['DONE','VERIFIED']) && Evidence == ''","NO EVIDENCE"],
      ["!depOK && Status != 'NOT STARTED'","DEP PENDING"],["Due != '' && !effDone && Due < today","OVERDUE"]]},
    {"key":"progress","kind":"aggregate","fn":"ratio","num":"count(effDone)","den":"count(*)","groupBy":["Area","Phase"]},
    {"key":"gate","kind":"aggregate","fn":"all","of":"effDone","groupBy":["Phase"]} ],
  "views": [{ "kind":"bento","eb":["Visão geral","Produto e código","Qualidade e entrega"],"cells":[
      {"h":"Progresso","kind":"progress"},{"h":"Bloqueios","kind":"blockers"},{"h":"Próximo gate","kind":"gate"},{"h":"Product","kind":"area","area":"Product"} ],
      "drilldown":"table","targets":["screen","a4"] },
    { "kind":"dashboard","widgets":[
      {"w":"kpi","rule":"progress"},{"w":"kpi","rule":"flag","where":"== 'BLOCKED'","tone":"danger"},
      {"w":"progressByGroup","groupBy":"Phase","gate":"gate"} ]},
    {"kind":"table","entity":"activity","filters":["Area","Phase","Status"],"inlineEdit":["Status","Priority","Owner","Due","Evidence","Notes"]} ],
  "statusTones": {"NOT STARTED":"neutral","IN PROGRESS":"progress","IN REVIEW":"progress","VERIFIED":"info","DONE":"success","BLOCKED":"danger"}
}
```
A linguagem de `expr` é um **subconjunto fechado** (comparação, `&&`, `||`, `!`, `in`, `count`, `today`), interpretada por parser próprio. **Proibido** `eval`/`Function` em qualquer expressão vinda de template.

### 5.4 Pipeline de interpretação
1. **Discover:** adapter devolve abas, tabelas (Excel Tables quando existirem), cabeçalhos, tipos brutos, validações de dados (listas), fórmulas e valores calculados.
2. **Detect:** heurísticas — linha de cabeçalho, coluna-ID (única e estável), colunas enum (poucos valores distintos / validação de lista), datas, URLs, referências a IDs (relação), colunas calculadas (têm fórmula).
3. **Map:** gera manifest rascunho com `confidence` por campo; ambiguidade (<limiar) vai para a tela de revisão.
4. **Review:** usuário confirma tipos, papéis, relações e perfil de domínio.
5. **Validate:** manifest contra JSON Schema; dados contra manifest (enum, data, obrigatório, FK).
6. **Activate:** grava manifest versionado; renderer gera navegação e vistas.

**Interpretável automaticamente:** tabelas, tipos, enums por validação de lista, IDs, relações por coluna de ID, filtros, tabelas editáveis.
**Exige configuração explícita:** regras derivadas, gates/aprovações, dashboards específicos, fórmulas com intervalos arbitrários, qualquer coisa vinda de macro.

### 5.5 Renderização dinâmica
Registry de componentes do design system: `Table`, `Form`, `Field(<tipo>)`, `StatusBadge(tone)`, `KpiTile`, `ProgressBar`, `FilterBar`, `NavTree`, `RelationLink`, `ApprovalStepper`. O renderer mapeia `type → Field`, `role → input/readonly`, `tone → token`. O **Bento** é a vista de dashboard padrão: um único modelo (`model()`) gera os blocos da tela e do A4, e cada bloco declara seu *drilldown* (filtro da tabela). Tela e papel usam o mesmo componente; só mudam os tokens de superfície. Um teste de lint falha o build se um manifest ou componente de domínio contiver cor/estilo literal.

### 5.6 Modelo de sincronização
- **Import inicial:** snapshot + manifest + `rev` por registro (hash estável dos campos de input).
- **Atualização:** pull incremental (por revisão/ETag quando o adapter suportar; senão diff por hash).
- **Escrita:** `push(patches)` com `baseRev`; a fonte rejeita divergências (`409 conflict`).
- **Conflito:** três vias por campo (base × local × remoto). Campos diferentes → mescla automática; mesmo campo → vai à fila de resolução na UI (manter local/remoto/editar).
- **Auditoria:** log append-only `{ts, actor, source, entity, id, field, old, new, opId}`; no MVP em IndexedDB local + exportado para uma aba `_AUDIT` na própria planilha.
- **Versionamento:** manifests versionados (semver); mudança estrutural na fonte (coluna removida/renomeada) = *drift* → bloqueia sincronização e pede reimport/mapeamento.
- **Integridade:** IDs imutáveis; escrita só em colunas `role: input`; lote atômico quando o adapter permitir.

### 5.7 Estratégia de APIs por adapter
| Adapter | Quando | Observações (verificar na documentação oficial antes de implementar) |
|---|---|---|
| `xlsx-file` | M1 | Parse local do arquivo (sem rede). Lê estrutura, validações, fórmulas e valores em cache. Sem escrita. |
| `google-sheets` | M3 | Evolução do `Code.gs` atual: `baseRev`, `_AUDIT`, proxy por Worker. |
| `ms-graph-excel` | M4 | Workbook API sobre arquivo no OneDrive/SharePoint. Fontes consultadas descrevem: acesso só a arquivos na nuvem (não local/Excel desktop); tabelas como objeto de 1ª classe; sessões persistentes (reutilizar `workbook-session-id`; expiram após poucos minutos de inatividade, ~5 min persistente / ~7 min não persistente segundo resposta da Microsoft); evitar escritas concorrentes no mesmo workbook; escrever valor numa célula com fórmula substitui a fórmula; cálculo pode atrasar (usar `/calculate`); endereços em A1; limite de payload de ~5 MB relatado por terceiros; sujeito a throttling. **Estas afirmações vêm de fontes secundárias e de uma resposta no Microsoft Q&A; confirmar em learn.microsoft.com (Graph Excel, sessions, throttling) antes de codar.** |

### 5.8 Segurança e permissões
- **Segredos só no servidor:** tokens de fonte e credenciais OAuth ficam em Worker/Pages Function (secrets do Cloudflare); o navegador recebe apenas sessão do app. O token em `localStorage` do protótipo atual é **dívida aceita só para uso pessoal**.
- **Microsoft Graph:** OAuth 2.0 delegado (MSAL), menor escopo possível; consentimento do tenant pode exigir administrador. Decisão de auth detalhada em **ADR-002** (pendente).
- **Entrada hostil:** XLSX é ZIP — limitar tamanho, nº de arquivos/ratio de descompressão e tempo de parse; sanitizar texto (nunca `innerHTML` com dado de célula); permitir só `https:` em hiperlinks; CSP restritivo.
- **Permissões (RBAC no manifest):** `viewer | editor | approver | admin` por entidade/campo; o adapter nunca recebe patch em campo não-input.
- **Privacidade:** snapshots e auditoria podem conter dados sensíveis; definir retenção e local de armazenamento (ver decisão 4).

## 6. Riscos técnicos e limitações

| Risco | Impacto | Mitigação |
|---|---|---|
| Fórmulas arbitrárias, macros (VBA) e formatação não são portáveis | Funcional parcial | Planilha como autoridade de cálculo; regras declarativas; macros fora de escopo |
| Motor de fórmulas: o HyperFormula (~400 funções, sintaxe compatível com Excel/Sheets) é GPLv3 **ou** licença comercial | Risco jurídico se o app for fechado/comercial | Isolar atrás de `FormulaEvaluator`; decidir licença antes de adotar; alternativa: só regras declarativas |
| Inferência errada de tipos/relações | Dados mal interpretados | Rascunho + confirmação humana + `confidence` |
| Drift de estrutura na fonte | Sync quebrado/corrupto | Detecção de drift bloqueia escrita |
| Google Apps Script: CORS (exige `text/plain`), cotas, "Anyone" + token | Frágil em escala | Worker como proxy; Sheets API/OAuth no M3 |
| Throttling e sessões do Graph | Falhas intermitentes | Fila por workbook, retry com backoff, 1 escrita por vez |
| Escopo (motor genérico é um produto em si) | Atraso | MVP mínimo (abaixo); fixtures como régua; cortar semântica auto |
| Iniciante único mantendo arquitetura sofisticada | Risco de manutenção | Roadmap em marcos pequenos, testes de paridade, docs de cada módulo |

## 7. Arquitetura mínima viável (MVP)

Inclui: `xlsx-file` + `google-sheets`; detector de estrutura; manifest + validação; renderer com `Table`, `Form`, `StatusBadge`, `KpiTile`, `ProgressBar`, `FilterBar`, `NavTree`; regras declarativas (`expr`, `lookup`, `firstMatch`, `aggregate`); conflito por `baseRev`; log de auditoria local; **um** perfil de domínio (Governance).
Exclui: Graph, perfis semânticos automáticos, fluxo de aprovação genérico, RBAC fino, motor de fórmulas genérico.

## 8. Roadmap com dependências e critérios de aceite

| Marco | Entrega | Depende de | Critério de aceite |
|---|---|---|---|
| **M0 Fundações** | Extrair tokens + componentes do app atual; schema do manifest + validador; fixture Governance | — | App atual renderiza a partir do manifest e mostra **os mesmos KPIs** da planilha recalculada (teste de paridade automatizado) |
| **M1 Ingestão estrutural** | Adapter `xlsx-file`, detector, tela de revisão | M0 | ≥3 fixtures distintas (Governance, backlog simples, roadmap) geram manifest válido; revisão humana ≤ N correções (meta a calibrar com os fixtures) |
| **M2 Funcional** | Motor de regras declarativas, validações, dependências | M0 | Resultados idênticos aos da planilha em todas as linhas das fixtures; `eval`/`Function` ausentes (teste estático) |
| **M3 Sync v2** | `baseRev`, 3-way merge, `_AUDIT`, Worker proxy, Sheets hardening | M0, M2 | Teste: duas edições concorrentes no mesmo campo geram conflito; em campos distintos, mesclam; zero segredos no bundle do navegador |
| **M4 Adapter Graph** | OAuth, sessões, tabelas, throttling | M3, ADR-002 | Round-trip pull→editar→push em workbook no OneDrive/SharePoint de teste, sem perda de fórmulas nas colunas não-input |
| **M5 Perfis semânticos** | Product Mgmt, Engineering; sugestão automática de perfil | M1–M3 | Novo template de domínio entra **sem escrever código de UI** (só manifest/perfil) |

## 9. Consequências

- **Fica mais fácil:** adicionar templates; garantir consistência visual e de acessibilidade; testar regras em um só lugar; auditar mudanças.
- **Fica mais difícil:** o primeiro template custa mais; exige disciplina de contrato; precisa de infraestrutura de servidor (Worker) para segredos.
- **A revisitar:** licença do motor de fórmulas; local de armazenamento de snapshots/auditoria; modelo de permissões multiusuário; limites do Apps Script.

## 10. Decisões que exigem sign-off

1. Aprovar a abordagem C (manifest + camadas A/B/C) e o **MVP** da §7.
2. **Autoridade de cálculo:** confirmar "planilha calcula, app só aplica regras declarativas" no MVP.
3. **Licenciamento:** o app será de código aberto/uso pessoal ou comercial? Define se o HyperFormula (GPLv3) é viável.
4. **Armazenamento** de snapshots/auditoria: IndexedDB local apenas, ou banco no Cloudflare (a avaliar).
5. **Microsoft Graph:** há conta/tenant Microsoft 365 para testes? Sem isso, M4 fica bloqueado.

## 11. Action items

1. [ ] Aprovar este ADR (ou registrar objeções) e mudar o status para *Accepted*.
2. [ ] Verificar na documentação oficial os itens marcados na §5.7 (Graph) e na §6 (licença do HyperFormula).
3. [ ] M0: criar `packages/design-system` e extrair tokens/componentes do `app/index.html`.
4. [ ] M0: transformar o exemplo da §5.3 em `modules/governance/manifest.json` + JSON Schema.
5. [ ] M0: criar o teste de paridade (valores da planilha recalculada × renderer).
6. [ ] Abrir ADR-002 (autenticação e segredos: Worker, OAuth, Graph).
7. [ ] Criar fixtures: Governance + 2 templates adicionais.

## 12. Fontes consultadas nesta sessão

Documentação e artigos de terceiros sobre a Graph Excel API (sessões, tabelas, limites) e o repositório/documentação do HyperFormula (funções, licença). Nenhuma foi confirmada na documentação primária da Microsoft nesta sessão. As listas de endpoints e limites devem ser tratadas como **hipóteses a validar** (ação 2).
