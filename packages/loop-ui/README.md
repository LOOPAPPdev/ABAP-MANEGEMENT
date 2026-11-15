# @loop/ui — Screens v2, exclusive to LOOP

The Loop landing (`sites/loop-consultoria`) is built **only** from this package. It reproduces the Screens v2 page from design artifact `a74ae02c` (`Main.dc.html` + `ds/rc/`), not an adaptation of the ABAP components.

```mermaid
flowchart LR
  accTitle: How the exclusive package is built and used
  accDescr: The two design files are kept as received. A script extracts the tokens. The page patterns and the behaviour script copy Main.dc.html. The landing worker serves them.
  B["source/_ds_bundle.css<br/>as received"] --> X["tools/extract-tokens.mjs"]
  T["source/loop-theme.css<br/>as received"] --> X
  X --> K["tokens.css<br/>generated"]
  M["Main.dc.html<br/>(design)"] -. copied into .-> S["screens.css<br/>sv-* classes"]
  M -. ported to .-> J["screens.client.js<br/>feed, reveal, tilt, spy, tabs"]
  K --> W["sites/loop-consultoria/worker.js<br/>/loop-ui.css · /loop-ui.js"]
  S --> W
  J --> W
```

| File | What | Rule |
|---|---|---|
| `source/_ds_bundle.css`, `source/loop-theme.css` | Design files as received | Never edit. The test checks the SHA-256 hashes. Replace both together when the design changes |
| `tokens.css` | Every `:root` / `[data-theme]` token of the bundle (with its `@media`), then `loop-theme.css` verbatim | Generated: `npm run tokens -w @loop/ui`. The test fails if it is stale |
| `screens.css` | The Main.dc.html elements as classes: header + tabs, hero feed panel, display title, meta row, tiles, rows, stories, chips, article layout with TOC, segmented control, panel + bubble, 3D stage + parts, rail, FAQ, form, footer | Values copied from the inline styles of the design. Prefix `sv-` |
| `screens.client.js` | Behaviour of the design component: endless feed + pause, reveal (24 px, 90 ms stagger), tilt, scroll spy, tabs with fade, theme from the OS | No dependencies. Served as `/loop-ui.js` |

## Why a separate package
`@abap/ui` shares one token contract between ABAP and LOOP. Mapping Screens v2 onto that contract changed the look too much (owner, 2026-11-15: "you are adapting where you should follow this page"). This package follows the design one to one and has no ABAP consumer. Decision D-040.

## Verify
```bash
npm run test:tools
```
```bash
node sites/loop-consultoria/validate.cjs https://loop-consultoria.adm-loop-app.workers.dev
```
