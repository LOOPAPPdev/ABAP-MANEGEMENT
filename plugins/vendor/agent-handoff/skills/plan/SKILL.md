---
name: plan
description: Use when starting a new feature, fix, or refactor that needs explicit planning before code changes. Reads .handoff/config.md (and backlog if present) and writes a structured plan.md to .handoff/. Supports multi-phase plans for large work, and risk tags on change list items. Does NOT modify code or run build commands. Pair with /execute and /verify. Part of the agent-handoff bundle (4 skills) — install /setup-handoff, /plan, /execute, /verify together.
---

# Plan

Investigate the codebase, design the change, and write `.handoff/plan.md`. No code modification, no command execution.

## Gate (run first)

1. Read `.handoff/config.md`. If missing, abort:
   > ❌ No config found. Run `/setup-handoff` first.
2. **Re-entry check.** Inspect `.handoff/` for retained state:

   | State | Mode | Action |
   |---|---|---|
   | `plan.md` AND `review.md` exist | Blocked cycle | Read both. The previous plan attempted work; review.md lists blockers. The new plan must address the blockers. **Preserve the existing structure**: keep `## Background`, keep `## Phases` (if any) including the current `[🔄]` marker — verify did not advance because blocking retains state and this phase's work isn't done. Replace only the parts that review.md identifies as broken. If previous plan had `> Addresses backlog: ...`, carry the marker forward (🔄 items in backlog stay 🔄). |
   | `plan.md` exists with `## Phases` and a `[🔄]` marker, `review.md` absent | Phase advance | Read previous plan to inherit context. **Inherit `## Background` and `## Phases`** (with markers already advanced by verify). Replace the previous phase's `## Change list`, `## Sync commands`, `## Test strategy`, `## Verification plan`, and `## Compile check` (if any) with the new `[🔄]` phase's content. Carry forward `> Addresses backlog: ...` if present. |
   | `plan.md` exists, no Phases section, `review.md` absent | Unusual | Verify normally cleans up after pass. This state suggests manual edit. Ask the user: "Found retained plan.md without phases or review. Continue editing it, or start fresh?" |
   | None exist | Fresh plan | Proceed normally. |

3. If `.handoff/backlog.md` exists and has any open items: see [backlog-handling.md](backlog-handling.md).

## Output language

All output from this skill — conversational replies to the user, status/progress messages, AND the written `plan.md` — uses the language specified by `config.md`'s `response_language`. Default if config missing or field absent: `en`. Code, file paths, command syntax, and identifiers stay in their native language regardless.

## Workflow

1. **Determine task scope based on Gate's matched re-entry mode:**
   - **Fresh plan**: resolve task description from `/plan "<arg>"` if provided; otherwise the user typed `/plan` alone and we may need to surface the backlog (see backlog-handling.md).
   - **Blocked cycle**: task is "address the blockers from review.md". Do NOT redesign Background or Phases — preserve them. Only revise `## Change list` (and dependent sections like `## Sync commands`, `## Verification plan`) where review.md says they were wrong.
   - **Phase advance**: task is "design the `[🔄]` phase's change list". Inherit `## Background` and `## Phases` from the previous plan.md as-is. Skip step 3 (scope assessment — phases are already declared).
   - **Unusual**: stop and ask user (per Gate's instruction).
2. Investigate the codebase. Use the convention docs path and project doc index from config to guide what to read. Look at existing patterns the change must match.
3. **Assess scope** *(skip if Gate matched Blocked cycle or Phase advance — scope was already decided in the original plan)*. If the work has clear, sequentially-dependent stages that are each independently verifiable (e.g., DB migration → API → frontend → cleanup), propose splitting into `## Phases`. Confirm with user before committing to a multi-phase plan. Otherwise proceed as a single-cycle plan.
4. Design the change list. Match the structure described in [plan-template.md](plan-template.md): change list, sync commands (if any), test strategy, verification plan.
   - **Verification scope decision.** When filling the `## Verification plan` section, look at the change list and pick ONLY the commands that actually apply. `/verify` will run exactly what's listed there. Typecheck is /execute's job — typically don't list it under verification. If the change is docs-only (or otherwise needs no command verification), write `(none — <one-line rationale>)`.
   - **Compile check opt-out.** If the change should NOT trigger /execute's compile check (e.g., docs-only, intentional WIP), add a `## Compile check` section with body `(none — <rationale>)`. Otherwise omit the section entirely (default = run config's typecheck).
5. **Risk-tag the change list.** For each change list item, decide whether to escalate:

   | Signal | Suggested tag |
   |---|---|
   | Path: `migrations/`, `auth/`, `infra/`, `*.config.*`, `.github/workflows/`, security-sensitive areas | medium-high |
   | Operations: delete / drop / alter / rotate / rename | medium-high |
   | Public API or cross-package signature change (callers in other packages) | medium |
   | > 5 files touched in one item, or > 20 in the plan | medium |
   | Side effects: DB schema, fs writes, network calls, auth changes, concurrency primitives | medium-high |
   | Plain logic edit, single file, no signature change | low / untagged |

   Default to leaving items untagged (= low). Suggest escalations to the user; require a one-line reason for any `high`. Do NOT inflate tags "just to be safe" — every `high` slows execute and surfaces in review.

   **Non-interactive flows**: when no user input channel is available (scripted invocation, headless agent, CI), default all items to untagged (low) and skip the suggestion step. Do NOT auto-assign `medium` or `high` without confirmation — auto-tagging would either over-cautiously slow every execute or under-tag missed signals. Keep the safe default and let an interactive re-run upgrade tags when warranted.
6. **Identify independent units.** Look at the change list: are there subsets of files/changes that can be applied independently (no shared types, no shared sync command, no sequential dependency)? If yes, list them as parallelizable groups in plan.md's optional `## Parallelization` section. If everything is sequential or tightly coupled, omit the section.

   **Do NOT include `high`-risk items in parallelizable groups.** Parallel dispatch (handled by /execute) skips per-item compile checks — only the final safety-net check runs. `high` items are tagged precisely because they need per-item discipline; putting them in a parallel group silently strips that safety. Either keep high items sequential (omit them from `## Parallelization`) or — if parallel execution truly outweighs per-item check — downgrade them to medium with a one-line justification.
7. Write `.handoff/plan.md`.
8. If backlog items are being addressed, also mark them 🔄 in `.handoff/backlog.md` (see backlog-handling.md §3). For multi-phase plans, the marker stays 🔄 across all phases until the final phase passes verify.
9. Print:
   ```
   ✅ Plan written to .handoff/plan.md
   <if multi-phase:> Active phase: [N] <title>
   Next step: /execute (recommended in a fresh chat to keep context clean)
   ```

## Boundaries

- **Allowed:** read any file, web search, write `.handoff/plan.md`, mark items in `.handoff/backlog.md`.
- **Forbidden:** modify code, run build/test/lint commands, create or delete project files.
