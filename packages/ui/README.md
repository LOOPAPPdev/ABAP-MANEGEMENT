# @abap/ui

One UI contract for the ABAP platform and the Loop Consultoria landing.

```mermaid
flowchart LR
  accTitle: How @abap/ui connects the two workspaces
  accDescr: The contract lists the token names. The ABAP theme copies the ABAP app tokens and a test keeps them equal. The LOOP theme maps the LOOP palette. The landing Worker imports the LOOP theme and the component recipes at build time.
  C["theme/contract.json<br/>token names (shadcn HSL)"] --> A["theme/abap.css"]
  C --> L["theme/loop.css"]
  APP["apps/abap/app/app.css<br/>components/ui/*.tsx"] -. "test: same values,<br/>same variants" .-> A
  APP -. recipes .-> R["components/*.css"]
  L --> W["sites/loop-consultoria/worker.js<br/>import at build → /ui.css"]
  R --> W
```

## B · Theme: one structure, two themes

| File | Values | Rule |
|---|---|---|
| `theme/contract.json` | Names only: 19 colours + `radius` (shadcn/ui HSL channels, used as `hsl(var(--name))`) | Every theme MUST define every name |
| `theme/abap.css` | ABAP neutral bundle (ADR-007) | MUST equal `apps/abap/app/app.css` (test) |
| `theme/loop.css` | LOOP-CONSULTORIA palette (Screens v2), light and dark | Extensions use the `--loop-*` prefix. Text pairs ≥ 4.5:1 (test) |

## C · Components: only what both use

| Component | ABAP source | Landing use |
|---|---|---|
| Button (6 variants, 4 sizes) | `button.tsx` | Nav, hero, CTAs, form, pause |
| Card, CardTitle | `card.tsx` | Problem, capabilities, services, steps, trust, simulator, form |
| Badge | `badge.tsx` | Labels, statuses, connectors |
| Input, Textarea, Label | `input.tsx` | Form, simulator labels |
| Separator | `separator.tsx` | Simulator, footer |

Not shared (used by one side only): ABAP `resizable`, `tabs`, `toggle`, `toggle-group`, `tooltip`; landing accordion, checkbox and slider (local CSS in `sites/loop-consultoria/index.html`, same tokens). Promote one here when the other side needs it.

The recipes are CSS so that a static page can use them without React. The ABAP app keeps its React components (Tailwind); a test checks that every ABAP button variant and size exists in `button.css`.

## D · Verification

```bash
npm run test:tools
```

`test/ui.test.mjs` checks: contract coverage in both themes (and LOOP dark), ABAP theme equal to the app, WCAG AA text pairs, ABAP button variant parity, shared set equal to the ABAP components, landing imports every package file and uses only defined `ui-*` classes. The landing build (`wrangler deploy`) fails if an import is missing.
