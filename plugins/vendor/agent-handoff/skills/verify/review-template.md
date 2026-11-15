# Review Template

Standard structure for `.handoff/review.md`.

````markdown
# Verification Report

> Created: YYYY-MM-DD
> Plan: <plan title>
> <if multi-phase:> Phase: [N] <title>
> Outcome: ✅ pass / ⚠️ pass with non-blocking / ❌ blocking

## Verification Commands

| Check | Command | Result |
|---|---|---|
| Tests | <cmd> | ✅ N tests passed |
| Lint | <cmd> | ✅ no errors |

(Typecheck is run by /execute as compile check — not repeated here unless plan explicitly listed it under Verification plan.)

## Plan vs change diff

Findings ordered by risk tag (high → medium → low/untagged).

### 🔴 High-risk items

- `<file>` — <plan said X> / <code shows Y>: ✅ matches (or ❌ <discrepancy>)
- ...

### 🟡 Medium-risk items

- ...

### Other items

- All change list items applied: ✅ / ❌ <list>
- Out-of-plan changes: <list or "(none)">

## ✅ Highlights

Brief, concrete things done well. Skip if nothing notable.

## ⚠️ Non-blocking suggestions

Will be appended to `.handoff/backlog.md` on cycle close. Each line:

`- [ ] <one-sentence improvement>, with rationale.`

## ❌ Blocking issues

(Only if outcome is ❌.) Each item: file:line, problem, recommended fix direction. High-risk blockers listed first.

## Closed backlog items

(Only if plan had `> Addresses backlog: ...` and verify passed AND this is a single-cycle or final-phase pass — mid-stream phase passes do NOT close backlog.)

- #2: <title>
- #5: <title>

## Cycle close

Per outcome and phase mode:

- ✅ pass, single-cycle: handoff files deleted (plan, task, review). Backlog #N, #M closed.
- ✅ pass, mid-stream phase: task.md and review.md deleted. **plan.md retained with advanced markers.** Backlog NOT closed (waits for final phase).
- ✅ pass, final phase: handoff files deleted. Backlog closed.
- ⚠️ non-blocking only: same as ✅ for cleanup; suggestions appended to backlog regardless of phase.
- ❌ blocking: handoff files retained. Run /plan to address blockers.
````
