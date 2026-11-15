# Privacy

agent-handoff is a local-only workflow plugin. It does not collect, transmit, or store any user data outside the user's machine.

## What it reads
- Repository files (manifests, agent docs, source files) — only to generate plan/task/review artifacts.
- `.handoff/*.md` files — its own state.

## What it writes
- `.handoff/config.md`, `plan.md`, `task.md`, `review.md`, `backlog.md` in the user's working directory.
- Source files explicitly listed in the plan, during `/execute`.

## What it sends externally
Nothing. No telemetry, no analytics, no remote calls.

## Third parties
None. The plugin is just a set of skill definitions (Markdown). All execution happens through the host agent (Claude Code, Cursor, etc.) on the user's machine.
