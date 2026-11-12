# Pattern — Adaptive Card-Based Questionnaire

- Status: **PLANNED** (registry `pattern-adaptive-questionnaire`) · Source: `reference/loop-design/Adaptive Card-Based Questionnaire.md`
- Implemented now: `ChoiceCard` + `CardSelectionGroup` (`src/components/patterns/choice-card.tsx`, see `/showcase`).
- Planned use: capture of the five ACT-02 discovery interviews (no interview data is created by the system).

## Definition

A form pattern that uses selection cards, semantic grouping and conditional logic to reduce cognitive load, guide decisions and show only the information needed at each step.

## Taxonomy

| Pattern | Function |
| --- | --- |
| Card-Based Form | Questions and options in visual cards |
| Choice Cards / Selection Tiles | Selectable surfaces instead of plain radios |
| Progressive Disclosure | Reveal fields only when needed |
| Chunking | Split a long form into groups |
| Recognition over Recall | Recognise options instead of recalling them |
| Conditional Branching | Next questions depend on answers |
| Guided Onboarding | Step-by-step setup |

## Naming

| Layer | Name |
| --- | --- |
| Component | `ChoiceCard` |
| Selection group | `CardSelectionGroup` |
| Organism | `QuestionSection` (planned) |
| Form | `CardBasedQuestionnaire` (planned) |
| Strategy | `ProgressiveDisclosure` |
| Adaptive behaviour | `ConditionalBranching` |
| Full flow | `AdaptiveOnboardingFlow` |

## Rules (implemented in ChoiceCard)

- Single selection = native radio group; multiple = native checkbox group (keyboard behaviour for free).
- States: default, hover, focus, selected, disabled, error.
- Selected shown by ✓ mark + thicker border, not colour alone.
- Card is the `<label>`; `<fieldset>` + `<legend>` per question.

## Acceptance (for the planned form)

- GIVEN answer A, WHEN the user continues, THEN only questions relevant to A appear.
- GIVEN a review step, WHEN the user opens it, THEN every answer is shown and editable.
