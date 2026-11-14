O ideal é pedir ao agente para executar uma auditoria, classificação e normalização dos componentes existentes antes de gerar o Design System. Isso evita componentes duplicados, inconsistências visuais e a criação desnecessária de novos elementos.

# ADR-004 — Component Audit & Design System Architecture

**Missão:** analisar, classificar, organizar e normalizar todos os componentes existentes antes de construir o Design System definitivo.

## A. Inventário — Discover

- Inspecionar os arquivos, protótipos, diagramas, páginas e componentes do projeto.
    
- Identificar componentes visuais, funcionais, interativos e estruturais.
    
- Extrair propriedades, variantes, estados, tokens e dependências.
    
- Identificar duplicações, inconsistências e componentes ausentes.
    
- Não criar novos componentes durante esta etapa.
    

## B. Classificação — Taxonomy

Organizar os componentes em seis famílias:

|Família|Componentes|
|---|---|
|**Foundations**|Cores, tipografia, espaçamento, grid, ícones|
|**Primitives**|Button, Input, Badge, Tooltip, Divider|
|**Composites**|Card, Stepper, Tabs, Accordion, Toolbar|
|**Layouts**|Sidebar, Inspector, Canvas, Panel, Workspace|
|**Diagrams**|BPMN, Organogram, Flowchart, Complex Diagram|
|**Patterns**|Tutorial, Dashboard, Workflow, Infographic|

Classificar cada componente por função, complexidade, reutilização e contexto de aplicação.

## C. Normalização — Consolidate

- Consolidar componentes equivalentes em uma única implementação com variantes.
    
- Definir nomenclatura consistente e IDs estáveis.
    
- Estabelecer tokens semânticos compartilhados.
    
- Definir estados: default, hover, focus, selected, disabled, loading e error, quando aplicáveis.
    
- Documentar propriedades, eventos, acessibilidade e comportamento responsivo.
    
- Preservar componentes especializados quando a semântica justificar.
    

## D. Arquitetura — System

Adotar a hierarquia:

**Tokens → Primitives → Composites → Layouts → Diagram Components → Patterns → Templates**

Criar um registro central de componentes com:

`ID | Família | Nome | Função | Variantes | Props | Estados | Dependências | Uso | Status`

Cada componente MUST ter uma ficha técnica e um exemplo contextualizado.

## E. Validação — Quality Gates

- **G1 — Inventário:** todos os componentes identificados.
    
- **G2 — Taxonomia:** classificação sem ambiguidades.
    
- **G3 — Consolidação:** duplicações justificadas ou eliminadas.
    
- **G4 — Arquitetura:** contratos e dependências definidos.
    
- **G5 — Validação:** acessibilidade, responsividade e reutilização verificadas.
    

Não avançar para a geração visual antes de concluir G1–G4.

## F. Entrega

Produzir:

- `COMPONENT_INVENTORY.md` — inventário completo.
    
- `COMPONENT_TAXONOMY.md` — famílias e hierarquias.
    
- `DESIGN_TOKENS.json` — tokens normalizados.
    
- `COMPONENT_REGISTRY.json` — contratos reutilizáveis.
    
- `DESIGN_SYSTEM_ARCHITECTURE.md` — arquitetura e decisões.
    
- `COMPONENT_SHOWCASE` — catálogo visual interativo.
    

**Regra principal:** primeiro compreender o sistema existente; depois consolidar e normalizar; somente então gerar o Design System.

O resultado MUST ser modular, consistente, documentado e reutilizável em diferentes produtos e visualizações da plataforma LOOP.

## Arquitetura esperada

COMPONENT INVENTORY

Auditoria de todos os artefatos existentes

Foundations

Primitives

Composites

Layouts

Diagrams

Patterns

DESIGN SYSTEM REGISTRY

Tokens + componentes + contratos + documentação

LOOP Website

LOOP App

Client Portal

Recomendação: executar este ADR antes dos ADRs de visualização. O catálogo de componentes deve ser a fonte única de verdade para o Canvas, os diagramas BPMN, os organogramas e as páginas institucionais.