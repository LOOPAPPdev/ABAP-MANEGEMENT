---
name: execute
description: Use after /plan to apply the planned changes. Reads .handoff/plan.md and writes/updates code exactly as specified, runs sync commands listed in the plan, and runs the read-only compile check (config's typecheck) as a safety net. Does NOT run tests or lint — those belong to /verify. Honors per-item risk tags from plan to decide check granularity. Pair with /plan and /verify. Part of the agent-handoff bundle (4 skills) — install /setup-handoff, /plan, /execute, /verify together.
---

# Execute

Apply the changes that `plan.md` describes. Stay strictly inside the plan; never improvise.

## Gate (run first)

1. Read `.handoff/config.md`. If missing, abort:
   > ❌ No config found. Run `/setup-handoff` first.
2. Read `.handoff/plan.md`. If missing, abort:
   > ❌ No plan found. Run `/plan` first.
3. Both present → proceed.
4. If plan has `## Phases` and a phase is marked `[🔄]`, only that phase's change list is in scope. Phases marked `[x]` are already done; phases marked `[ ]` are future work for later cycles.

## Output language

All output from this skill — conversational replies to the user, status messages, blocker reports, AND `task.md` notes — uses the language specified by `config.md`'s `response_language`. Default if config missing or field absent: `en`. Code edits, file paths, command syntax, and shell command output stay in their native language.

## Workflow

1. Read `plan.md` end-to-end.
2. Create `.handoff/task.md` with one checkbox per change list entry plus one per sync command.
3. **Check for parallelization.** If `plan.md` has a `## Parallelization` section AND your host agent supports parallel subagent dispatch (e.g., Claude Code's Task tool), dispatch one subagent per independent group instead of applying sequentially in step 4. The dispatcher (this skill instance) owns `task.md` updates; subagents apply file edits only and report completion per file. Wait for all subagents before running sync commands (step 5). If a subagent hits a blocker, follow the blocker protocol in [boundaries.md](boundaries.md). If host doesn't support parallel dispatch or no `## Parallelization` section exists, fall back to sequential application below.

   **Interaction with risk tags**: in parallel dispatch mode, the per-item compile-check granularity from step 4 does NOT apply — subagents do file edits only, and only the final safety-net check (step 6) runs. If a plan has `medium` or `high` risk-tagged items inside a parallelizable group, those items lose their per-item compile-check safety. Plan authors are expected to keep high-risk items out of `## Parallelization` groups (see plan/SKILL.md step 6); if you encounter this combination during execute, proceed but note it in the final task.md notes section.
4. For each change list item, apply per its **risk tag** (plans without tags are treated as low):
   - **low / untagged**: apply edits, update task.md after each. No per-item compile check.
   - **medium**: apply edits → run compile check (config's `typecheck`, if set) → update task.md. On failure, see step 6.
   - **high**: apply edits → run compile check → update task.md immediately (so progress is durable across blockers) → only then proceed. On failure, see step 6.
5. After code edits done, run sync commands one by one. Update task.md per command.
6. **Final compile check (safety net).** If `config.md` has a `typecheck` command, run it. Skipped if config has no typecheck or plan explicitly opts out via `(none — ...)` in a `## Compile check` plan section.
   - Pass → continue to step 7.
   - Fail → make at most ONE fix attempt, restricted to files/lines listed in the current change list. Re-run.
   - Still fail (or fix would require touching out-of-plan files) → blocker. STOP and report per Boundaries.
7. Print:
   ```
   ✅ task.md updated. All planned changes applied. Compile check ✅.
   Next step: /verify (strongly recommended in a fresh chat)
   ```

## Boundaries

See [boundaries.md](boundaries.md). Critical points:
- Only run: commands listed under "Sync commands" in the plan, AND the `typecheck` command from `config.md` (read-only compile check).
- Never run tests or lint — those belong to /verify. Anything that mutates files (e.g. `eslint --fix`, formatters) stays in /verify regardless.
- Risk tags only adjust check granularity. They never grant authority to edit files outside the plan.
- Compile-fail recovery: at most one fix attempt within the plan's listed files/lines. If that doesn't resolve it, blocker.
- Never modify plan.md.
- If a critical blocker is discovered (the plan can't be executed as written), STOP, print:
  ```
  ⚠️  Blocker: <description>. Plan needs revision — run `/plan` again.
  ```
  Do NOT improvise around it.
