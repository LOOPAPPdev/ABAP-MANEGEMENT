# ADR-003 — Arquitetura Visual Multiview

**Projeto:** LOOP App | **Artefato:** Mapa de Fluxos  
**Estado:** Proposto | **Referência:** Claude Design

## A. Objetivo e decisão

- Atualizar o artefato existente com o novo Design System, utilizando toda a família de componentes disponíveis.
    
- Substituir apresentações genéricas por cinco aplicações contextualizadas, baseadas nos arquivos de referência.
    
- Implementar um **Canvas Multiview**, no qual o usuário possa alternar livremente entre estruturas visuais sem perder dados, conexões ou contexto.
    
- Preservar a consistência visual, a semântica dos diagramas e os padrões de UI/UX.
    

## B. Aplicação dos arquivos

**1.** `**Como trabalhamos.md**` **— Infográfico institucional**

- Transformar a metodologia de trabalho em uma sequência visual interativa.
    
- Aplicar componentes de etapas, timelines, cards, conectores, indicadores e progressão.
    
- Destino: website institucional e apresentação da consultoria.
    
- Adicionar metanotas explicando cada componente, sua função e seu contexto.
    

**2.** `**Metodo loop.md**` **— Tutorial interativo**

- Demonstrar o método LOOP por meio de uma jornada guiada.
    
- Aplicar stepper, cards expansíveis, fluxos, tooltips, estados e componentes de decisão.
    
- Permitir avançar, retroceder, explorar detalhes e reiniciar o tutorial.
    
- Destino: website, onboarding e documentação visual.
    

**3.** `**Clean Sea Pipeline Completo.md**` **— Processo BPMN**

- Transformar o processo operacional em um diagrama BPMN estruturado.
    
- Aplicar eventos, atividades, gateways, subprocessos, pools, lanes e conectores.
    
- Representar responsáveis, dependências, exceções, aprovações e entregáveis.
    
- Preservar a sequência operacional e identificar dados ou decisões ainda não validados.
    

**4. Imagem da planilha — Organograma**

- Interpretar a estrutura organizacional representada na imagem.
    
- Aplicar nós hierárquicos, agrupamentos, cards de pessoas, funções e departamentos.
    
- Diferenciar hierarquia, colaboração e responsabilidade operacional.
    
- Permitir expandir departamentos e consultar relações.
    

**5. Visão integrada — Diagramas complexos**

- Integrar organograma, processos, informações, decisões e dependências.
    
- Utilizar complex diagrams, cards, containers, edges e agrupamentos semânticos.
    
- Permitir explorar relações entre pessoas, atividades, sistemas e resultados.
    

## C. Arquitetura Canvas Multiview

- **Sidebar esquerda:** biblioteca, arquivos, camadas e estruturas.
    
- **Canvas central:** edição, navegação e visualização.
    
- **Inspector direito:** propriedades, metanotas e configurações.
    
- **Toolbar:** alternância de visualizações, zoom, filtros e controles.
    

**View Toggle — controle universal**

- Disponibilizar: `Infográfico | Tutorial | BPMN | Organograma | Diagrama complexo`.
    
- Permitir selecionar qualquer conjunto de dados e aplicar qualquer estrutura visual compatível.
    
- Preservar IDs, entidades, relacionamentos e edições ao alternar.
    
- Quando uma estrutura não comportar determinados dados, apresentar aviso e uma representação alternativa.
    
- Aplicar componentes BPMN sempre que houver significado processual, sem alterar indevidamente sua semântica.
    

## D. Critérios de aceitação

- **GIVEN** um modelo carregado, **WHEN** a visualização mudar, **THEN** os dados e relacionamentos MUST permanecer consistentes.
    
- Cada componente MUST apresentar metanotas contextuais.
    
- Sidebars MUST ser recolhíveis e redimensionáveis.
    
- O protótipo MUST funcionar com dados locais, sem depender do backend.
    
- Entregar cinco visualizações funcionais, biblioteca reutilizável e contratos de dados documentados.