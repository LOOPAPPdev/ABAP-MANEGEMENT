# Plan Template

Every `plan.md` follows this structure. Sections marked (optional) are omitted when not applicable. Default = minimal; escalate only when the work demands it.

## Header

```markdown
# <Task title>

> Created: YYYY-MM-DD
> Author: plan skill
```

## (Optional) Backlog marker

If this plan addresses backlog items:

```markdown
> Addresses backlog: #2, #5
```

Backlog items are closed only on the FINAL phase's verify pass (or immediately on a single-cycle plan). Mid-stream phase passes do not close backlog items, since the addressing work isn't done yet.

## Background

Two or three sentences. Why are we doing this? What's the user-visible outcome?

## Phases

Optional. Use only when the task is large enough to span multiple plan→execute→verify cycles. Each phase is an independent verifiable unit (e.g., DB migration → API layer → frontend → cleanup). Format:

```markdown
- [x] Phase 1: <title>   — completed YYYY-MM-DD
- [🔄] Phase 2: <title>  — current
- [ ] Phase 3: <title>
- [ ] Phase 4: <title>
```

States: `[ ]` pending, `[🔄]` current (this plan's scope), `[x]` done. The `[🔄]` phase scopes the rest of `plan.md` (Change list, Sync commands, Verification plan, etc.). On verify pass, markers advance and `plan.md` is retained until the last phase completes — see [verify cycle-close](../verify/cycle-close.md). On the next `/plan` invocation in the same multi-phase task, re-entry detects the retained `plan.md` and scopes work to the new `[🔄]` phase.

If the task is single-cycle, omit this section entirely.

## Change list

For every file that will be created or modified, one entry.

**Minimal form (low-risk changes — most common):**

```markdown
### `path/to/file.ext` — [Create | Modify | Delete]

What changes and why. If modifying, name the function/section. Cite the convention doc that governs the pattern (from config's doc index).
```

**Escalated form (medium/high-risk changes only):**

```markdown
### `path/to/file.ext` — [Modify]

What changes and why. Cite convention.

- **Risk**: high — <one-line reason; required for high>
- **Side effects**: <db schema | filesystem | network | auth | concurrency | none>
- **Affected callers**: `auth.ts:42`, `signup.ts:18`  (or "(none)")
- **Affected imports**: `User`, `UserOptions`  (or "(none)")
- **Blast radius**: <what breaks if this is wrong>
- **Rollback**: <how to undo>
```

Risk tags (`low` / `medium` / `high`) are honored by `/execute` to adjust check granularity — see [execute boundaries](../execute/boundaries.md) "Risk tags govern granularity". Items without an explicit tag are treated as `low`.

Authors should NOT inflate tags ("just to be safe"). Each `high` requires a one-line reason — the reason carries forward into `review.md` as a prioritized finding.

## Parallelization (optional)

When the change list contains subsets that can be applied independently — no shared types, no shared sync command, no sequential dependency — group them here. `/execute` may dispatch each group to a separate subagent when the host agent supports parallel dispatch (e.g., Claude Code's Task tool). Otherwise execute applies them sequentially. If nothing in the change list is safely parallelizable, omit this section.

```markdown
- **Group A (independent):** `frontend/main/src/components/error-boundary.tsx`
- **Group B (independent):** `packages/logic/src/hooks/use-user-search.ts`
- **Group C (depends on B):** `frontend/main/src/container/{home-start,dm,notifications}/*.container.tsx`
```

Each group is a bullet. Mark dependencies inline ("depends on X") so the executor knows what must finish first.

## Sync commands (optional)

Only when the change requires running shell commands beyond pure code edits — e.g. installing dependencies, running codegen, generating migrations. Each command on its own line:

```
pnpm install
pnpm gen:types
```

If no sync commands, omit this section entirely.

## Test strategy

Per change, what test confirms it. Reference exact test file paths.

```markdown
- `tests/<area>/<file>.test.ts` — verifies <behavior>
```

## Compile check

Optional. `/execute` runs `config.md`'s `typecheck` command as a final safety net by default. Add this section ONLY to opt out (e.g., docs-only plan, intentional WIP) — body matches the Verification plan's `(none — rationale)` pattern:

```markdown
(none — docs-only change, no compile impact)
```

Rationale after the em-dash is required.

## Verification plan

The exact commands `/verify` will run for this change. Pick the subset that actually applies — verify runs ONLY what's listed here, in order. Typecheck is `/execute`'s job (per Compile check above), so typically don't list typecheck here unless you specifically want a re-run in fresh context.

**(a) Concrete commands (the common case):**

```markdown
- `<test cmd>` — all tests pass
- `<lint cmd>` — no errors
```

For monorepos, list per-workspace commands matching the touched workspaces:

```markdown
- `pnpm -C apps/server test` — server unit tests pass
- `pnpm -C apps/server lint` — server lint clean
```

**(b) Explicit skip (when no command verification applies):**

```markdown
(none — docs-only change; plan-vs-diff check is sufficient)
```

Rationale after the em-dash is required so verify can record WHY commands were skipped. The plan-vs-diff and convention checks still run.
