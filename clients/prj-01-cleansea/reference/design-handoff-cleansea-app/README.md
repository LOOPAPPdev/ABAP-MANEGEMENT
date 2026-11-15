# Handoff: Cleansea — App operacional (mobile)

## Overview
Operational app for Cleansea (sludge / garbage collection from ships at Santos port). Covers the full journey of one operation: login by role → open operation (PRE) → monitoring (ETA, weather) → mobilization → execution (DURANTE/POS measurements, documents D1–D4) → certificate submission (S16) → close (S17). Built from the BPMN (17 steps, 5 phases, gateway G-01), the 5 user profiles, and the data model in the spreadsheet "Controle Operacional de Navios". UI copy is pt-BR.

## About the Design Files
`Cleansea App.dc.html` is a **design reference built in HTML**: a navigable prototype showing intended look, flows and behavior. It is not production code. Recreate it in the target codebase (React Native, Flutter, SwiftUI, or a PWA in React) using that environment's patterns. If no codebase exists yet, a React Native or Expo app with an offline-first store (WatermelonDB/SQLite + sync queue) fits the requirements best.

All data is seeded locally. **No API is called.** Every response that would come from an integration (AIS position, ETA, weather, chat, Ask AI, SIGOR-MTR submission) is simulated and carries a "SIMULADO" tag. In production, the tags go away once each integration is real.

Open the file in a browser: the left column is the phone (390×844), the right column has a role switcher ("Ver como"), simulation switches and a 12-step demo script. Below are the wireflow, the state machine and the permission matrix.

## Fidelity
**High-fidelity** for layout, hierarchy, copy, states and interactions. Colors and type come from the bound design system tokens (Apple-like neutral palette + blue accent). If the client's brand differs (the code handoff ADR proposed navy), swap the tokens and keep everything else. Tweak `fidelity = wireframe` renders the same screens in grayscale for lo-fi review.

## Roles (personas)
| key | Name | Role | Home |
|---|---|---|---|
| felipe | Felipe | Gestor | Painel (pending docs) |
| cecilia | Cecília | Gerente comercial | Painel → Nova operação |
| marcos | Marcos | Gerente operacional | Painel (field ops) |
| joao | João | Visitador de bordo | Painel (today's queue) |
| paulo | Paulo | Motorista | Mobilização (convocations only) |

## Permission matrix (E = edit, L = read, — = "Acesso negado")
Columns: Felipe · Cecília · Marcos · João · Paulo
- M01 Painel: E L L L —
- M03 Nova operação (PRE): E E L — —
- M05 DURANTE: L L E E — (in prototype only João writes DURANTE)
- M05 POS: L L E — —
- M06 ETA manual: E L E E —
- M07 Anexar documento: E — E E —
- M07 Validar documento: E — E — —
- M10 Convocar motoristas: E — L — —
- M10 Confirmar disponibilidade: L — — — E
- M12 Fechar operação: E — L — —
- M09 Ask AI: E E — — —
- M08 Chat: E E E E E
Step completion: Felipe can complete any step; others only steps they own (see BPMN table). Proposal, pending client confirmation.

## App shell (all screens except login)
- Phone frame 390×844, radius 28px, 1px divider border.
- **Header** 56px, bg `--color-accent-600` (#0071E3), white text. Left: 48×48 back (stack depth > 1) or hamburger (root). Title 18/700 heading font, subtitle 12px, both ellipsized. Right: 48×48 bell with white badge (unread count, 18px min, 11px/700, accent-700 text).
- **Offline banner** (when no signal): 44px min, bg `--color-text`, text `--color-bg`, 13px: "Sem sinal. Você pode continuar; enviaremos depois." + "Fila (n)" → M13.
- **Content**: scroll area, 16px padding, 12px vertical gap.
- **Bottom bar** 68px, grid `1fr auto 1fr`, top divider: "Ask AI" (sparkle icon) · central 52×52 "+" button (radius 16, accent-600, shadow `0 4px 14px rgba(0,113,227,.35)`, active scale .96) · "Chat". Active item color accent-700.
- **Drawer** 296px from left, transform 240ms `cubic-bezier(.2,0,0,1)`, shadow `0 0 40px rgba(0,0,0,.25)`. Header with name/role + close. Items (48px, radius 8, active bg accent-100 / text accent-700 / 600): Painel, Operações, Navios, Clientes, Documentos, Histórico, Fila de envio, Configurações. "Sair" at bottom.
- **Scrim** `--color-scrim`, opacity fade 200ms; click closes drawer/sheets. Esc closes too.
- **Quick actions sheet** ("+"): bottom sheet radius 16 top, items 52px: Nova operação, Registrar medição, Anexar documento, Nova mensagem.
- **Confirm sheet**: title 17/700, 1–3 lines 14px, primary 52px button, secondary 48px outline.
- **Toast**: absolute, 16px sides, 80px from bottom, bg `--color-text`, text `--color-bg`, 14px, radius 10, auto-dismiss 3.2s, `aria-live=polite`.

### Shared patterns
- Card: bg `--color-bg`, 1px `--color-divider`, radius 12, padding 14.
- Section label: 11px/600 mono, letter-spacing .08em, uppercase, muted.
- Primary button: min-height 48 (52 for terminal actions), radius 10, accent-600, white 15/600. Secondary: 1px divider outline.
- Status chip: 3×8 padding, radius 8, 12/600, 7px dot. Tones: ok = success (#248A3D), warn = warning (#B25000), bad = danger (#D70015), info = accent-600, mute = text-muted. Chip bg = tone 16% mixed into `--color-bg`.
- Alert row: warning 14% bg, warning 45% border, radius 10, "!" + text + optional 44px action.
- SIMULADO tag: 10px/600 mono, 3×6 padding, radius 4, bg `oklch(0.94 0.04 300)`, text `oklch(0.4 0.14 300)`.
- Segmented / tabs: 48px, radius 8–10, selected = accent-100 bg, accent-600 border, accent-700 text.
- All touch targets ≥ 44px (most 48px). Inputs 48px, 16px font (no iOS zoom), radius 8.

## Screens
**M00 Login.** Accent header block (56px top padding): 44px white "C" tile, "CLEANSEA" 26/700 letter-spacing .04em, "Operational workspace". Body: "Entrar", demo note, 5 role cards (60px, 40px avatar initial on accent-100, name 15/600, "role · home" 13 muted, chevron). Tap → home for that role.

**M01 Painel.** (1) Role card: title/text/CTA per role (Felipe → docs pending; Cecília → Nova operação; Marcos → open operation; João → register measurement). (2) "Resumo da empresa / Coletas" month segmented: jun, jul, ago, set, out, nov. (3) Insights card: header (month name 28/700 uppercase + "insights" mono label) and toggle "Histórico/Ver mês"; solid band 104px gradient #EEF2F6→#D8E0E8 with TAIFA/GARBAGE value; liquid band 120px gradient #72D6FF→#1668B8 with animated two-layer wave (SVG, 7s/11s translate loops, disabled with reduced motion) and OIL value 34/700; footer source line. Data: jun 26 oil / 10 TAIFA (POS); jul 55/17 (POS); nov 133 sludge / 37 garbage (PRE forecast, 7 ops); ago–out "—"; Histórico 81/27 (jun–jul, 6 ops). Unit "unid. a confirmar" for garbage. Card has role=img + aria-label. (4) "Histórico de coletas · POS" table (name, óleo, TAIFA), rows → M11 when vessel known. (5) Operation tabs + operation summary card (name, status chip, IMO · agency · terminal · ETB · ETC, 6px progress bar, "x% · n de 17 etapas", "Abrir operação").

**M15 Operações.** Filter Todas/Ativas/Fechadas; operation cards; empty state copy.

**M02 Operação.** Header card (name 18/700, status chip: Em andamento / Em risco / Fechada; SIMULADO tag for simulated op). Alerts (ETC divergence 12/11 vs 14/11 → M05; weather delay → M06; simultaneous ops conflict, alert only; rescheduled). Progress card: 8px bar, 5 phase circles (28px; done = accent fill ✓, current = accent-100 + number, future = outline) → M04; "Próxima · owner / Sxx name" + "Concluir" (or "Ir ao fechamento" after S15). Measurement triad card → M05. List rows: Navio · ETA (→ M06), Clima (→ M06), Documentos D1–D4 "n de 4 anexados" (→ M07). Buttons: Mobilizar, Chat, Fechar operação (outline, full width).

**M04 Fluxo.** Accordion per phase (26px marker, name, done/total). Steps: code (mono), name, owner, "A definir" tag for S03/S05/S08/S12, chip concluída/em curso/pendente. Phase 2 shows gateway box (dashed): "G-01 · Chegada confirmada? Sim: libera S11. Não: retorna a S07 (retorno inferido, a validar com o cliente)."

**M05 Medições.** 3 cells PRE / DURANTE / POS (value m³, author, timestamp). Effective value highlighted with accent border + "VALE" pill. Rule: POS > DURANTE > PRE. Divergence alert when |effective − PRE| > 2 m³ (illustrative margin, real margin TBD). Comparison table for ANADOLU S (Aquecido, Vazão, ETC). Form: one input for the role's own measurement (Cecília/Felipe PRE, João DURANTE, Marcos POS); others read-only text. Validation: number > 0, comma or dot; error keeps typed value, red border, `aria-live`.

**M06 Navio.** "Atualizar" (900ms loading → updates timestamp; offline → toast with last update). AIS position card + ESTIMATIVA tag, ETA 22/700. Weather 4-cell grid (vento, rajada, chuva, onda) from Open-Meteo example; delay mode shows 28 kn / 41 kn / 80% / 2,6 m and a "Reprogramar" alert (confirm sheet → op marked rescheduled, drivers set to "a reconfirmar"). "Fontes sem API": Praticagem SP, Semafórico, APS, Ventusky → leaving-app notice. Manual ETA input (dd/mm hh:mm) for Felipe/Marcos/João, stored with author + time.

**M07 Documentos.** D1 CETESB MTR (Impresso), D2 Terrestre Ambiental Manifesto de Carga, D3 Premium Ambiental Certificado MARPOL, D4 Premium Ambiental Certificado de coleta (manuscritos). Each: 40×48 thumbnail (dashed when missing), name, method · author, chip faltando/anexado/validado/reprovado. Attach (Câmera/Arquivo) for Felipe/Marcos/João; Validar/Reprovar for Felipe/Marcos when anexado. Reprovar notifies the author ("foto ilegível").

**M10 Mobilização.** Manager view: drivers Paulo, Hélio as checkboxes with status chip (não convocado / aguardando / confirmou hh:mm / recusou / a reconfirmar); Marcos displacement (S12) with "Informar" for Marcos. "Enviar convocação" (Felipe only). Driver view (Paulo): big card with "Confirmo" / "Não posso" (56px, 17/700) or empty state.

**M03 Nova operação (PRE).** Vessel search by name/IMO (≥3 chars) → matches with "recorrente (n x)" tag, autofills agency and terminal; "Ver histórico" → M11; warnings (PERSEAS: TGG doesn't allow sludge; LMZ ATLAS IMO also appears as LEMESSOS NAPA). Fields: Agência, Terminal/berço, ETB, ETC, Sludge (m³), Garbage, Vazão da bomba (m³/h); toggles Produto aquecido, Haverá cobrança? Validation: vessel required, dd/mm dates, ETC ≥ ETB, sludge numeric. Submit creates operation at S05 (S01–S04 done), PRE measurement, first chat message, notifies team, navigates to M02.

**M11 Cliente recorrente / Navios.** Vessel header (IMO, tag, agency), note alert, history rows from the spreadsheet. Navios list: 7 vessels with IMO, agency, recurrence tag.

**M08 Chat.** Per-operation thread; bubbles (own = right, accent-100), author · role, timestamp; offline messages show "pendente de envio" until synced. Sticky composer, Enter sends.

**M09 Ask AI.** Read-only assistant, Felipe and Cecília only. 3 suggested questions; answers with "Fontes" chips that deep-link to M11 / Painel; 700ms "Respondendo…"; unknown → "Não encontrei registros que respondam a essa pergunta." Production: retrieval over operations DB, answers must cite records, no write actions.

**M12 Fechamento.** Checklist (S01–S15 done, POS registered, D1–D4 validated), each missing item has a jump button. Status message. "Submeter certificados (S16)" enabled only for Felipe with all checks → confirm sheet (D1 via SIGOR-MTR/CETESB with POS volume, D2, D3/D4) → protocol `SIM-xxxxxx`. Then "Encerrar operação (S17)" → confirm → closed, read-only.

**M13 Fila de envio.** Queued actions while offline (measurements, photos, step completion, ETA, messages, new ops) labeled "pendente de envio". On reconnect, queue replays in order and toast "Sinal voltou. Enviado n de n."

**M14 Notificações.** Time + text list; opening it clears the badge. Every write action prepends a notification.

**Acesso negado.** Lock icon, "Seu papel não tem acesso a esta ação. Fale com Felipe.", "Voltar ao início".

## Interactions & Behavior
- Navigation is a stack: `go()` pushes, back pops, drawer items reset to `[home, screen]`.
- Step completion order: S01…S17. At S10 the G-01 confirm sheet appears: "Sim" advances; "Não" resets to S07.
- Operation state derived from completed steps: <4 opened · 4–5 standby · 6–9 monitoring · 10–12 confirmed · 13 in_execution · 14–15 evidence_collection · 16 submitted · 17 closed. Side branches: monitoring ⇢ rescheduled ⇢ monitoring; opened/standby/monitoring ⇢ cancelled (not built).
- Transitions: drawer 240ms, sheets 200ms, scrim 200ms, progress bar width 250ms, switches 150ms. `prefers-reduced-motion` sets all to 0 and stops the wave.
- Offline-first: any write while offline is enqueued with a label and its effect; UI shows optimistic state with "pendente de envio".

## State Management
- `session`: role, navigation stack.
- `operations[]`: id, date, vessel (name, imo), agency, terminal, etb, etc, done (0–17), measurements {pre,dur,pos: {v, who, when}}, docs {D1..D4: faltando|anexado|validado|reprovado}, dispatch {sent, per-driver status, marcos}, eta {v, src, when}, messages[], resched, protocol.
- `vessels[]`, `history[]`, monthly aggregates (from spreadsheet).
- `queue[]` (offline sync), `notifications[]` + seen count, `flags` (offline, weatherDelay, conflict — demo only).
- Suggested endpoints: `POST /auth/session`, `GET/POST /operations`, `POST /operations/:id/steps/:code/complete`, `POST /operations/:id/measurements`, `POST /operations/:id/documents/:doc` (multipart) + `PATCH …/validate`, `POST /operations/:id/dispatch`, `POST /dispatch/:id/response`, `GET /vessels/:imo/position|eta` (AIS provider), `GET /weather?lat&lon` (Open-Meteo), `GET/POST /operations/:id/messages` (websocket), `POST /ai/ask` (read-only RAG), `POST /operations/:id/certificates` (SIGOR-MTR), `POST /operations/:id/close`, `GET /notifications`. All writes must be idempotent (client-generated ids) for queue replay.

## Design Tokens (light / dark)
- Accent: 100 #EFF7FF · 300 #94C8FF · 600 #0071E3 · 700 #0066CC
- bg #FFFFFF / #000000 · surface #F5F5F7 / #1D1D1F · text #1D1D1F / #F5F5F7 · text-muted #6E6E73 / #A1A1A6
- divider = text at 16% (dark 24%) · scrim #00000066 / #00000099 · link #0066CC / #2997FF
- success #248A3D / #30D158 · warning #B25000 / #FF9F0A · danger #D70015 / #FF453A
- Fonts: heading/body system stack (`-apple-system, "SF Pro Display/Text", "Inter", "Helvetica Neue"`), mono `ui-monospace, "SF Mono", Menlo`.
- Type scale used: 34 / 28 / 26 / 24 / 22 / 18 / 17 / 16 / 15 / 14 / 13 / 12 / 11 / 10.
- Radius: 4 (tags), 6, 8, 10 (buttons), 12 (cards), 16 (sheets, insights card), 28 (frame).
- Spacing: 4 / 6 / 8 / 10 / 12 / 14 / 16 / 20 / 24.
- Shadows: frame `0 1px 2px rgba(0,0,0,.06), 0 12px 40px rgba(0,0,0,.10)`; toast `0 6px 20px rgba(0,0,0,.25)`.

## Assets
No raster images. Icons are inline 24px line SVGs (stroke 1.5–1.6, round caps); replace with the codebase's icon set (Lucide/SF Symbols equivalents: menu, chevron-left, bell, sparkles, message-square, plus, grid, list-checks, ship, users, file, clock, upload, settings, lock). The wave is a generated SVG path.

## Open items (to confirm with client)
Divergence margin; formal arrival confirmation criteria (G-01) and the "Não" return path; garbage unit; driver response deadline; priority rule for simultaneous operations; whether DURANTE can also be entered by Marcos; S03/S05/S08/S12 details ("A definir").

## Files
- `Cleansea App.dc.html` — the full prototype (template + logic class; seed data and rules are constants at the top of the logic class: `STEPS`, `PH`, `DOCDEF`, `VESSELS`, `HISTORY`, `MONTHS`, `AIQ`, `CAN`, `PERMS`).
- `support.js` — runtime needed to open the HTML locally.
- `_ds/` — design-system stylesheet and bundle referenced by the HTML (tokens above).
