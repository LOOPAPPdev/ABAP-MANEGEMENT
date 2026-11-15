---
name: verify
description: Use after /execute to verify the changes are correct. Reads .handoff/{config,plan,task}.md, runs the verification commands from plan (typically test + lint; typecheck is execute's job), compares plan-vs-code, writes review.md, and on success cleans up handoff state. For multi-phase plans, advances phase markers instead of full cleanup until the last phase. STRONGLY recommended to run in a fresh chat — fresh context is the entire point of this stage. Part of the agent-handoff bundle (4 skills) — install /setup-handoff, /plan, /execute, /verify together.
---

# Verify

Independent validation of `execute`'s output. Strict separation of context is the value: a fresh chat reading only the plan and code can spot what an in-context verify would miss.

Compile check (typecheck) has already been run by `/execute` as the safety net there. Verify focuses on **test, lint, plan-vs-code judgment, and convention adherence** — the work that requires fresh-context judgment.

## Gate (run first)

Required files in `.handoff/`: `config.md`, `plan.md`, `task.md`. If any missing, abort with the matching message:

- `config.md` missing:
  > ❌ No config found. Run `/setup-handoff` first.
- `plan.md` missing:
  > ❌ No plan found. Run `/plan` first.
- `task.md` missing:
  > ❌ No task found. Run `/execute` first.

## Output language

All output from this skill — conversational replies to the user, status messages, AND the written `review.md` — uses the language specified by `config.md`'s `response_language`. Default if config missing or field absent: `en`. Verification command output (test/typecheck/lint stdout/stderr) is kept verbatim in its original language; your summary of those results uses `response_language`.

## Workflow

1. Read config, plan, task. If plan has `## Phases`, note the active `[🔄]` phase — only that phase's change list is in scope for plan-vs-code comparison.
2. Run verification commands from plan's `## Verification plan` (or fallback to config's test+lint — NOT typecheck). See [checks.md](checks.md) for command execution rules.
3. Compare actual code changes against the active phase's change list — note anything missing or extra. **Surface high-risk items first** in the report so they can't be glossed over by self-review bias.
4. Build review.md per [review-template.md](review-template.md). Order findings by risk tag (high → medium → low/untagged).
5. Run cycle close per [cycle-close.md](cycle-close.md): file cleanup + backlog auto-resolve + non-blocking append. For multi-phase plans, this advances phase markers instead of full cleanup unless this is the final phase.
6. Print summary based on outcome (see cycle-close.md).

## Boundaries

- **Allowed:** run verification commands, read any file, write `.handoff/review.md`, edit `.handoff/backlog.md` (resolve 🔄 items, append non-blocking), delete `.handoff/{plan,task,review}.md` per cycle-close rules.
- **Forbidden:** modify any code, modify `plan.md` or `task.md` mid-cycle, delete `.handoff/config.md`, delete the user's source files.
