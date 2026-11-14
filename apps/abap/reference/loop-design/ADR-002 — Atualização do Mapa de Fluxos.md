# ADR-002 — Atualização do Mapa de Fluxos

**Projeto:** LOOP App · Design System  
**Versão:** 1.0 | **Estado:** PROPOSTO  
**Prioridade:** Alta | **Implementação:** Claude Design

## A. Contexto e objetivo

Atualizar o artefato **Mapa de Fluxos** utilizando integralmente o novo Design System e os documentos Markdown de referência.

**Decisão:** substituir a apresentação genérica de componentes por uma experiência funcional, contextualizada e interativa, construída a partir de um caso real: **LOOP Consulting × Clean Sea**.

O resultado MUST demonstrar como os componentes funcionam em conjunto, não apenas como aparecem isoladamente.

## B. Arquitetura da interface

Implementar uma arquitetura **Canvas Workspace**, com cinco regiões integradas:

- **Topbar:** identificação do projeto, versão, navegação, modos de visualização e ações globais.
    
- **Sidebar esquerda:** biblioteca de componentes, estrutura hierárquica, fases, camadas e filtros.
    
- **Canvas central:** área expansível para modelagem, conexões, decisões e visualização sistêmica.
    
- **Inspector direito:** propriedades, dados, responsáveis, documentação e configurações do elemento selecionado.
    
- **Barra contextual:** zoom, minimapa, desfazer/refazer, seleção e controles de visualização.
    

As barras laterais MUST permitir expandir, recolher e redimensionar, preservando o estado e priorizando a área útil do Canvas.

## C. Caso aplicado — Clean Sea

Utilizar o processo operacional da consultoria como cenário principal:

**E0 → A → E1 → B → E2 → C → E3 → D → X12 → Y → Z**

Preservar as 23 atividades, sete fases, decisões, responsáveis e entregáveis definidos no artefato existente.

Distribuir a família de componentes conforme a sua função real:

- **Nós e conectores:** atividades, eventos, decisões, entregáveis e dependências.
    
- **Cards e painéis:** responsáveis, entradas, processamento, saídas e critérios de aceite.
    
- **Tabs e filtros:** alternância entre mapa, raias, gates e entregáveis.
    
- **Formulários e controles:** edição de propriedades, seleção de estados e configuração de cenários.
    
- **Indicadores e feedback:** progresso, riscos, pendências, validações e erros.
    

## D. Metanotas explicativas

Cada componente MUST possuir uma metanota contextual com:

**Nome · Função · Quando utilizar · Dados necessários · Interação · Estado · Regra de UX.**

As metanotas devem aparecer sob demanda, sem obstruir o fluxo principal.

## E. Requisitos técnicos

- Reutilizar os tokens, componentes, variantes e contratos dos arquivos MD.
    
- Manter dados, lógica e apresentação separados.
    
- Implementar interações reais no frontend, com persistência local.
    
- Preparar contratos para integração futura com backend.
    
- Garantir navegação por teclado, foco visível e adaptação responsiva.
    
- Evitar componentes decorativos sem função operacional.
    

## F. Critérios de aceitação

**GIVEN** o Canvas carregado, **WHEN** o usuário selecionar uma atividade, **THEN** o Inspector MUST apresentar seus dados e metanotas.

**GIVEN** uma sidebar expandida, **WHEN** ela for recolhida, **THEN** o Canvas MUST ocupar o espaço disponível.

**GIVEN** o fluxo Clean Sea, **WHEN** o usuário alternar visualizações, **THEN** as relações e os dados MUST permanecer consistentes.

## G. Entrega

Entregar **protótipo navegável, componentes reutilizáveis, metanotas, documentação de arquitetura e relatório de validação**.

**Fora do escopo:** backend de produção, autenticação real e integrações externas.