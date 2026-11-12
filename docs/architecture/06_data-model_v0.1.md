# 06 — Data Model v0.1

- Activity: **ACT-06** · depends on ACT-05
- Status: **DRAFT — awaiting review.** Implemented in `src/server/db/schema.ts`, migration `migrations/0000_init.sql`.

## Entities

```mermaid
erDiagram
  PROJECTS ||--o{ ACTIVITIES : contains
  ACTIVITIES ||--o{ EVIDENCE : "proved by"
  ACTIVITIES ||--o{ ACTIVITY_EVENTS : "audited by"
  ACTIVITIES |o--o{ ACTIVITIES : "depends on"
  PROJECTS { text id PK
    text name
    text created_at }
  ACTIVITIES { text project_id PK
    text id PK "ACT-xx"
    text phase
    text area
    text title
    text dependency_id "nullable, same project"
    text acceptance
    text status "1 of 8"
    text priority
    text owner
    text due "ISO date, nullable"
    text updated_at
    text updated_by }
  EVIDENCE { text id PK "uuid"
    text project_id
    text activity_id
    text kind "link|commit|file|text"
    text ref
    text note
    text created_by
    text created_at }
  ACTIVITY_EVENTS { integer id PK
    text project_id
    text activity_id
    text actor
    text action "status.changed|evidence.added"
    text from_value
    text to_value
    text at }
```

Activities also store the static workbook columns `objective`, `tutorial`, `knowledge`, `tool`, `deliverable`, `reference`, `notes`.

## Design decisions

- **Composite key `(project_id, id)`** keeps the stable workbook ID `ACT-xx` and allows multiple projects later (D-007).
- **Derived values are not stored.** `effectivelyDone`, `dependencySatisfied`, `flag`, progress and gates are computed by `src/domain/governance/rules.ts` on every read (14–100 rows; cheap). This prevents stale counters.
- **Evidence count drives completion.** The workbook `Evidence` text column becomes zero or more `evidence` rows (imported as kind `text`).
- **Audit log is append-only.** No update/delete paths exist for `activity_events`.
- **Enums in code, not in SQL.** SQLite has no enum type; Zod and domain types enforce values.
- **Dates as ISO-8601 text.** Due dates `YYYY-MM-DD`; timestamps full ISO UTC.

## Requirement coverage

| Requirement | Entity / field |
| --- | --- |
| DR-01 workbook attributes | `activities.*` |
| DR-02 evidence | `evidence` |
| DR-03 audit | `activity_events` |
| DR-04 project | `projects`, `activities.project_id` |
| DR-05 vocabularies | `src/domain/governance/types.ts` (code), fixture `statuses/priorities/areas/phaseArea` |
| FR-12 actor/time/from/to | `activity_events.actor/at/from_value/to_value`, `activities.updated_by/updated_at` |

## Open points

- Evidence file storage (R2) and retention (D-008).
- Optimistic concurrency (`rev` column) before multi-user use.
- Foreign key from `evidence`/`activity_events` to `activities` (composite) — omitted for now; added when D-007 is decided.
