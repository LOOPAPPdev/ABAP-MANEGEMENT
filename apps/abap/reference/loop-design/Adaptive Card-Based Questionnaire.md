O padrão apresentado nas imagens é um Card-Based Form, combinado com Guided Onboarding, Choice Cards e, quando existe revelação condicional de campos, Progressive Disclosure.

O nome mais adequado para documentar essa abordagem em um Design System é:

Adaptive Card-Based Questionnaire (Questionário adaptativo baseado em cartões).

1. Taxonomia UX/UI

|   |   |
|---|---|
|Padrão|Função|
|Card-Based Form|Organiza perguntas e opções em cartões visuais.|
|Choice Cards / Selection Tiles|Substitui opções tradicionais por superfícies selecionáveis.|
|Progressive Disclosure|Revela informações ou campos adicionais apenas quando necessários.|
|Chunking|Divide um formulário complexo em grupos de informação.|
|Recognition over Recall|Permite reconhecer opções em vez de precisar recordá-las.|
|Conditional Logic / Branching|Adapta perguntas conforme respostas anteriores.|
|Guided Onboarding|Orienta o usuário durante a configuração inicial.|

2. Arquitetura recomendada

ETAPA A · IDENTIFICAÇÃO

Como você trabalha com a marca?

Agência

Marca própria

Equipe interna

Resposta determina os próximos campos

Etapa B · Contexto específico

Condicional

Qual serviço você oferece?

Esta pergunta aparece somente quando relevante.

Etapa C · Revisão e conclusão

Resumo das respostas antes da confirmação.

3. Análise das imagens

O formulário combina quatro tipos de entrada: seleção por cartões, slider, seleção por chips e campos de texto.

Entretanto, o Progressive Disclosure não está comprovado nas capturas. As nove perguntas parecem estar disponíveis numa única página com rolagem. Isso caracteriza principalmente Single-Page Sectioned Form com Card-Based Selection.

Para implementar Progressive Disclosure, o sistema precisa revelar conteúdo gradualmente ou condicionar perguntas às respostas anteriores.

4. Boas práticas de UX

- Seleção única: cartões com comportamento de radio group.
- Seleção múltipla: cartões com comportamento de checkbox.
- Revelação condicional: exibir apenas campos necessários, mantendo a possibilidade de revisar respostas.
- Feedback visual: estados default, hover, focus, selected, disabled e error.
- Acessibilidade: navegação por teclado, rótulos semânticos e estado selecionado perceptível sem depender só da cor.
- Mobile-first: cartões responsivos, áreas de toque adequadas e baixo esforço de preenchimento.

5. Nomenclatura para PRD / Design System

Minha recomendação é separar o padrão visual da estratégia de interação:

|   |   |
|---|---|
|Camada|Nome técnico|
|Componente|ChoiceCard|
|Grupo de seleção|CardSelectionGroup|
|Organismo|QuestionSection|
|Formulário|CardBasedQuestionnaire|
|Estratégia|ProgressiveDisclosure|
|Comportamento adaptativo|ConditionalBranching|
|Fluxo completo|AdaptiveOnboardingFlow|

Definição para o PRD:

Adaptive Card-Based Questionnaire é um padrão de formulário que utiliza cartões de seleção, agrupamento semântico e lógica condicional para reduzir a carga cognitiva, orientar decisões e apresentar apenas as informações necessárias em cada etapa.

Essa nomenclatura permite reutilizar o mesmo sistema em onboarding, configuração de marca, criação de agentes, formulários de diagnóstico e assistentes de configuração.