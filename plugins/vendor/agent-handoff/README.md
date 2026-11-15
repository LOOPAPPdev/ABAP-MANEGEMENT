# Agent Handoff Skills

**English** | [한국어](README.ko.md)

Strict 3-stage handoff workflow for coding agents — `plan` → `execute` → `verify` — with disk-backed state for cross-context handoff.

```mermaid
flowchart LR
    A["/setup-handoff<br/><sub>config.md</sub>"] --> B["/plan<br/><sub>plan.md</sub>"]
    B --> C["/execute<br/><sub>task.md + code</sub>"]
    C --> D["/verify<br/><sub>review.md</sub>"]
    D -.unresolved.-> E["backlog.md"]
    E -.next cycle.-> B
```

## Why

Agents working in a single context tend to skip verification of their own output. This plugin splits the work into three skills with strict boundaries, persisting state to `.handoff/*.md` so verify can run in a fresh chat. See [docs/why-handoff.md](docs/why-handoff.md) for the long version.

## The four skills

| Skill | When | Reads | Writes | Forbidden |
|---|---|---|---|---|
| `/setup-handoff` | once per project | manifests, agent docs, doc tree | `.handoff/config.md` | code, build commands |
| `/plan` | starting a feature/fix | config, backlog | `.handoff/plan.md` | code, build commands |
| `/execute` | after `/plan` | config, plan | `.handoff/task.md` + code | tests, lint, mutations outside plan |
| `/verify` | after `/execute`, fresh chat | config, plan, task | `.handoff/review.md`, cleans up | code, typecheck (already run by execute) |

`/execute` runs the **read-only compile check** (config's `typecheck`) as a safety net — type errors get caught one step earlier instead of waiting for `/verify`. Tests, lint, and plan-vs-code judgment stay with `/verify` (fresh context is the point).

## Install

### Universal (any supported agent — recommended)

Powered by [`vercel-labs/skills`](https://github.com/vercel-labs/skills), which works with Claude Code, Cursor, Codex, Gemini CLI, Aider, and 50+ other agents.

> **⚠️ Install all four skills together.** The skills are designed as a set: each one's gate expects state written by the previous step (`/plan` needs `config.md` from `/setup-handoff`, `/execute` needs `plan.md`, `/verify` needs `task.md`). Partial installs will surface gate failures pointing to slash commands that aren't installed. Use `--skill '*'` (or `--all`) to install all four at once.

```bash
# Interactive: pick which agents to install into (selects all 4 skills by default)
npx skills@latest add WillowRyu/agent-handoff

# Non-interactive: install all 4 skills globally for Claude Code
npx skills@latest add WillowRyu/agent-handoff --skill '*' -g -a claude-code -y
```

Useful flags: `-g` (global, into `~/`), `--list` (dry-run), `--skill '*'` (all skills, recommended), `-a <agent>` (target agent). See `npx skills@latest --help`.

### Claude Code (plugin marketplace alternative)

```bash
/plugin marketplace add WillowRyu/agent-handoff
/plugin install agent-handoff
```

## Workflow

```
/setup-handoff              # once
/plan "<task description>"  # describe what you want
/execute                    # ideally in a fresh chat
/verify                     # ideally in another fresh chat
```

See [docs/examples/](docs/examples/) for concrete artifacts at each stage.

## Permissions

Each skill writes specific files. The bundled hook (`hooks/hooks.json`) auto-approves `.handoff/**` writes when installed as a Claude Code plugin. Other install paths and other agents need explicit permission rules.

| Skill | Needs |
|---|---|
| `setup-handoff` | Read on the repo; Write/Edit on `.handoff/config.md` |
| `plan` | Read on the repo; Write/Edit on `.handoff/plan.md` and `.handoff/backlog.md` |
| `execute` | Edit on source files listed in the plan; Write on `.handoff/task.md`; `Bash` for the plan's sync commands AND config's `typecheck` |
| `verify` | `Bash` for test/lint AND `git diff` (used to compare actual changes against plan); Edit/Delete on `.handoff/{plan,task,review,backlog}.md` |

> **Project requirement:** the project must be a git repository. `/verify`'s plan-vs-code check uses `git diff` to confirm planned changes were actually applied (and to flag out-of-plan changes). In a non-git directory, this check degrades to a file-existence check only.

### Claude Code

**Plugin install (`/plugin install agent-handoff`)**: A bundled PreToolUse hook in `hooks/hooks.json` auto-approves writes to `.handoff/**`. After accepting the first prompt to load the plugin, no further per-write prompts appear.

**`npx skills` install or other paths**: `npx skills add` copies SKILL.md files only — the hook doesn't come along. Add explicit permission rules to your settings:

```json
{
  "permissions": {
    "allow": [
      "Write(.handoff/**)",
      "Edit(.handoff/**)"
    ]
  }
}
```

Add to `~/.claude/settings.json` (global) or `.claude/settings.json` (project).

### Other agents

Cursor, Codex, Gemini CLI, Aider, etc. each have their own permission models. The skills don't reach outside `.handoff/` and the source files explicitly listed in the plan, so apply your existing scoping conventions.

## Configuration

`/setup-handoff` writes `.handoff/config.md`. The file is plain markdown — edit it directly, or ask your agent to edit it, at any time to update verification commands, response language, the convention doc path, or the documentation index. The skills don't touch `config.md` mid-cycle (`/plan`, `/execute`, `/verify` only read it), so incremental edits between cycles are safe.

Re-running `/setup-handoff` rewrites `config.md` from scratch (overwriting any custom additions); `/setup-handoff --auto` skips the interview entirely and falls back to asking only for items it couldn't auto-detect. In don't-ask mode or other non-interactive environments, the skill uses sensible defaults silently and reports them in a summary note.

## What's in scope

- 4 skills with strict boundaries and disk-backed handoff via `.handoff/*.md`
- Stack-agnostic, **monorepo-aware** scanning (pnpm/npm/yarn/turbo/lerna/nx/cargo/go workspaces; per-workspace docs + verification candidates)
- Setup interview asks **response language first** — every subsequent output (status messages, written `.md` files) uses that language
- Doc index uses clickable markdown links with short descriptions
- **Plan-decided verification scope** — `/verify` runs only what `plan.md`'s `## Verification plan` lists (or skips entirely with rationale for docs-only changes); falls back to `config.md` only if plan omits the section
- **Compile check in `/execute`** — config's `typecheck` runs as the safety net inside execute; type errors caught before verify, with single in-plan fix attempt before blocker (v0.3.0)
- **Risk-tagged change list items** — plan items can carry `low` / `medium` / `high` risk; execute uses tags to adjust per-item check granularity (low = end-of-batch only, medium = per-item compile check, high = per-item check + per-item task.md update). Tags govern granularity, never authority. (v0.3.0)
- **Multi-phase plans** — `## Phases` section lets a single plan span multiple plan→execute→verify cycles; verify advances markers on pass and retains plan.md until the final phase. Backlog closure deferred to last phase. (v0.3.0)
- Optional **parallelization** — `/plan` identifies independent units in `## Parallelization`; `/execute` can dispatch one subagent per group when the host supports it (Claude Code's Task tool, etc.)
- `--auto` mode for setup-handoff (skip interview, per-item fallback when detection fails; non-interactive fallback uses defaults silently when `AskUserQuestion` is blocked) (v0.4.0)
- **Permission auto-approval hook** — bundled `hooks/hooks.json` auto-approves `.handoff/**` writes (Write/Edit/MultiEdit) when installed as a Claude Code plugin; eliminates per-write prompts after first install (v0.4.0)
- Backlog auto-resolve on verify pass (single-cycle or final-phase only)

## What's out of scope

- `/setup-handoff --refresh` (manually edit config for now)
- Manual backlog operations (`/verify --close-backlog ...`)
- More skills (`git-push`, `pr-analyzer`, `verify-all` — possibly v2)
- Auto-conversion to non-Claude-Code tool formats

## License

MIT.
