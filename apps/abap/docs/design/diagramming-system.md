# Diagramming System — square geometry, explicit semantics

- Status: **PROPOSED** · Source: `reference/loop-design/ABAP - UI DIAGRAMS.md`
- Principle: standardize the geometry, **preserve the semantics**.

## Rule 1 — Constant geometry

Every node is the same rectangle (184 × 80 px, 4 px radius). No ovals, diamonds or document shapes.

## Rule 2 — Semantics independent of geometry

| Classic shape (ISO 5807 / BPMN) | Type | Shown by |
| --- | --- | --- |
| Oval / circle (start) | `start` | Label **INÍCIO**, thin border |
| Oval / thick circle (end) | `end` | Label **FIM**, thick border |
| Rectangle | `process` | Label **ATIVIDADE**, square icon |
| Diamond / gateway | `decision` | Label **DECISÃO**, fork icon |
| Document | `document` | Label **DOCUMENTO**, file icon |
| — | `person` | Label **PESSOA**, user icon |
| Container / department | `group` | Label **GRUPO**, users icon |

Additional signals:

- **Solid border**: executable / validated. **Dashed border**: gap, not validated or future.
- **Left stripe**: status token from the bundle design system (governance only). Status is also written as text.
- **Selected**: 2.5 px brand border; related edges highlighted.

## Rule 3 — Standard connectors

| Kind | Line | Arrow | Meaning |
| --- | --- | --- | --- |
| `flow` | solid | yes | Sequence |
| `dependency` | solid | yes | Predecessor → dependent |
| `hierarchy` | solid, light | no | Parent – child |
| `association` | dashed | no | Relationship; dashed also marks `inferred` |

## Separation

- **Design System**: appearance (tokens, components).
- **Diagramming System**: node types, connector kinds, layout rules (`src/domain/diagram`). Same visual language for every diagram type.

## Applicability

| Diagram | Preserved | Implemented view |
| --- | --- | --- |
| Flowchart / process map | Sequence, decisions, direction | BPMN, Tutorial |
| Org chart | Hierarchy | Organograma |
| Influence / architecture / network | Nodes and dependencies | Diagrama complexo |
| Mind map | Relations | Diagrama complexo (partial) |
