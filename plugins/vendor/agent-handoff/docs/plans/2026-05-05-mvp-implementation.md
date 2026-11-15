# Agent Handoff Skills MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the 4-skill `agent-handoff` plugin (`setup-handoff`, `plan`, `execute`, `verify`) per the design spec, ready for first commit + GitHub push.

**Architecture:** Each skill is a folder under `skills/<name>/` with a `SKILL.md` (Claude Code/agent-agnostic format) plus reference markdown files. State flows through `.handoff/*.md` files written and read by the skills. The `.claude-plugin/plugin.json` registers all four as slash commands.

**Tech Stack:** Pure markdown. No build step. No runtime dependencies. Plugin manifest format from Claude Code.

**Working directory:** `~/Desktop/projects/agent-handoff/`

**Reference:** `docs/specs/2026-05-05-agent-handoff-design.md` — single source of truth. Each task cites the spec section it implements. **Do not deviate from the spec; if a step seems off, re-check the spec rather than improvising.**

**Response language:** All Claude responses during execution → Korean (사용자 preference). All written artifacts (SKILL.md, README, examples, code) → English (target audience = global).

---

## Pre-flight check

- [ ] **Confirm working directory and spec presence**
```bash
cd ~/Desktop/projects/agent-handoff && pwd
ls docs/specs/2026-05-05-agent-handoff-design.md
```
Expected: `~/Desktop/projects/agent-handoff` and the spec file path printed.

- [ ] **Confirm git not yet initialized**
```bash
[ ! -d .git ] && echo "fresh" || echo "already a repo"
```
Expected: `fresh`

---

## Task 1: Repo bootstrap + plugin manifest

**Implements spec:** §7 Repo 구조 (LICENSE, plugin.json, README skeleton)

**Files:**
- Create: `.gitignore`
- Create: `LICENSE`
- Create: `.claude-plugin/plugin.json`
- Create: `README.md` (skeleton — full content in Task 8)

- [ ] **Step 1: git init**
```bash
cd ~/Desktop/projects/agent-handoff
git init -b main
```
Expected: `Initialized empty Git repository in ...`

- [ ] **Step 2: Write .gitignore**

File: `.gitignore`
```
# OS
.DS_Store
Thumbs.db

# Editor
.idea/
.vscode/
*.swp

# Local handoff state (when this repo itself is used to test the plugin)
.handoff/
```

Note: `.handoff/` is gitignored at repo level so contributor's local handoff state stays local.

- [ ] **Step 3: Write LICENSE (MIT)**

File: `LICENSE` — standard MIT text. Copyright line:
```
Copyright (c) 2026 <github-username>
```
Replace `<github-username>` with the actual GitHub user at commit time.

- [ ] **Step 4: Write `.claude-plugin/plugin.json`**

File: `.claude-plugin/plugin.json`
```json
{
  "name": "agent-handoff",
  "skills": [
    "./skills/setup-handoff",
    "./skills/plan",
    "./skills/execute",
    "./skills/verify"
  ]
}
```

- [ ] **Step 5: Write README.md skeleton**

File: `README.md`
```markdown
# Agent Handoff Skills

Strict 3-stage handoff workflow for coding agents — `plan` → `execute` → `verify` — with disk-backed state for cross-context handoff.

> Status: under construction. Full README arrives in the same release as the four skills.
```

- [ ] **Step 6: Verify directory structure**
```bash
find . -type f \( -not -path "./docs/*" -not -path "./.git/*" \) | sort
```
Expected:
```
./.claude-plugin/plugin.json
./.gitignore
./LICENSE
./README.md
```

- [ ] **Step 7: Commit**
```bash
git add .gitignore LICENSE .claude-plugin/ README.md docs/specs/ docs/plans/
git commit -m "chore: bootstrap repo with plugin manifest, license, and design docs"
```

---

## Task 2: setup-handoff skill

**Implements spec:** §3 (게이트 룰의 setup), §5 (setup-handoff 동작 전체)

**Files:**
- Create: `skills/setup-handoff/SKILL.md`
- Create: `skills/setup-handoff/auto-scan.md`
- Create: `skills/setup-handoff/interview.md`

- [ ] **Step 1: Write SKILL.md frontmatter and overall structure**

File: `skills/setup-handoff/SKILL.md`

```markdown
---
name: setup-handoff
description: Use once per project before /plan, /execute, /verify. Auto-scans the repo (manifests, agent guidance, doc tree, toolchain) and runs a short interview to write .handoff/config.md. Pass --auto to skip the interview and accept all auto-detected values, falling back to interview only for items that auto-detection cannot resolve.
---

# Setup Handoff Workflow

Bootstrap the `.handoff/` directory by scanning the project and writing `config.md` — the source of truth that `/plan`, `/execute`, `/verify` read on every invocation.

## Modes

| Mode | Auto-scan | Interview |
|---|:---:|:---:|
| `/setup-handoff` (default) | always | 4 questions, ~1 min |
| `/setup-handoff --auto` | always | skipped; falls back to asking ONLY for items auto-detection couldn't resolve |

## Workflow

1. Detect mode (default vs `--auto`).
2. Run auto-scan → see [auto-scan.md](auto-scan.md).
3. Decide per item: use auto-detected value, or ask the user.
   - Default mode: ask all 4 items, presenting auto-detected values as defaults → see [interview.md](interview.md).
   - `--auto` mode: use auto-detected values silently. For items where detection failed, fall back to asking just that one (announce the fallback).
4. Create `.handoff/` if missing. Write `.handoff/config.md`.
5. Print summary:
   ```
   ✅ Handoff config written to .handoff/config.md
   Next step: /plan "<task description>"
   ```

## Boundaries

- **Allowed:** read project files, write/update `.handoff/config.md`, create `.handoff/` directory.
- **Forbidden:** modify any file outside `.handoff/`. Run no build/test/lint commands.

## Gates

`setup-handoff` has no input gate — it's the entry point. Always proceeds.
```

- [ ] **Step 2: Write auto-scan.md**

File: `skills/setup-handoff/auto-scan.md`

Contents (cite spec §5.1 directly):

```markdown
# Auto-Scan Rules

Run all five scans before any user interaction. Each scan produces a default value (or marks the item as "needs interview" if scanning failed).

## 1. Agent guidance files

Look for these files at repo root (or near root). Collect any that exist:

- `CLAUDE.md`
- `AGENTS.md`
- `GEMINI.md`
- `.cursorrules`
- `.cursor/rules/` (directory; list contents)
- `.github/copilot-instructions.md`
- `.aider.conf.yml`

## 2. Verification command candidates (manifests)

Probe these in order; the first that yields candidates wins, but record all that exist:

| Manifest | How to extract |
|---|---|
| `package.json` | Read `scripts` keys; match `test`, `typecheck`/`tsc`, `lint`/`eslint` |
| `pyproject.toml` | Look for `[tool.poetry.scripts]`, `[project.scripts]`; otherwise default to `pytest`, `mypy`, `ruff check` |
| `Cargo.toml` | Defaults: `cargo test`, `cargo check`, `cargo clippy` |
| `go.mod` | Defaults: `go test ./...`, `go vet ./...`, `golangci-lint run` |
| `Gemfile` | Defaults: `bundle exec rspec`, `bundle exec rubocop` |
| `composer.json` | Read `scripts` keys |
| `Makefile` | Look for targets named `test`, `typecheck`, `lint` |

If none match, mark all three (test/typecheck/lint) as "needs interview".

## 3. Documentation directory tree

Scan top-level for any of: `docs/`, `documentation/`, `wiki/`, `.agent/rules/`, `guides/`.

For each found, list contents up to 2 levels deep. Cap at 50 files; if more, list 50 and note "(N more)".

## 4. README summary

If `README.md` (or `README.rst`, `README`) exists at root, read first ~200 lines. Extract:
- Project description (first paragraph after the heading)
- Stack indicators (framework names, language mentions)

## 5. Toolchain detection

| Signal | Conclusion |
|---|---|
| `pnpm-lock.yaml` | package manager: pnpm |
| `yarn.lock` | package manager: yarn |
| `package-lock.json` | package manager: npm |
| `bun.lockb` | package manager: bun |
| `turbo.json` | monorepo: turborepo |
| `lerna.json` | monorepo: lerna |
| `nx.json` | monorepo: nx |
| `pnpm-workspace.yaml` | monorepo: pnpm workspaces |
| `Cargo.lock` + `[workspace]` in Cargo.toml | monorepo: cargo workspaces |
| package.json `dependencies` keys (or pyproject) | frameworks: detect React, Vue, Next, NestJS, Django, FastAPI, etc. |

## Output of auto-scan

A structured object the interview module reads:
- `verification.test`, `verification.typecheck`, `verification.lint` (each: detected command or `null`)
- `agent_guidance` (list of file paths)
- `doc_tree` (nested list)
- `toolchain.pkg_manager`, `toolchain.monorepo`, `toolchain.frameworks` (string or list)
- `convention_doc_candidates` (subset of doc_tree directories whose names match `conventions|rules|guidelines|patterns|standards`; mark the strongest match with ★)
```

- [ ] **Step 3: Write interview.md**

File: `skills/setup-handoff/interview.md`

Contents (mirror spec §5.4 verbatim, plus `--auto` fallback rules):

```markdown
# Interview Script

Run one question at a time. After each answer, store the result and move on.

## Default mode (4 questions)

### [1] Verification commands

Show auto-detected defaults (or "(not detected)" for any null):

```
[1] Verification commands
    Detected:
      test:      <auto.test or "(not detected)">
      typecheck: <auto.typecheck or "(not detected)">
      lint:      <auto.lint or "(not detected)">
    Use these? [Y/edit/skip]
```

- `Y` (or Enter): use detected values; missing ones become empty
- `edit`: ask each command one by one (fall back to a free-text prompt)
- `skip`: leave all three empty (verify will warn later)

### [2] Response language

```
[2] Response language (default: en) — change? [y/N]
```

- `N` (or Enter): keep `en`
- `y`: free-text input (ISO code preferred, e.g. `ko`, `ja`)

If the auto-scan found agent guidance files (CLAUDE.md, AGENTS.md) that contain language directives like "respond in Korean", use that as the default instead of `en`.

### [3] Convention docs path

If `convention_doc_candidates` is non-empty:

```
[3] Convention docs path
    Detected:
      ★ <strongest match>
        <other candidates>
    Which? [1/2/.../none]
```

If no candidates: `[3] Convention docs path? Free-text or 'none'.`

### [4] Project documentation index

```
[4] Project documentation index
    Auto-collected:
      Agent guidance: <list>
      Docs:           <doc_tree summary>
      Toolchain:      <pkg_manager> + <monorepo> + <frameworks>
    Confirm or edit? [Y/edit]
```

- `Y` (or Enter): commit as-is
- `edit`: open the structured index for free-text editing (line-by-line removal allowed)

## --auto mode

For each of the 4 items, if auto-scan produced a non-null value: use it silently. If null:

```
⚠️  Couldn't auto-detect [<item name>]. Falling back to interview for this item.
```

Then ask only that item using the default-mode prompt.

### Fallback when interactive prompts are blocked

If `AskUserQuestion` (or any interactive prompt) is denied — for example, when running in don't-ask mode or a non-interactive environment — do NOT error out. Use these defaults silently for any item that needs user input but cannot be asked:

| Item | Fallback default |
|---|---|
| `response_language` | `en` |
| `test` / `typecheck` / `lint` | empty (verify will warn later) |
| `convention_docs` | empty |
| `doc_index` | only auto-detected entries |

`handoff_dir` is always `.handoff` and never asked.

After all items resolved, write `.handoff/config.md`. If any item used a fallback default (because interactive prompts were blocked), append one summary note before the final summary print:

```
⚠️  Used defaults for: <comma-separated item names>. Interactive prompts were unavailable.
    Edit .handoff/config.md to adjust.
```

## Final write

Construct the markdown body per spec §5.5 layout. Sections:

```
# Handoff Config

## Verification Commands
test:      ...
typecheck: ...
lint:      ...
build:     (optional)

## Conventions
response_language: ...
handoff_dir:       .handoff
commit_style:      conventional

## Project Documentation Index

### Agent guidance
- ...

### Project docs
- ...

### Detected toolchain
- package manager: ...
- monorepo: ...
- frameworks: ...
```

Write to `.handoff/config.md`.
```

- [ ] **Step 4: Hand-walk the spec scenarios touching this skill**

Open spec Appendix A and read scenarios 1, 2, 3, and 8. For each, trace the SKILL.md + auto-scan.md + interview.md and ask:
- Does the SKILL match the expected behavior?
- Are there any decision branches not covered by the docs?

If a gap is found, edit the relevant file and re-trace.

- [ ] **Step 5: Commit**
```bash
git add skills/setup-handoff/
git commit -m "feat(setup-handoff): add skill with auto-scan and interview references"
```

---

## Task 3: plan skill

**Implements spec:** §3 (게이트 룰, plan의 backlog 인지), §4 (boundary), §6.2 (backlog 처리 마킹)

**Files:**
- Create: `skills/plan/SKILL.md`
- Create: `skills/plan/plan-template.md`
- Create: `skills/plan/backlog-handling.md`

- [ ] **Step 1: Write SKILL.md**

File: `skills/plan/SKILL.md`

```markdown
---
name: plan
description: Use when starting a new feature, fix, or refactor that needs explicit planning before code changes. Reads .handoff/config.md (and backlog if present) and writes a structured plan.md to .handoff/. Does NOT modify code or run build commands. Pair with /execute and /verify.
---

# Plan

Investigate the codebase, design the change, and write `.handoff/plan.md`. No code modification, no command execution.

## Gate (run first)

1. Read `.handoff/config.md`. If missing, abort:
   > ❌ No config found. Run `/setup-handoff` first.
2. If `.handoff/backlog.md` exists and has any open items: see [backlog-handling.md](backlog-handling.md).

## Workflow

1. Resolve the task description: from `/plan "<arg>"` if provided, otherwise the user just typed `/plan` and we may need to surface the backlog (see backlog-handling.md).
2. Investigate the codebase. Use the convention docs path and project doc index from config to guide what to read. Look at existing patterns the change must match.
3. Design the change. Match the structure described in [plan-template.md](plan-template.md): change list, sync commands (if any), test strategy, verification plan.
4. Write `.handoff/plan.md`.
5. If backlog items are being addressed, also mark them 🔄 in `.handoff/backlog.md` (see backlog-handling.md §3).
6. Print:
   ```
   ✅ Plan written to .handoff/plan.md
   Next step: /execute (recommended in a fresh chat to keep context clean)
   ```

## Boundaries

- **Allowed:** read any file, web search, write `.handoff/plan.md`, mark items in `.handoff/backlog.md`.
- **Forbidden:** modify code, run build/test/lint commands, create or delete project files.

## Output language

Write `plan.md` in the language given by `config.md`'s `response_language` (default: en).
```

- [ ] **Step 2: Write plan-template.md**

File: `skills/plan/plan-template.md`

```markdown
# Plan Template

Every `plan.md` follows this structure. Sections marked (optional) are omitted when not applicable.

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

## Background

Two or three sentences. Why are we doing this? What's the user-visible outcome?

## Change list

For every file that will be created or modified, one entry:

```markdown
### `path/to/file.ext` — [Create | Modify]

What changes and why. If modifying, name the function/section. Cite the convention doc that governs the pattern (from config's doc index).
```

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

## Verification plan

Which `Verification Commands` from config will run, and what we expect:

```markdown
- `<test cmd>` — all tests pass
- `<typecheck cmd>` — no errors
- `<lint cmd>` — no errors
```
```

- [ ] **Step 3: Write backlog-handling.md**

File: `skills/plan/backlog-handling.md`

```markdown
# Backlog Handling

Decision tree run at the start of `/plan`, after the config gate passes.

## 1. Detect backlog state

Read `.handoff/backlog.md`. State:
- **Empty / missing** → proceed normally (no backlog interaction).
- **Has open items** (lines starting `- [ ]`) → branch on user input.

## 2. Branch on user input

| User input | Action |
|---|---|
| `/plan` (no argument) | Ask: "Backlog has N open items. Process backlog or start a new plan? Reply with item numbers (e.g. `2,5`) or describe the new task." |
| `/plan "<task>"` (argument given) | New task takes priority. After investigating, scan backlog titles for keyword overlap with the new task. If overlap found, ask: "This may overlap with backlog #N (<title>). Include in this plan?" |

## 3. When backlog items will be addressed

Two writes happen together:

### plan.md gets a marker (top of file, before "Background"):

```markdown
> Addresses backlog: #2, #5
```

### backlog.md items get the in-progress marker:

Replace `- [ ]` with `- [🔄]` for each item being addressed.

Before:
```markdown
- [ ] #2 Add error boundary to Container
```

After:
```markdown
- [🔄] #2 Add error boundary to Container
```

This protects the items from being picked up by another plan cycle in flight.

## 4. Cycle outcomes

`verify` handles cleanup; this skill only marks. See `skills/verify/cycle-close.md`.
```

- [ ] **Step 4: Hand-walk scenarios 4, 5, 6, 7, 8 from Appendix A**

For each, trace plan's behavior. Confirm:
- Gate works (scenario 8: missing config).
- Backlog detection branches both work (scenarios 5, 6).
- New-task path with overlap (scenario 4) at least mentions checking.

Fix any gaps.

- [ ] **Step 5: Commit**
```bash
git add skills/plan/
git commit -m "feat(plan): add skill with template and backlog handling references"
```

---

## Task 4: execute skill

**Implements spec:** §3 (게이트 룰), §4 (boundary, stack-agnostic 흐름)

**Files:**
- Create: `skills/execute/SKILL.md`
- Create: `skills/execute/boundaries.md`

- [ ] **Step 1: Write SKILL.md**

File: `skills/execute/SKILL.md`

```markdown
---
name: execute
description: Use after /plan to apply the planned changes. Reads .handoff/plan.md and writes/updates code exactly as specified, plus runs only the sync commands listed in the plan. Does NOT run test, typecheck, or lint commands — those belong to /verify. Pair with /plan and /verify.
---

# Execute

Apply the changes that `plan.md` describes. Stay strictly inside the plan; never improvise.

## Gate (run first)

1. Read `.handoff/config.md`. If missing → "Run `/setup-handoff` first."
2. Read `.handoff/plan.md`. If missing → "Run `/plan` first."
3. Both present → proceed.

## Workflow

1. Read `plan.md` end-to-end.
2. Create `.handoff/task.md` with one checkbox per change list entry plus one per sync command.
3. For each change:
   - Apply the file edit / creation as plan describes.
   - Update task.md: mark the item complete.
4. After code edits done, run sync commands one by one. Update task.md per command.
5. Print:
   ```
   ✅ task.md updated. All planned changes applied.
   Next step: /verify (strongly recommended in a fresh chat)
   ```

## Boundaries

See [boundaries.md](boundaries.md). Critical points:
- Only run commands listed under "Sync commands" in the plan.
- Never run test/typecheck/lint commands (those are verify's job).
- Never modify plan.md.
- If a critical blocker is discovered (the plan can't be executed as written), STOP, print:
  ```
  ⚠️  Blocker: <description>. Plan needs revision — run `/plan` again.
  ```
  Do NOT improvise around it.

## Output language

Progress messages use `config.md`'s `response_language`. Code itself remains in the language native to the project (typically English).
```

- [ ] **Step 2: Write boundaries.md**

File: `skills/execute/boundaries.md`

```markdown
# Execute Boundaries

`execute` is the only skill that modifies code. To prevent scope drift, it MUST follow these rules.

## Allowed

| Action | Source of truth |
|---|---|
| Modify a file | Listed in plan.md "Change list" with the exact path |
| Create a file | Listed in plan.md "Change list" with `[Create]` marker |
| Delete a file | Listed in plan.md "Change list" with `[Delete]` marker |
| Run a shell command | Listed verbatim in plan.md "Sync commands" |
| Update `.handoff/task.md` | Always allowed |

## Forbidden

| Action | Reason |
|---|---|
| Edit any file not in plan.md change list | Improvising scope |
| Run any command not in plan.md sync commands | Including test/typecheck/lint — those belong to verify |
| Modify plan.md | The plan is the contract |
| Modify config.md or backlog.md | Setup/verify own those |
| Delete `.handoff/` | The cycle owns its state |

## Blocker protocol

If during execution you find:
- a file the plan said to modify doesn't exist
- a function the plan referenced has a different signature
- a sync command fails in a way the plan didn't anticipate
- the change as described conflicts with code you're seeing

Then:
1. STOP. Don't push through.
2. Update `.handoff/task.md` to mark the in-progress item as ⚠️ blocked.
3. Print to user:
   ```
   ⚠️  Blocker at <task item>: <description>
   Plan needs revision. Run /plan again with this context.
   ```
4. End the session. The user re-runs `/plan` to incorporate the new info.
```

- [ ] **Step 3: Hand-walk scenarios 4 and 7 from Appendix A**

Trace execute's flow:
- Scenario 4: plan exists, all changes apply cleanly, task.md fully checked.
- Scenario 7: blocker mid-flight, the protocol fires.

- [ ] **Step 4: Commit**
```bash
git add skills/execute/
git commit -m "feat(execute): add skill with strict boundaries reference"
```

---

## Task 5: verify skill

**Implements spec:** §3 (게이트 룰, 사이클 종료), §4 (boundary, 핸드오프 메타 정리), §6.3 (자동 정리), §6.4 (안전성)

**Files:**
- Create: `skills/verify/SKILL.md`
- Create: `skills/verify/checks.md`
- Create: `skills/verify/review-template.md`
- Create: `skills/verify/cycle-close.md`

- [ ] **Step 1: Write SKILL.md**

File: `skills/verify/SKILL.md`

```markdown
---
name: verify
description: Use after /execute to verify the changes are correct. Reads .handoff/{config,plan,task}.md, runs the verification commands from config, writes review.md, and on success cleans up handoff state and resolves processed backlog items. STRONGLY recommended to run in a fresh chat — fresh context is the entire point of this stage.
---

# Verify

Independent validation of `execute`'s output. Strict separation of context is the value: a fresh chat reading only the plan and code can spot what an in-context verify would miss.

## Gate (run first)

Required files in `.handoff/`: `config.md`, `plan.md`, `task.md`. If any missing, identify which step is incomplete and tell the user which slash to run.

## Workflow

1. Read config, plan, task.
2. Run the three verification commands from config (`test`, `typecheck`, `lint`). See [checks.md](checks.md) for command execution rules.
3. Compare actual code changes against plan's change list — note anything missing or extra.
4. Build review.md per [review-template.md](review-template.md).
5. Run cycle close per [cycle-close.md](cycle-close.md): file cleanup + backlog auto-resolve + non-blocking append.
6. Print summary based on outcome (see cycle-close.md).

## Boundaries

- **Allowed:** run verification commands, read any file, write `.handoff/review.md`, edit `.handoff/backlog.md` (resolve 🔄 items, append non-blocking), delete `.handoff/{plan,task,review}.md` per cycle-close rules.
- **Forbidden:** modify any code, modify `plan.md` or `task.md` mid-cycle, delete `.handoff/config.md`, delete the user's source files.

## Output language

`review.md` and progress messages use config's `response_language`.
```

- [ ] **Step 2: Write checks.md**

File: `skills/verify/checks.md`

```markdown
# Verification Checks

Run in this order. Stop on first command failure only if it makes subsequent checks meaningless (e.g. typecheck failure prevents tests from compiling).

## 1. Tests

Run `config.verification.test`. Capture stdout + stderr + exit code.

- Exit 0 → ✅
- Non-zero → ❌, capture failing test names

## 2. Typecheck

Run `config.verification.typecheck`. Capture stdout + stderr + exit code.

- Exit 0 → ✅
- Non-zero → ❌, capture error count + first 5 errors

## 3. Lint

Run `config.verification.lint`. Capture stdout + stderr + exit code.

- Exit 0 → ✅
- Non-zero → ⚠️ if "warnings only", ❌ if errors

## 4. Plan vs change diff

For each item in plan's change list, confirm the file exists and the relevant edit is in `git diff` (or new-file content). Note:
- Files plan said to modify but show no change → ❌ blocking
- Files changed that aren't in plan → ⚠️ non-blocking ("scope drift")

## 5. Convention check (light)

Pick the convention docs path from config. Skim 1-2 docs that look relevant to the change list. If a clear violation jumps out (e.g. plan ignored a documented pattern), note as ⚠️ non-blocking with a doc reference.

Don't go deep — verify is not a substitute for code review.

## Skipped commands

If any command in config is empty (`""` or `(not detected)`), skip it and note in review.md "Skipped: <step> (no command in config)".
```

- [ ] **Step 3: Write review-template.md**

File: `skills/verify/review-template.md`

```markdown
# Review Template

Standard structure for `.handoff/review.md`.

```markdown
# Verification Report

> Created: YYYY-MM-DD
> Plan: <plan title>
> Outcome: ✅ pass / ⚠️ pass with non-blocking / ❌ blocking

## Verification Commands

| Check | Command | Result |
|---|---|---|
| Tests | <cmd> | ✅ N tests passed |
| Typecheck | <cmd> | ✅ no errors |
| Lint | <cmd> | ✅ no errors |

## Plan vs change diff

- All change list items applied: ✅ / ❌ <list>
- Out-of-plan changes: <list or "(none)">

## ✅ Highlights

Brief, concrete things done well. Skip if nothing notable.

## ⚠️ Non-blocking suggestions

Will be appended to `.handoff/backlog.md` on cycle close. Each line:

`- [ ] <one-sentence improvement>, with rationale.`

## ❌ Blocking issues

(Only if outcome is ❌.) Each item: file:line, problem, recommended fix direction.

## Closed backlog items

(Only if plan had `> Addresses backlog: ...` and verify passed.)

- #2: <title>
- #5: <title>

## Cycle close

Per outcome:
- ✅ pass: handoff files deleted (plan, task, review). Backlog #N, #M closed.
- ⚠️ non-blocking only: handoff files deleted. Suggestions appended to backlog.
- ❌ blocking: handoff files retained. Run /plan to address blockers.
```
```

- [ ] **Step 4: Write cycle-close.md**

File: `skills/verify/cycle-close.md`

```markdown
# Cycle Close

How verify cleans up after writing review.md. Decisions branch on outcome.

## Outcome categories

- **✅ pass** = all verification commands ✅, no blocking issues, no non-blocking suggestions.
- **⚠️ pass with non-blocking** = all verification commands ✅, no blocking issues, but at least one non-blocking suggestion.
- **❌ blocking** = at least one verification command ❌ OR at least one blocking issue noted in plan-vs-diff or convention check.

## Per-outcome actions

### ✅ pass

1. If plan.md has `> Addresses backlog: #N, #M`:
   - Parse the IDs.
   - In `.handoff/backlog.md`, find each `- [🔄] #N ...` line and DELETE the entire line.
   - The "Closed backlog items" section in review.md is the only audit trail (review.md is about to be deleted; rely on git history of `.handoff/` if it's tracked).
2. Delete `.handoff/plan.md`, `.handoff/task.md`, `.handoff/review.md`.
3. Print:
   ```
   ✅ Verification passed. Cycle closed.
   <if backlog closed:> Closed backlog items: #N, #M
   ```

### ⚠️ pass with non-blocking

1. Treat plan-addressed backlog items same as ✅ (delete them — verification passed, the work is done).
2. Append the "⚠️ Non-blocking suggestions" from review.md as new entries in `.handoff/backlog.md`. Number them continuing the existing sequence (next free integer after the highest current ID).
3. Delete `.handoff/plan.md`, `.handoff/task.md`, `.handoff/review.md`.
4. Print:
   ```
   ⚠️  Cycle closed with N suggestions added to backlog.
   <if backlog closed:> Closed backlog items: #N, #M
   ```

### ❌ blocking

1. Do NOT modify backlog. Items marked 🔄 stay 🔄 — the next plan cycle will pick them up after the blockers are fixed.
2. Do NOT delete plan.md, task.md, review.md. The next /plan will read them.
3. Print:
   ```
   ❌ Verification found blocking issues. See .handoff/review.md.
   Run /plan to address them; the next cycle will inherit context.
   ```

## Backlog ID assignment

Open question (spec §11): is backlog ID monotonically increasing, or do we reuse closed IDs? **MVP decision: monotonic.** Find max integer ID currently in backlog.md, increment for each new non-blocking item.

## No `.bak` file

Spec §6.4: rely on git for backups. Never create `.handoff/backlog.md.bak`.
```

- [ ] **Step 5: Hand-walk scenarios 4, 5, 6, 7 from Appendix A**

For each outcome path (✅, ⚠️, ❌, blocker mid-execute), walk through:
- Which files are written / deleted / retained.
- What review.md contains.
- What backlog.md looks like before vs after.

Fix any inconsistencies with cycle-close.md.

- [ ] **Step 6: Commit**
```bash
git add skills/verify/
git commit -m "feat(verify): add skill with checks, review template, and cycle-close rules"
```

---

## Task 6: Examples (`docs/examples/`)

**Implements spec:** §8 (산출물 샘플)

**Files:**
- Create: `docs/examples/config.md`
- Create: `docs/examples/plan.md`
- Create: `docs/examples/task.md`
- Create: `docs/examples/review.md`
- Create: `docs/examples/backlog.md`

These are illustrative samples (NOT live state). README will link them.

- [ ] **Step 1: Write `docs/examples/config.md`**

Use the example block in spec §5.5 verbatim, with a comment header:

```markdown
<!-- Example .handoff/config.md from a pnpm + turborepo + NestJS + React project. -->

# Handoff Config

## Verification Commands
test:      pnpm turbo test
typecheck: pnpm turbo typecheck
lint:      pnpm lint
build:

## Conventions
response_language: en
handoff_dir:       .handoff
commit_style:      conventional

## Project Documentation Index

### Agent guidance
- CLAUDE.md
- AGENTS.md

### Project docs
- README.md
- docs/conventions/ — coding patterns
  - apollo-client.md
  - component-design-pattern.md
- docs/features/ — module-by-module reference

### Detected toolchain
- package manager: pnpm (from pnpm-lock.yaml)
- monorepo: turborepo (from turbo.json)
- frameworks: NestJS, React, Apollo Client (from package.json deps)
```

- [ ] **Step 2: Write `docs/examples/plan.md`** — a realistic mini-plan

```markdown
<!-- Example .handoff/plan.md addressing two backlog items in a React + Apollo project. -->

# Add error boundary and extract user-search hook

> Created: 2026-04-12
> Author: plan skill
> Addresses backlog: #2, #5

## Background

Two backlog items pile up enough impact to address together: the missing error boundary causes blank screens on Apollo network failures, and the user-search logic is duplicated across three containers.

## Change list

### `frontend/main/src/components/error-boundary.tsx` — Create

A class-based React error boundary with a `fallback` prop. Catches render-tree errors and Apollo network errors thrown from suspense.

### `frontend/main/src/container/layout/layout.container.tsx` — Modify

Wrap the existing `<Outlet/>` in `<ErrorBoundary fallback={<ErrorScreen/>}>`. Match the Container/Presentation pattern from `docs/conventions/component-design-pattern.md`.

### `packages/logic/src/hooks/use-user-search.ts` — Create

Extract the `useUserSearch` hook from `home-start.container.tsx`, `dm.container.tsx`, `notifications.container.tsx`. Single source. Follow the Apollo Client query pattern in `docs/conventions/apollo-client.md`.

### `frontend/main/src/container/{home-start,dm,notifications}/*.container.tsx` — Modify

Replace inline user-search logic with `useUserSearch` from `@universe/logic`.

## Test strategy

- `packages/logic/src/hooks/use-user-search.spec.ts` — tests success / network error / debounce paths.
- `frontend/main/src/components/error-boundary.spec.tsx` — tests render-error catch + fallback render.

## Verification plan

- `pnpm turbo test` — all tests pass.
- `pnpm turbo typecheck` — no errors.
- `pnpm lint` — no errors.
```

- [ ] **Step 3: Write `docs/examples/task.md`**

```markdown
<!-- Example .handoff/task.md mid-cycle. ✅ = done, [ ] = pending, ⚠️ = blocked. -->

# Execute checklist

> Plan: Add error boundary and extract user-search hook

## Code changes

- [✅] Create `frontend/main/src/components/error-boundary.tsx`
- [✅] Modify `frontend/main/src/container/layout/layout.container.tsx`
- [✅] Create `packages/logic/src/hooks/use-user-search.ts`
- [✅] Modify `frontend/main/src/container/home-start/home-start.container.tsx`
- [✅] Modify `frontend/main/src/container/dm/dm.container.tsx`
- [✅] Modify `frontend/main/src/container/notifications/notifications.container.tsx`

## Sync commands

(none in this plan)

## Notes

- All edits applied as planned.
- No blockers.
```

- [ ] **Step 4: Write `docs/examples/review.md`**

```markdown
<!-- Example .handoff/review.md, ⚠️ pass with non-blocking. -->

# Verification Report

> Created: 2026-04-12
> Plan: Add error boundary and extract user-search hook
> Outcome: ⚠️ pass with non-blocking

## Verification Commands

| Check | Command | Result |
|---|---|---|
| Tests | `pnpm turbo test` | ✅ 247 tests passed |
| Typecheck | `pnpm turbo typecheck` | ✅ no errors |
| Lint | `pnpm lint` | ✅ no errors |

## Plan vs change diff

- All change list items applied: ✅
- Out-of-plan changes: (none)

## ✅ Highlights

- Hook extraction reduces three duplicate sites to one. Net -47 lines.
- Error boundary's fallback prop matches Container/Presentation pattern in `docs/conventions/component-design-pattern.md`.

## ⚠️ Non-blocking suggestions

- [ ] Add Storybook stories for the new error boundary component to surface in design review.
- [ ] Consider exposing `useUserSearch`'s debounce delay as a parameter — currently hardcoded to 200ms.

## Closed backlog items

- #2: Add error boundary to Container
- #5: Extract user-search hook into packages/logic/

## Cycle close

⚠️ pass with non-blocking. plan.md, task.md, review.md will be deleted; 2 suggestions appended to backlog.
```

- [ ] **Step 5: Write `docs/examples/backlog.md`**

```markdown
<!-- Example .handoff/backlog.md showing active items, in-progress mark, and date sections. -->

# Improvement Backlog

## 2026-04-08 (from review)

- [ ] #1 Add Sentry error reporting to Apollo error boundary

## 2026-04-12 (from review)

- [ ] #6 Add Storybook stories for error boundary component
- [ ] #7 Expose useUserSearch debounce delay as a parameter

## 2026-04-15 (from review)

- [🔄] #8 Replace deprecated React Query usage in home-start container
- [ ] #9 Move feed pagination cursor logic into shared hook
```

- [ ] **Step 6: Commit**
```bash
git add docs/examples/
git commit -m "docs: add concrete examples of all five handoff artifacts"
```

---

## Task 7: docs/why-handoff.md

**Implements spec:** §1 (Why this exists), expanded for the README link.

**Files:**
- Create: `docs/why-handoff.md`

- [ ] **Step 1: Write the philosophy doc**

File: `docs/why-handoff.md`. Structure:

```markdown
# Why Handoff

## The three failure modes

(Expand spec §1 with concrete examples — quote the three patterns: same-context blindness, project-locked workflows, conventions-on-demand. Each gets one paragraph + one anecdote-style example, ~150 words each.)

## What the handoff fixes

(One paragraph each:)
- **Disk-backed state.** verify reads plan from disk, no shared memory with execute. New chat = independent eyes.
- **Stack-agnostic boundaries.** plan owns "what command to run." execute mechanically follows. The skill set works in any language/framework.
- **Conventions captured once.** setup auto-scans the docs once; every subsequent skill reads from config. No re-explanation.

## What this is NOT

- A process framework (Spec-Kit, BMAD, GSD): those impose their own loop. This is four small skills you use as needed.
- A test runner: verify uses your project's existing commands. We don't ship test scaffolding.
- An LLM: this is markdown + a manifest. The agent does the work.

## When to skip a step

(One short section: when full plan→execute→verify is overkill.)
- Single-file refactor with obvious diff: skip plan, just edit and verify.
- Throwaway prototyping: skip the whole pipeline.
- The handoff shines when the change touches 3+ files or you'll want to verify in fresh context.

## Where the magic isn't

Be explicit: this skill set encodes a working pattern. It doesn't make the agent smarter, doesn't fix bad plans, doesn't catch what verify didn't think to check. The discipline of separating phases is what helps — the markdown is just scaffolding for that discipline.
```

Length target: ~600-1000 words. Reference the spec for facts, but write afresh — this is for an external audience, not internal review.

- [ ] **Step 2: Commit**
```bash
git add docs/why-handoff.md
git commit -m "docs: add why-handoff philosophy doc"
```

---

## Task 8: README.md (full)

**Implements spec:** §7 (README content), §9 (Tool-specific install notes section)

**Files:**
- Modify: `README.md` (replace skeleton from Task 1)

- [ ] **Step 1: Write the full README**

File: `README.md`. Structure:

````markdown
# Agent Handoff Skills

Strict 3-stage handoff workflow for coding agents — `plan` → `execute` → `verify` — with disk-backed state for cross-context handoff.

## Why

Agents working in a single context tend to skip verification of their own output. This plugin splits the work into three skills with strict boundaries, persisting state to `.handoff/*.md` so verify can run in a fresh chat. See [docs/why-handoff.md](docs/why-handoff.md) for the long version.

## The four skills

| Skill | When | Reads | Writes | Forbidden |
|---|---|---|---|---|
| `/setup-handoff` | once per project | manifests, agent docs, doc tree | `.handoff/config.md` | code, build commands |
| `/plan` | starting a feature/fix | config, backlog | `.handoff/plan.md` | code, build commands |
| `/execute` | after `/plan` | config, plan | `.handoff/task.md` + code | test/typecheck/lint |
| `/verify` | after `/execute`, fresh chat | config, plan, task | `.handoff/review.md`, cleans up | code |

## Install

### Claude Code

```bash
/plugin marketplace add <owner>/agent-handoff
/plugin install agent-handoff
```

(Replace `<owner>` once the GitHub URL is final.)

### Tool-specific install notes

(Stub for Cursor, Codex, Gemini — each in a `<details>` section. Initial release: just point users to the SKILL.md frontmatter format, link to each tool's plugin/rule docs. Concrete instructions added as users report what works.)

```markdown
<details>
<summary>Cursor</summary>

The SKILL.md frontmatter is compatible with Cursor's rules format. Copy each `skills/<name>/SKILL.md` into `.cursor/rules/` in your project. (Tested combinations to be added by community.)
</details>

<details>
<summary>Codex / Gemini / Aider</summary>

The frontmatter (name + description + body) is intentionally minimal so it works as a generic "system instruction" file. Reach out via issues if you tested a specific tool — install steps land here.
</details>
```

## Workflow

```
/setup-handoff              # once
/plan "<task description>"  # describe what you want
/execute                    # ideally in a fresh chat
/verify                     # ideally in another fresh chat
```

See [docs/examples/](docs/examples/) for concrete artifacts at each stage.

## Configuration

`/setup-handoff` writes `.handoff/config.md`. Edit it directly to change verification commands, response language, or doc paths. Re-running `/setup-handoff` overwrites; `/setup-handoff --auto` skips the interview entirely (falls back to asking only for items it couldn't auto-detect).

## What's in scope (v1)

- 4 skills above
- `--auto` mode for setup-handoff
- Backlog auto-resolve on verify pass
- Stack-agnostic (works for any language/framework — sync commands come from your plan)

## What's out of scope (v1)

- `/setup-handoff --refresh` (manually edit config for now)
- Manual backlog operations (`/verify --close-backlog ...`)
- More skills (`git-push`, `pr-analyzer`, `verify-all` — possibly v2)
- Auto-conversion to non-Claude-Code tool formats

## License

MIT.
````

Concrete details to fill in:
- Replace `<owner>` placeholder once GitHub repo is created.
- Tool-specific install sections start as stubs; real content lands once users report results.

- [ ] **Step 2: Commit**
```bash
git add README.md
git commit -m "docs: write full README with workflow, install, and tool-specific stubs"
```

---

## Task 9: Hand-walk all 8 Appendix A scenarios end-to-end

**Implements spec:** Appendix A (workflow validation)

This is the integration check before push. No new files; just trace each scenario against everything written in Tasks 2-6.

- [ ] **Step 1: Open spec Appendix A and the four SKILL.md files side-by-side**

```bash
cat docs/specs/2026-05-05-agent-handoff-design.md | sed -n '/^## Appendix A/,$p' > /tmp/scenarios.md
ls skills/*/SKILL.md
```

- [ ] **Step 2: For each of scenarios 1-8, write a trace**

For each scenario, write a paragraph (mental dry-run) and answer:
- Which skill files (SKILL.md + reference) does this scenario touch?
- Does the documented behavior cover the scenario without contradiction?
- Are any decision branches missing?

Specifically:

1. First setup with default mode — touches setup-handoff/SKILL.md, auto-scan.md, interview.md
2. `--auto` mode — same files, mode branch
3. `--auto` fallback — interview.md "fallback" section
4. Normal cycle plan→execute→verify with ✅ — all four skills, cycle-close.md
5. Non-blocking append — verify/cycle-close.md ⚠️ branch
6. Backlog processing — plan/backlog-handling.md + verify/cycle-close.md ✅ branch with backlog
7. Backlog processing failure — execute/boundaries.md blocker protocol + verify ❌ branch
8. Gate failure (config missing) — every skill's gate section

- [ ] **Step 3: Note any gaps in `/tmp/handoff-walkthrough-notes.md`**

Free-text notes; will be deleted after Task 9. The point is to surface contradictions or missing branches before pushing.

- [ ] **Step 4: For each gap, edit the relevant SKILL or reference file**

If gaps were found in Step 3, edit the corresponding file and re-trace just that scenario. Repeat until no gaps.

- [ ] **Step 5: Delete the temp notes**

```bash
rm /tmp/scenarios.md /tmp/handoff-walkthrough-notes.md
```

- [ ] **Step 6: Commit (only if Step 4 made changes)**
```bash
git status
# If clean, skip commit. If files changed:
git add skills/
git commit -m "fix: tighten skill docs after walkthrough of all 8 scenarios"
```

---

## Task 10: Connect to GitHub remote and push (after user creates the repo)

**Pre-condition:** User has created an empty GitHub repo and shared the URL.

**Files:** none modified — git operations only.

- [ ] **Step 1: Receive the GitHub URL from user**

User runs `gh repo create agent-handoff --public` (or via GitHub UI). They share `https://github.com/<owner>/agent-handoff` with the agent.

- [ ] **Step 2: Connect remote**
```bash
cd ~/Desktop/projects/agent-handoff
git remote add origin https://github.com/<owner>/agent-handoff.git
git remote -v
```
Expected: origin appears with the correct URL.

- [ ] **Step 3: Push**
```bash
git push -u origin main
```
Expected: push succeeds, default branch tracked.

- [ ] **Step 4: Replace placeholders that needed the URL**

In `LICENSE` and `README.md`, replace:
- `<github-username>` (in LICENSE copyright) with actual owner
- `<owner>` (in README install section) with actual owner

```bash
# Fill placeholders, then:
git add LICENSE README.md
git commit -m "docs: replace placeholder owner with actual GitHub URL"
git push
```

- [ ] **Step 5: Verify the plugin loads in Claude Code**

Open a fresh Claude Code session in any project. Run:

```
/plugin marketplace add <owner>/agent-handoff
/plugin install agent-handoff
```

Then `/setup-handoff --help` (or just `/setup-handoff`) — confirm the skill is discoverable.

- [ ] **Step 6: Manual end-to-end smoke**

In a sandbox project (e.g. a fresh `/tmp/sandbox-app` with a tiny `package.json`):
1. `/setup-handoff` → confirm config.md generated
2. `/plan "add a hello world function"` → confirm plan.md generated
3. `/execute` (in a fresh chat) → confirm code added + task.md
4. `/verify` (in another fresh chat) → confirm review.md + cycle close

Any failure → file an issue against the just-pushed repo.

---

## Self-Review (run before declaring "plan complete")

**1. Spec coverage check.** For each spec section, point to the implementing task:

- §1 Why this exists → Task 7 (why-handoff.md)
- §2 결정 요약 → captured implicitly across all skills
- §3 워크플로우 + 게이트 → Task 2 (setup), 3 (plan), 4 (execute), 5 (verify) — each has a gate section
- §4 Boundary → Task 4 (execute/boundaries.md), Task 5 (verify/SKILL.md boundaries)
- §5 setup-handoff → Task 2 in full
- §6 Backlog Lifecycle → Task 3 (plan/backlog-handling.md), Task 5 (verify/cycle-close.md)
- §7 Repo 구조 → Tasks 1, 2, 3, 4, 5 collectively produce it
- §8 examples → Task 6
- §9 SKILL.md frontmatter standard → Tasks 2, 3, 4, 5 each carry the format
- §10 Out of scope → Task 8 (README "out of scope" section)
- §11 Open Questions → Task 5 (cycle-close.md fixes the backlog ID question to monotonic)
- §12 다음 단계 → this plan IS the next step
- Appendix A → Task 9

✅ Every spec section maps to a task.

**2. Placeholder scan.** Search this plan for: TBD, TODO, "implement later", "fill in", "details to follow", "appropriate error handling", "similar to". Result: only `<owner>`, `<github-username>`, and `<task description>` appear — all are actual placeholders to be filled in by the user/runtime, not deferred work. ✅

**3. Type/name consistency.** Check cross-task references:
- `.handoff/config.md`, `.handoff/plan.md`, `.handoff/task.md`, `.handoff/review.md`, `.handoff/backlog.md` — used consistently throughout.
- Skill filenames: `setup-handoff`, `plan`, `execute`, `verify` — consistent.
- Reference filenames: `auto-scan.md`, `interview.md`, `plan-template.md`, `backlog-handling.md`, `boundaries.md`, `checks.md`, `review-template.md`, `cycle-close.md` — match repo structure (Task 1 + spec §7).
- Frontmatter `name` field equals folder name in every skill ✅.

**4. Order check.** Tasks are independent enough that 2-5 could run in any order, but committing in numeric order yields a cleaner git history. Task 9 depends on Tasks 2-5. Task 10 depends on user creating the repo (external).

✅ No issues found.

---

## Execution Handoff

Plan saved to `~/Desktop/projects/agent-handoff/docs/plans/2026-05-05-mvp-implementation.md`.

Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent dispatched per task, review between tasks, fast iteration. Best for cross-context discipline (matches the spirit of this plugin).
2. **Inline Execution** — execute tasks in this session using `executing-plans`, batch with checkpoints.

Which approach do you want?
