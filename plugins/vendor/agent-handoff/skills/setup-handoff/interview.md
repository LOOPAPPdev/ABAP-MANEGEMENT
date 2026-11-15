# Interview Script

Run one question at a time. After each answer, store the result and move on.

## Default mode (4 questions)

### [1] Response language

```
[1] Response language
    Detected: <auto.language or "en (default)">
    Use this? [Y / type ISO code (en, ko, ja, zh, ...)]
```

If the auto-scan found agent guidance files (CLAUDE.md, AGENTS.md) that contain language directives like "respond in Korean", use that as the detected default instead of `en`.

After receiving the answer, switch to the chosen language for the remaining questions [2]–[4] AND the final summary print.

### [2] Verification commands

Show auto-detected defaults (or "(not detected)" for any null). Include a one-line note in the prompt explaining ownership so the user knows which command runs where:

```
[2] Verification commands
    (typecheck → run by /execute as compile check; test + lint → run by /verify)
    Detected:
      test:      <auto.test or "(not detected)">
      typecheck: <auto.typecheck or "(not detected)">
      lint:      <auto.lint or "(not detected)">
    Use these? [Y/edit/skip]
```

- `Y` (or Enter): use detected values; missing ones become empty
- `edit`: ask each command one by one (fall back to a free-text prompt)
- `skip`: leave all three empty (verify will warn later)

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
convention_docs:   ...

## Project Documentation Index

### Agent guidance
- [path/to/file.md](path/to/file.md) — short description
- ...

### Project docs
- [path/to/file.md](path/to/file.md) — short description
- ...

### Detected toolchain
- package manager: ...
- monorepo: ...
- frameworks: ...
```

Doc-index entries use the markdown-link form `- [path](path) — desc` (em-dash, not hyphen). The short description (3–7 words) is sourced from the auto-scan description heuristic (see [auto-scan.md](auto-scan.md) "Description heuristic for doc index entries"), which folds workspace context into the phrase for sub-package files (e.g. `apps/server/README.md` → "server overview").

Write to `.handoff/config.md`.

### Monorepo branch — Verification Commands

If the auto-scan detected a monorepo (`toolchain.monorepo` is non-null) AND the root `package.json` has no `test`/`typecheck`/`lint` scripts, write the top-level fields empty and append a blockquote listing per-workspace candidates:

```
## Verification Commands

test:
typecheck:
lint:
build:

> Monorepo — root package.json has no test/typecheck/lint scripts.
> Plan picks the right command per workspace from this candidate list:
> - <workspace-1>: `<test cmd>`, `<typecheck cmd>`, `<lint cmd>`
> - <workspace-2>: `<test cmd>`, `<typecheck cmd>`, `<lint cmd>`
> ...
```

Use up to 8 workspaces (matching the `toolchain.workspaces` cap). Wrap each per-workspace command in backticks so it renders as inline code inside the blockquote.

If the monorepo DOES have root-level test/typecheck/lint scripts (rare but possible — e.g. turbo orchestrating from root), use those root scripts as the top-level fields and skip the blockquote.

If non-monorepo: keep the existing single-set behavior (write the detected commands directly into `test:`/`typecheck:`/`lint:`).
