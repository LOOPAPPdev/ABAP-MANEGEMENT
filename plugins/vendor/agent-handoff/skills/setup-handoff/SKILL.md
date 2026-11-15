---
name: setup-handoff
description: Use once per project before /plan, /execute, /verify. Auto-scans the repo (manifests, agent guidance, doc tree, toolchain) and runs a short interview to write .handoff/config.md. Pass --auto to skip the interview and accept all auto-detected values, falling back to interview only for items that auto-detection cannot resolve. Part of the agent-handoff bundle (4 skills) — install /setup-handoff, /plan, /execute, /verify together.
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

## Output language

Question [1] of the interview asks the user's response language. Up until that answer, use the conversation's existing language (or `en` if unclear). The instant question [1] is answered, switch ALL subsequent output (remaining interview prompts, status messages, the written `config.md`) to the chosen `response_language`. Code, file paths, command syntax, and identifiers stay in their native language regardless.

## Boundaries

- **Allowed:** read project files, write/update `.handoff/config.md`, create `.handoff/` directory.
- **Forbidden:** modify any file outside `.handoff/`. Run no build/test/lint commands.

## Gates

`setup-handoff` has no input gate — it's the entry point. Always proceeds.
