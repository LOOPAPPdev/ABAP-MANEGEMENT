# 01 — Project Charter v0.1

- Activity: **ACT-01** · Phase 01 Project Charter · Area Product
- Status: **DRAFT — awaiting owner approval**
- Acceptance (workbook): problem, audience, objectives and out-of-scope filled and approved.

> Items marked **[ASSUMPTION]** were inferred from the workbook and the owner's brief. The owner MUST confirm or change them.

## Problem

Small software teams and solo builders plan projects in spreadsheets. The spreadsheet shows a status, but it cannot prove the work is finished, and it does not stop a dependent phase from starting early. The governance workbook solves this with formulas, but formulas cannot record history, validate evidence or support several people safely.

## Users

| User | Need | Priority |
| --- | --- | --- |
| Project owner (solo builder, beginner programmer) **[ASSUMPTION: primary user]** | See what to do next and prove each phase is done | Primary |
| Reviewer / approver | Check evidence before approving a gate | Secondary |
| AI coding agent (Claude Code) | Read the activity, acceptance and dependency; attach evidence | Secondary |

## Objectives (measurable)

| ID | Objective | Measure | Target |
| --- | --- | --- | --- |
| OBJ-1 | Preserve the workbook model | ACT-01..14, 8 statuses, dependencies and acceptance criteria imported without loss | 100 % field parity with the workbook (automated test) |
| OBJ-2 | Evidence-based progress | Share of activities counted as done that have evidence | 100 % (enforced by rule; automated test) |
| OBJ-3 | Faster status updates than the spreadsheet | Time to change a status and attach evidence | ≤ 60 s for one activity **[ASSUMPTION: target to validate in ACT-02]** |

## In scope (MVP)

- One project, seeded from the workbook.
- Activity list, detail, status change, evidence, audit history, server-side dashboard and gates.
- Local development; deploy to Cloudflare after approval (ACT-12).

## Out of scope (MVP)

- Multi-tenant SaaS, billing, teams and roles (pending D-006/D-007).
- Two-way sync with Excel or Google Sheets (legacy Apps Script stays in `reference/`).
- Generic template engine for other workbooks (see `reference/xls-pwa/ADR-001_metadata-driven-template-engine.md`; future ADR).
- File upload storage for evidence (evidence stores references only).
- Mobile native apps.

## Constraints

- Cloudflare-native stack (ADR-001, proposed). No paid external database.
- No fabricated interviews, approvals or test results.

## Approval

| Role | Name | Date | Decision |
| --- | --- | --- | --- |
| Owner | _pending_ | _pending_ | _pending_ |
