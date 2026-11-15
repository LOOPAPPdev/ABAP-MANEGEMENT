# Verification Checks

`plan.md`'s `## Verification plan` section is authoritative — verify runs exactly what's listed there. Config's Verification Commands are a fallback only when plan omits the section.

**Note on typecheck.** As of v0.3.0, `typecheck` is `/execute`'s responsibility (it's run as the compile-check safety net there). `/verify` does NOT run typecheck by default. The plan's Verification plan typically lists test + lint only. If a plan explicitly lists a typecheck command under Verification plan, verify will still run it (idempotent re-check in fresh context) — but this is rare and only useful for paranoid double-checking.

## 1. Read the plan's verification commands

Read `.handoff/plan.md`'s `## Verification plan` section.

| Plan section state | Action |
|---|---|
| Lists concrete commands (one per line, format `` - `<cmd>` — <expectation> ``) | Run each command in order; capture stdout + stderr + exit per command |
| Says `(none — <rationale>)` | Skip command execution entirely. In review.md note "Verification commands skipped per plan: <rationale>". Proceed directly to step 3 (plan vs change diff). |
| Section missing or empty | Fall back: run `config.verification.test` and `config.verification.lint` (skip any that are empty; note skipped). Do NOT run `config.verification.typecheck` — execute already did. |

## 2. Per-command result handling

For each command run, regardless of source (plan or config fallback):

- Exit 0 → ✅
- Non-zero → ❌, capture the relevant context:
  - Test command: failing test names
  - Typecheck command: error count + first 5 errors
  - Lint command: error count, distinguish "errors" vs "warnings only" (warnings only → ⚠️ not ❌)
- Stop early only if a failure makes subsequent checks meaningless (e.g., test runner crashes before completing — running lint on the same broken state adds no signal)

## 3. Plan vs change diff

For each item in plan's change list, confirm the file exists and the relevant edit is present in `git diff` (or new-file content). Note:
- Files plan said to modify but show no change → ❌ blocking
- Files changed that aren't in plan → ⚠️ non-blocking ("scope drift")

## 4. Convention check (light)

Pick the convention docs path from config. Skim 1-2 docs that look relevant to the change list. If a clear violation jumps out (e.g. plan ignored a documented pattern), note as ⚠️ non-blocking with a doc reference.

Don't go deep — verify is not a substitute for code review.

## Skipped commands record

When commands are skipped (plan said `(none — ...)`, OR fallback hit empty config field), record the reason explicitly in review.md so the user knows verification scope was intentionally narrowed.
