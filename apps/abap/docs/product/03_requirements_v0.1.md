# 03 — Requirements v0.1

- Activity: **ACT-03** · depends on ACT-02
- Status: **DRAFT — awaiting owner approval.** Written before discovery (ACT-02) from the workbook rules; revise after interviews.
- Acceptance (workbook): each requirement has a unique ID and at least one verifiable acceptance criterion.
- Keywords MUST / SHOULD / MAY follow RFC 2119. Wording follows EARS.
- Column **Test** names the automated test that verifies the criterion today (`—` = not yet automated).

## Functional requirements

| ID | Requirement (EARS) | Acceptance criterion (GIVEN–WHEN–THEN) | ACT | Test |
| --- | --- | --- | --- | --- |
| FR-01 | The system MUST import ACT-01..ACT-14 from the workbook into a versioned fixture without changing the workbook. | GIVEN the workbook WHEN `npm run import:workbook` runs THEN the fixture has 14 activities that match the workbook field by field. | 07 | `tests/unit/fixture.test.ts` |
| FR-02 | The system MUST reject a fixture with duplicate IDs, unknown dependencies, cycles or unknown statuses. | GIVEN a fixture with a cycle WHEN validated THEN validation fails. | 07 | `fixture.test.ts` (cycle) |
| FR-03 | The system MUST list all activities with status, evidence count and flag. | GIVEN the seeded project WHEN GET `/api/v1/activities` THEN 14 activities are returned. | 07 | `tests/integration/api.test.ts` |
| FR-04 | The system MUST show activity detail: objective, tutorial, deliverable, acceptance, dependency, dependents, evidence and history. | GIVEN ACT-01 WHEN the detail page opens THEN the acceptance criterion is visible. | 07 | `tests/e2e/first-feature.spec.ts` |
| FR-05 | WHEN a user changes status, the system MUST accept only the 8 workbook statuses. | GIVEN status `FINISHED` WHEN PATCH status THEN HTTP 400 and no audit event. | 07 | `api.test.ts` |
| FR-06 | WHEN a status change creates a flag condition, the system MUST save the change and return the warnings. | GIVEN ACT-01 without evidence WHEN set to DONE THEN the response warns `NO EVIDENCE`. | 07 | `api.test.ts`, E2E |
| FR-07 | The system MUST store evidence of kind link, commit, file or text and MUST validate its format. | GIVEN kind `commit` and ref `not-a-sha` WHEN submitted THEN it is rejected with a message. | 07 | `api.test.ts`, E2E |
| FR-08 | The system MUST count an activity as done only IF status = DONE AND evidence exists. | GIVEN DONE without evidence THEN progress stays 0 %; WHEN evidence is added THEN progress is 1/14. | 07 | `rules.test.ts`, `api.test.ts`, E2E |
| FR-09 | The system MUST compute flags with precedence BLOCKED > NO EVIDENCE > DEP PENDING > OVERDUE. | GIVEN BLOCKED with a past due date THEN flag is BLOCKED. | 07 | `rules.test.ts` |
| FR-10 | IF a predecessor is not effectively done AND the dependent is not NOT STARTED, THEN the system MUST flag DEP PENDING. | GIVEN ACT-02 not done WHEN ACT-03 is set IN PROGRESS THEN flag DEP PENDING. | 07 | `rules.test.ts`, `api.test.ts` |
| FR-11 | The system MUST compute the dashboard on the server: overall progress, per-area progress, in progress, blocked, gates, next gate. | GIVEN 1 of 4 done THEN overall ratio = 0.25 and next gate = first open phase. | 07 | `rules.test.ts` |
| FR-12 | The system MUST record an audit event for every status change and evidence record, with actor, time, from and to. | GIVEN a status change by `tester` THEN history shows `tester NOT STARTED → DONE`. | 07 | `api.test.ts` |
| FR-13 | The system MUST expose a health endpoint that checks database connectivity. | WHEN GET `/api/v1/health` THEN `{ ok: true, db: "up" }`. | 07 | `api.test.ts` |
| FR-14 | The system SHOULD filter activities by area and by flag. | GIVEN `?area=Design` THEN only Design activities appear. | 07 | — |
| FR-15 | The system SHOULD support more than one project. | Pending decision D-007. | — | — |
| FR-16 | The system MUST authenticate users and authorize mutations before public deployment. | Pending decision D-006. | 10 | — |

## Non-functional requirements

| ID | Requirement | Acceptance criterion | Test |
| --- | --- | --- | --- |
| NFR-01 | Domain rules MUST NOT depend on UI, HTTP or persistence frameworks. | ESLint `no-restricted-imports` fails on a forbidden import in `src/domain`. | `npm run lint` |
| NFR-02 | All external input MUST be validated with Zod. | Invalid body or ID returns HTTP 400. | `api.test.ts` |
| NFR-03 | Multi-record mutations MUST be atomic. | Mutation and audit event written in one D1 `batch()`. | code review |
| NFR-04 | The UI SHOULD meet WCAG 2.2 AA: labels, keyboard access, focus visible, contrast. | Checklist in `docs/design/04_user-flows_v0.1.md` reviewed. | — (manual) |
| NFR-05 | CI MUST run lint, typecheck, unit/integration tests, build and E2E on every push. | `.github/workflows/ci.yml` green. | CI |
| NFR-06 | No secrets MUST be committed. | `.dev.vars` git-ignored; review before commit. | review |
| NFR-07 | Local development MUST NOT require remote Cloudflare resources. | `npm run dev` works with the local D1 only. | manual |

## Data requirements (input to ACT-06)

DR-01 activity attributes from the workbook (columns A–R). DR-02 evidence records (kind, reference, note, author, time). DR-03 audit events. DR-04 project. DR-05 the 8 statuses, 4 priorities, 6 areas, 14 phases.
