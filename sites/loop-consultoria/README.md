# Loop Consultoria — landing page

One conversion page for the consultancy. Live: `https://loop-consultoria.adm-loop-app.workers.dev`.
Cloudflare Workers Builds deploys it from `main` when a file in this folder changes.

```mermaid
flowchart LR
  accTitle: How the page is built and published
  accDescr: Strategy documents, the Screens v2 mockup and two benchmarks feed one HTML page. A Worker serves it and stores contact requests in D1. A check script validates the acceptance criteria.
  S["Strategy docs<br/>one-pager, método LOOP"] --> P["index.html"]
  M["Screens v2<br/>tokens and layout"] --> P
  B["Benchmarks<br/>machinations.io · OpenAI Team template"] --> P
  P --> W["worker.js"] --> D[("D1 loop-site-leads")]
  P --> V["validate.cjs<br/>24 checks"]
```

## A · Traceability (code → branch → build → URL)

| Item | Value |
|---|---|
| Code | `sites/loop-consultoria/` (`index.html`, `worker.js`, `wrangler.jsonc`) + `packages/ui/` |
| Branch | `main` (single-branch policy, `docs/branch-policy.md`) |
| Build | Cloudflare Workers Builds, Worker `loop-consultoria` (account adm-loop-app), root `/sites/loop-consultoria`, deploy `npx wrangler deploy`, runs when `sites/loop-consultoria/*` or `packages/ui/*` changes |
| URL | `https://loop-consultoria.adm-loop-app.workers.dev` · stylesheet `/ui.css` is built from `@abap/ui` |
| Data | D1 `loop-site-leads` |

## Design system

The page uses `@abap/ui` (theme `loop` + shared primitives): see [`packages/ui/README.md`](../../packages/ui/README.md). Since 2026-11-15 (second pass) the LOOP theme is the **Screens v2 design system**: the rc bundle scale (`_ds_bundle.css`) and the `loop-theme.css` palette, copied from the design artifact `a74ae02c` (`ds/rc/`). Content unchanged.

| Element | Screens v2 rule applied |
|---|---|
| Type | Inter; body 17px / 1.47 / -0.022em; lead 21px / 1.38; h1 700, clamp 36–72px, -0.04em; h2 500, clamp 30–50px, -0.03em; card titles 20px |
| Grounds | White page; cards are flat slate-100 tiles (no border, no shadow); feature stages use the blue, purple and green tints; white sheets sit on tints |
| Controls | Pill buttons (primary filled slate-900, outline 1px text colour); pill nav menu on slate-100; chips at 9% text mix |
| Header | 72px, 85% ground + blur 18px, no border |
| Radius, space, motion | Card 16px, controls pill, fields 12px; 4/8/12/16/24/32/48/64 spacing; `cubic-bezier(.25,.1,.25,1)` |
| Shared recipes | Unchanged classes (`ui-button`, `ui-card`, `ui-badge`, `ui-input`…); the theme sets `--ui-*` hooks, ABAP keeps its defaults |

Content check: `node content-baseline.mjs` extracts the visible copy; the redesign removed no sentence (only decorative card numbers were added, `aria-hidden`).

## Sources and what each one decided

| Source | Used for | Status |
|---|---|---|
| `Screens v2` mockup | Tokens (Loop palette, Inter, radius 16/24), sticky blurred nav with pill menu, hero panel with an animated model beside a large headline, pill buttons | Read and rendered |
| One-pager ABAP, Método LOOP, Especificação LOOP, benchmark | Positioning, six services, six method steps, entry path, security rules, FAQ objections | Read |
| `Site-architecture.md` | Copy limits, layout limits, tone rotation, CTA rule (starts with a verb), "Team" template order | Read |
| machinations.io | Concept: an interactive model in the hero, "make the invisible visible", "explore before it happens", "bring your tools", closing line "model the system, then change the outcome" | Read on 2026-11-15 |
| openai.com/business/solutions/operations | Quality bar. The page returns HTTP 403 to automated reading and nobody bypassed it. Its section order comes from `Site-architecture.md` (Team template) and search snippets | Partial |

Only the information architecture and the concept are reused. Copy, visuals and code are original.

## Section order (Team template × Machinations concept)

| # | Section | Job in the conversion path |
|---|---|---|
| 1 | Hero: headline, one-line value, primary CTA, interactive model | Understand the offer in 5 seconds; try the idea |
| 2 | Problem: four costs of manual work | Recognition |
| 3 | Three capabilities | What we do, in order |
| 4–5 | Two feature rows (visible · simulate) | How it works, with product mock-ups |
| 6 | Method: six steps with a deliverable each | Reduce perceived risk |
| 7 | Six services | Scope |
| 8 | Platform: shared project studio | Differentiator |
| 9 | Connectors | "It works with what I have" |
| 10 | Trust: four rules | Objection: safety |
| 11 | Entry path: five stages | Objection: size of commitment |
| 12 | FAQ: seven questions | Remaining objections |
| 13 | CTA band + form | Convert |

## Acceptance criteria

| ID | Criterion | Check |
|---|---|---|
| LP-01 | One `h1`. Headline and primary CTA are above the fold at 1440×900 and 390×844 | `validate.cjs` |
| LP-02 | One primary action ("Agendar diagnóstico") in the nav, the hero and the form | `validate.cjs` |
| LP-03 | Copy respects the limits of `Site-architecture.md` (hero title 48, subtitle 110, section title 32, card title 28, card description 64, CTA 22) | `validate.cjs` (`data-slot`) |
| LP-04 | CTA labels start with a verb | `validate.cjs` |
| LP-05 | No horizontal scroll at 320, 390 and 1440 px | `validate.cjs` |
| LP-06 | Keyboard: skip link first, visible focus, targets ≥ 36 px; reduced motion stops the animation | `validate.cjs` + CSS |
| LP-07 | The form validates on the client and on the server, needs consent (LGPD), has a honeypot and a flood limit | `validate.cjs --submit`, `worker.js` |
| LP-08 | No invented proof: no client names, logos, testimonials or result numbers. The model is labelled "Exemplo ilustrativo" | Review |
| LP-09 | HTML under 60 KB, no framework, no tracking script | `validate.cjs` |
| LP-10 | Colour is never the only cue: each tinted card repeats its label as text | Review |

```bash
node sites/loop-consultoria/validate.cjs https://loop-consultoria.adm-loop-app.workers.dev
```

## Contact requests

Stored in D1 `loop-site-leads`, table `leads` (name, company, e-mail, message, consent time). Read them in the Cloudflare dashboard (D1 → loop-site-leads → Console): `SELECT * FROM leads ORDER BY id DESC;`. They are personal data: delete on request.

## Open items

- No customer proof yet. Add a case only with the client's written consent.
- No contact channel besides the form. Add WhatsApp or e-mail when the owner chooses one.
- No analytics. Conversion is measured by rows in `leads`.
- Custom domain not set.
