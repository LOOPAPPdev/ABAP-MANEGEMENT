# Execute Boundaries

`execute` is the only skill that modifies code. To prevent scope drift, it MUST follow these rules.

## Allowed

| Action | Source of truth |
|---|---|
| Modify a file | Listed in plan.md "Change list" with the exact path |
| Create a file | Listed in plan.md "Change list" with `[Create]` marker |
| Delete a file | Listed in plan.md "Change list" with `[Delete]` marker |
| Run a shell command | Listed verbatim in plan.md "Sync commands" |
| Run config's `typecheck` command | Read-only compile check (per-item for medium/high risk; final safety net) |
| Update `.handoff/task.md` | Always allowed |

## Forbidden

| Action | Reason |
|---|---|
| Edit any file not in plan.md change list | Improvising scope |
| Run tests or lint | Those belong to verify |
| Run anything that mutates files (e.g. `eslint --fix`, formatters, codegen not in sync commands) | Mutation outside plan = scope drift |
| Modify plan.md | The plan is the contract |
| Modify config.md or backlog.md | Setup/verify own those |
| Delete `.handoff/` | The cycle owns its state |

## Risk tags govern granularity, not authority

Plan items may carry a risk tag (`low` / `medium` / `high`) under their change list entry. The tag tells execute **how often to check**, never what to change.

| Tag | Per-item compile check | Per-item task.md update | Stop on per-item failure |
|---|:---:|:---:|:---:|
| low / untagged | no | end-of-batch | n/a (final check catches) |
| medium | yes | end-of-batch | yes — see compile-fail protocol |
| high | yes | yes (each item) | yes — durable progress before blocker |

A `high` tag does NOT permit execute to edit files outside plan, run extra commands, or improvise. It only means: check more often and persist progress more often.

## Compile-fail protocol

The `typecheck` command (from `config.md`) is the only correctness signal execute can read. Two failure scenarios:

1. **Per-item check fails** (medium/high tag): try ONE fix restricted to the current change list item's files/lines. Re-run check.
2. **Final check fails** (step 6 in SKILL.md): try ONE fix restricted to any files/lines in the change list. Re-run check.

If the fix would require editing a file or line not in the plan → STOP and blocker. Don't expand scope to chase a compile error.

## Blocker protocol

If during execution you find:
- a file the plan said to modify doesn't exist
- a function the plan referenced has a different signature
- a sync command fails in a way the plan didn't anticipate
- the change as described conflicts with code you're seeing
- compile check fails and the fix is out of scope (per Compile-fail protocol)

Then:
1. STOP. Don't push through.
2. Update `.handoff/task.md` to mark the in-progress item as ⚠️ blocked.
3. Print to user:
   ```
   ⚠️  Blocker at <task item>: <description>
   Plan needs revision. Run /plan again with this context.
   ```
4. End the session. The user re-runs `/plan` to incorporate the new info.
