# Cycle Close

How verify cleans up after writing review.md. Decisions branch on outcome AND on whether the plan declares phases.

## Outcome categories

- **✅ pass** = all verification commands ✅, no blocking issues, no non-blocking suggestions.
- **⚠️ pass with non-blocking** = all verification commands ✅, no blocking issues, but at least one non-blocking suggestion.
- **❌ blocking** = at least one verification command ❌ OR at least one blocking issue noted in plan-vs-diff or convention check.

## Phase detection

Before deciding cleanup, inspect `plan.md` for a `## Phases` section:

| Plan state | Phase mode |
|---|---|
| No `## Phases` section | **single-cycle** — current cleanup rules apply unchanged |
| `## Phases` exists, currently `[🔄]` phase has at least one `[ ]` (pending) phase after it | **mid-stream** — advance markers, retain plan |
| `## Phases` exists, currently `[🔄]` phase is the LAST one (no `[ ]` after) | **final phase** — close out fully |

## Per-outcome actions

### ✅ pass

**Single-cycle plans:**

1. If plan.md has `> Addresses backlog: #N, #M`:
   - Parse the IDs.
   - In `.handoff/backlog.md`, find each `- [🔄] #N ...` line and DELETE the entire line.
   - The "Closed backlog items" section in review.md is the only audit trail.
2. Delete `.handoff/plan.md`, `.handoff/task.md`, `.handoff/review.md`.
3. Print:
   ```
   ✅ Verification passed. Cycle closed.
   <if backlog closed:> Closed backlog items: #N, #M
   ```

**Mid-stream multi-phase plans:**

1. **Do NOT close backlog items.** Backlog closure waits for the final phase — the addressing work isn't done yet.
2. In `plan.md`'s `## Phases` section:
   - Change the current `[🔄] Phase N: <title>` line to `[x] Phase N: <title>   — completed YYYY-MM-DD`.
   - Change the next `[ ] Phase N+1: <title>` line to `[🔄] Phase N+1: <title>  — current`.
3. Delete `.handoff/task.md` and `.handoff/review.md`. **KEEP `.handoff/plan.md`** (with updated phase markers).
4. Print:
   ```
   ✅ Phase N verified. Advanced to Phase N+1: <title>.
   plan.md retained. Run /plan to design Phase N+1's change list.
   ```

**Final-phase multi-phase plans:**

1. Close backlog items as in single-cycle (the work is now done).
2. Delete `.handoff/plan.md`, `.handoff/task.md`, `.handoff/review.md`. (No need to update phase markers before deletion — the file is going away. If `.handoff/` is git-tracked, the prior commit's mid-stream `plan.md` already preserved the phase trail.)
3. Print:
   ```
   ✅ Final phase verified. Multi-phase task complete.
   <if backlog closed:> Closed backlog items: #N, #M
   ```

### ⚠️ pass with non-blocking

Cleanup follows the same single-cycle / mid-stream / final-phase split as ✅. Additional step: append the "⚠️ Non-blocking suggestions" from review.md as new entries in `.handoff/backlog.md`. Number them continuing the existing sequence (next free integer after the highest current ID).

Print accordingly:

- Single-cycle:
  ```
  ⚠️  Cycle closed with N suggestions added to backlog.
  <if backlog closed:> Closed backlog items: #N, #M
  ```
- Mid-stream:
  ```
  ⚠️  Phase N verified with N suggestions added to backlog. Advanced to Phase N+1.
  plan.md retained. Run /plan to design Phase N+1's change list.
  ```
- Final phase:
  ```
  ⚠️  Final phase verified with N suggestions added to backlog. Multi-phase task complete.
  <if backlog closed:> Closed backlog items: #N, #M
  ```

### ❌ blocking

(Phase mode is irrelevant here — blocking always retains state.)

1. Do NOT modify backlog. Items marked 🔄 stay 🔄 — the next plan cycle will pick them up after the blockers are fixed.
2. Do NOT delete plan.md, task.md, review.md. The next /plan will read them.
3. Print:
   ```
   ❌ Verification found blocking issues. See .handoff/review.md.
   Run /plan to address them. The next /plan will detect the retained
   plan.md and review.md and read both to inherit context (see plan
   skill's Gate "Re-entry check").
   ```

## Backlog ID assignment

Open question (spec §11): is backlog ID monotonically increasing, or do we reuse closed IDs? **MVP decision: monotonic.** Find max integer ID currently in backlog.md, increment for each new non-blocking item.

## No `.bak` file

Spec §6.4: rely on git for backups. Never create `.handoff/backlog.md.bak`.
